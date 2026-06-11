#!/usr/bin/env node
/**
 * End-to-end workflow test against live SolidWorks via MCP stdio.
 * Usage: node scripts/test-workflows-real.mjs [--workflow circle|cylinder|sphere|all]
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const workflowArg =
  process.argv.find((a) => a.startsWith('--workflow='))?.split('=')[1] ??
  (process.argv.includes('--workflow') ? process.argv[process.argv.indexOf('--workflow') + 1] : 'all');

const serverPath = resolve('dist/index.js');
const env = {
  ...process.env,
  USE_MOCK_SOLIDWORKS: 'false',
  SOLIDWORKS_VERSION: process.env.SOLIDWORKS_VERSION || '2026',
  LOG_LEVEL: 'error',
};

const workflows = {
  circle: [
    ['create_part', {}],
    ['create_sketch', { plane: 'Front' }],
    ['sketch_circle', { center: { x: 0, y: 0 }, radius: 25 }],
    ['exit_sketch', { rebuild: true }],
    ['get_bounding_box', {}],
  ],
  cylinder: [
    ['create_part', {}],
    ['create_sketch', { plane: 'Front' }],
    ['sketch_circle', { center: { x: 0, y: 0 }, radius: 25 }],
    ['exit_sketch', { rebuild: true }],
    ['create_extrusion', { depth: 50 }],
    ['get_bounding_box', {}],
  ],
  sphere: [
    ['create_part', {}],
    ['create_sketch', { plane: 'Front' }],
    ['sketch_centerline', { start: { x: 0, y: -25 }, end: { x: 0, y: 25 } }],
    ['sketch_arc', { start: { x: 0, y: 25 }, end: { x: 0, y: -25 }, center: { x: 25, y: 0 } }],
    ['exit_sketch', { rebuild: true }],
    ['create_revolve', { angle: 360, axisPickY: 12.5 }],
    ['set_part_color', { r: 0, g: 0, b: 0 }],
    ['get_bounding_box', {}],
  ],
};

function callTool(proc, id, name, args) {
  proc.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`,
  );
}

async function waitForResponse(responses, id, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = responses.get(id);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  return undefined;
}

async function runWorkflow(name, steps) {
  console.log(`\n=== Workflow: ${name} (${steps.length} steps) ===`);

  const proc = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'pipe'], env, cwd: process.cwd() });
  const responses = new Map();
  let buffer = '';

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined) responses.set(msg.id, msg);
      } catch {
        // ignore non-json
      }
    }
  });

  proc.stderr.on('data', (chunk) => {
    const t = chunk.toString().trim();
    if (t) console.error(`  [stderr] ${t.slice(0, 200)}`);
  });

  let id = 1;
  let passed = 0;

  for (const [toolName, args] of steps) {
    callTool(proc, id, toolName, args);
    const resp = await waitForResponse(responses, id);
    id++;

    if (!resp) {
      console.log(`  FAIL  ${toolName}: timeout`);
      continue;
    }
    if (resp.error) {
      console.log(`  FAIL  ${toolName}: ${JSON.stringify(resp.error)}`);
      continue;
    }
    const text = resp.result?.content?.[0]?.text ?? '';
    if (text.toLowerCase().includes('fail')) {
      console.log(`  FAIL  ${toolName}: ${text.slice(0, 120)}`);
    } else {
      console.log(`  PASS  ${toolName}: ${text.slice(0, 120)}`);
      passed++;
    }
  }

  proc.stdin.end();
  await Promise.race([
    new Promise((r) => proc.on('close', r)),
    new Promise((r) => setTimeout(() => {
      proc.kill();
      r(undefined);
    }, 2000)),
  ]);
  console.log(`  Result: ${passed}/${steps.length} passed`);
  return passed === steps.length;
}

const names = workflowArg === 'all' ? Object.keys(workflows) : [workflowArg];
let allOk = true;
for (const n of names) {
  if (!workflows[n]) {
    console.error(`Unknown workflow: ${n}`);
    process.exit(1);
  }
  const ok = await runWorkflow(n, workflows[n]);
  if (!ok) allOk = false;
}

console.log(allOk ? '\nAll workflows passed' : '\nSome workflows failed');
process.exit(allOk ? 0 : 1);

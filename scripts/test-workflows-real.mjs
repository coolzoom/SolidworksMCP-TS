#!/usr/bin/env node
/**
 * End-to-end workflow test against live SolidWorks via MCP stdio.
 *
 * Usage:
 *   node scripts/test-workflows-real.mjs
 *   node scripts/test-workflows-real.mjs --workflow circle
 *   node scripts/test-workflows-real.mjs --workflow cylinder
 *   node scripts/test-workflows-real.mjs --workflow sphere
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const workflowArg = process.argv.find((a) => a.startsWith('--workflow='))?.split('=')[1]
  ?? (process.argv.includes('--workflow') ? process.argv[process.argv.indexOf('--workflow') + 1] : 'all');

const serverPath = resolve('dist/index.js');
const env = {
  ...process.env,
  USE_MOCK_SOLIDWORKS: 'false',
  SOLIDWORKS_VERSION: process.env.SOLIDWORKS_VERSION || '2023',
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
    ['sketch_arc', { center: { x: 0, y: 0 }, start: { x: -25, y: 0 }, end: { x: 25, y: 0 }, direction: 'counterclockwise' }],
    ['exit_sketch', { rebuild: true }],
    ['create_revolve', { angle: 360 }],
    ['get_bounding_box', {}],
  ],
};

function callTool(proc, id, name, args) {
  proc.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  })}\n`);
}

async function waitForResponse(responses, id, timeoutMs = 15000) {
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
        if (msg.id != null) responses.set(msg.id, msg);
      } catch {
        // ignore non-json
      }
    }
  });

  proc.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  proc.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'workflow-test', version: '1.0.0' },
    },
  })}\n`);
  proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

  const initResp = await waitForResponse(responses, 1, 10000);
  if (!initResp?.result) {
    console.log('  FAIL  initialize: MCP server did not respond');
    proc.stdin.end();
    proc.kill();
    return false;
  }

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < steps.length; i++) {
    const [toolName, toolArgs] = steps[i];
    const reqId = i + 10;
    callTool(proc, reqId, toolName, toolArgs);

    const resp = await waitForResponse(responses, reqId, 30000);
    const text = resp?.result?.content?.[0]?.text ?? JSON.stringify(resp?.result ?? resp?.error ?? 'no response');
    const ok = resp?.result && !resp?.error && !String(text).startsWith('Failed');

    if (ok) {
      passed++;
      console.log(`  PASS  ${toolName}: ${String(text).slice(0, 120)}`);
    } else {
      failed++;
      console.log(`  FAIL  ${toolName}: ${String(text).slice(0, 200)}`);
    }
  }

  proc.stdin.end();
  proc.kill();

  console.log(`  Result: ${passed}/${steps.length} passed`);
  return failed === 0;
}

async function main() {
  const names = workflowArg === 'all' ? Object.keys(workflows) : [workflowArg];
  let allOk = true;

  for (const name of names) {
    const steps = workflows[name];
    if (!steps) {
      console.error(`Unknown workflow: ${name}`);
      process.exit(1);
    }
    const ok = await runWorkflow(name, steps);
    if (!ok) allOk = false;
  }

  console.log(allOk ? '\nAll workflows passed' : '\nSome workflows failed');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

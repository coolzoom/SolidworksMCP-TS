#!/usr/bin/env node
/**
 * End-to-end test: create part -> sketch -> circle via MCP tools/call
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const serverPath = resolve('dist/index.js');
const env = {
  ...process.env,
  USE_MOCK_SOLIDWORKS: 'false',
  LOG_LEVEL: 'error',
};

const steps = [
  { id: 10, tool: 'create_part', args: {} },
  { id: 11, tool: 'create_sketch', args: { plane: 'Front', offset: 0, reverse: false } },
  {
    id: 12,
    tool: 'sketch_circle',
    args: { center: { x: 0, y: 0, z: 0 }, radius: 25, construction: false },
  },
];

function spawnServer() {
  const proc = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'pipe'], env, cwd: process.cwd() });
  const responses = [];
  let buffer = '';

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        responses.push(JSON.parse(t));
      } catch {
        /* ignore */
      }
    }
  });

  proc.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  const send = (msg) => proc.stdin.write(`${JSON.stringify(msg)}\n`);

  return { proc, responses, send };
}

async function waitFor(responses, id, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = responses.find((r) => r.id === id);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for response id=${id}`);
}

function resultText(resp) {
  if (resp?.error) return `ERROR: ${resp.error.message ?? JSON.stringify(resp.error)}`;
  return resp?.result?.content?.[0]?.text ?? JSON.stringify(resp?.result);
}

async function main() {
  console.log('\n=== Draw Circle E2E Test ===\n');

  const { proc, responses, send } = spawnServer();

  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'draw-circle-test', version: '1.0.0' },
    },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  await waitFor(responses, 1, 10000);
  console.log('PASS: MCP initialized');

  for (const step of steps) {
    console.log(`\n→ Calling ${step.tool}...`);
    send({
      jsonrpc: '2.0',
      id: step.id,
      method: 'tools/call',
      params: { name: step.tool, arguments: step.args },
    });

    const resp = await waitFor(responses, step.id, 60000);
    const text = resultText(resp);

    if (resp.error || /failed|error/i.test(text)) {
      console.error(`FAIL: ${step.tool}`);
      console.error(text);
      proc.kill();
      process.exit(1);
    }

    console.log(`PASS: ${step.tool}`);
    console.log(`  ${text.slice(0, 400)}`);
  }

  proc.stdin.end();
  proc.kill();

  console.log('\n=== Circle drawn successfully in SolidWorks ===\n');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Smoke test for FreeCAD MCP server.
 * Usage: node freecad-ai-bench/scripts/test-freecad-mcp.mjs [--create-screw]
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const benchRoot = resolve(scriptDir, '..');
const repoRoot = resolve(benchRoot, '..');
const serverPath = join(benchRoot, 'mcp-server', 'index.mjs');
const createScrew = process.argv.includes('--create-screw');

const env = {
  ...process.env,
  FREECAD_BENCH_ROOT: benchRoot,
  FREECAD_PYTHON_SCRIPT: join(benchRoot, 'python', 'freecad-iso4762-screw.py'),
  FREECAD_OUTPUT_DIR: join(benchRoot, 'output'),
  NODE_PATH: join(repoRoot, 'node_modules'),
  LOG_LEVEL: 'error',
};

function send(proc, msg) {
  proc.stdin.write(`${JSON.stringify(msg)}\n`);
}

function readResponses(proc, timeoutMs = 20000) {
  return new Promise((resolvePromise, reject) => {
    const responses = [];
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms. Received: ${JSON.stringify(responses)}`));
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          responses.push(JSON.parse(trimmed));
        } catch {
          // ignore
        }
      }
    });

    proc.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
    proc.on('close', () => {
      clearTimeout(timer);
      resolvePromise(responses);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function waitForResponse(responses, id, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = responses.find((r) => r.id === id);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No response for id=${id}`);
}

async function main() {
  if (!existsSync(serverPath)) {
    console.error(`Missing server: ${serverPath}`);
    process.exit(1);
  }

  console.log('\n=== FreeCAD MCP Smoke Test ===\n');

  const proc = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    cwd: repoRoot,
  });

  const responsesPromise = readResponses(proc, createScrew ? 180000 : 30000);

  send(proc, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'freecad-mcp-smoke', version: '1.0.0' },
    },
  });
  send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
  send(proc, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send(proc, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'get_freecad_status', arguments: {} },
  });

  if (createScrew) {
    send(proc, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'create_hex_socket_screw',
        arguments: { size: 'M3', length: 20, realThread: true, outputName: 'mcp_smoke_M3x20' },
      },
    });
  }

  await new Promise((r) => setTimeout(r, createScrew ? 30000 : 4000));
  proc.stdin.end();
  proc.kill();

  const responses = await responsesPromise;
  const initResp = responses.find((r) => r.id === 1);
  const toolsResp = responses.find((r) => r.id === 2);
  const statusResp = responses.find((r) => r.id === 3);
  const screwResp = responses.find((r) => r.id === 4);

  if (!initResp?.result) {
    console.error('FAIL: initialize');
    process.exit(1);
  }
  console.log(`PASS: initialize — ${initResp.result.serverInfo?.name}`);

  const tools = toolsResp?.result?.tools ?? [];
  if (tools.length < 3) {
    console.error('FAIL: tools/list', tools);
    process.exit(1);
  }
  console.log(`PASS: tools/list — ${tools.map((t) => t.name).join(', ')}`);

  const statusText = statusResp?.result?.content?.[0]?.text ?? '';
  if (!statusText.includes('FreeCADCmd')) {
    console.error('FAIL: get_freecad_status', statusText);
    process.exit(1);
  }
  console.log('PASS: get_freecad_status');
  console.log(statusText.split('\n').map((l) => `  ${l}`).join('\n'));

  if (createScrew) {
    const screwText = screwResp?.result?.content?.[0]?.text ?? '';
    if (screwResp?.result?.isError || !screwText.includes('Created')) {
      console.error('FAIL: create_hex_socket_screw', screwText);
      process.exit(1);
    }
    console.log('PASS: create_hex_socket_screw');
    console.log(screwText.split('\n').map((l) => `  ${l}`).join('\n'));
  }

  console.log('\n=== FreeCAD MCP smoke test complete ===\n');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});

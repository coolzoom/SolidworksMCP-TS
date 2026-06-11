#!/usr/bin/env node
/**
 * MCP smoke test — spawns the server over stdio and verifies initialize + tools/list.
 *
 * Usage:
 *   node scripts/test-mcp-smoke.mjs [--real]
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const useMock = !process.argv.includes('--real');
const serverPath = resolve('dist/index.js');

function send(proc, msg) {
  proc.stdin.write(`${JSON.stringify(msg)}\n`);
}

function readResponses(proc, timeoutMs = 15000) {
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
          // ignore non-JSON stdout noise
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      process.stderr.write(`[server] ${chunk}`);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({ responses, exitCode: code });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function waitForResponse(responses, id, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = responses.find((r) => r.id === id);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No response for id=${id}. Got: ${JSON.stringify(responses)}`);
}

async function main() {
  console.log(`\n=== MCP Smoke Test (${useMock ? 'mock' : 'real'} adapter) ===\n`);
  console.log(`Server: ${serverPath}\n`);

  const env = {
    ...process.env,
    USE_MOCK_SOLIDWORKS: useMock ? 'true' : 'false',
    LOG_LEVEL: 'error',
  };

  const proc = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    cwd: process.cwd(),
  });

  const resultPromise = readResponses(proc);

  send(proc, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-smoke-test', version: '1.0.0' },
    },
  });

  send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });

  send(proc, { jsonrpc: '2.0', id: 2, method: 'tools/list' });

  // Give server time to respond before closing
  await new Promise((r) => setTimeout(r, 3000));
  proc.stdin.end();
  proc.kill();

  const { responses, exitCode } = await resultPromise;

  const initResp = responses.find((r) => r.id === 1);
  const toolsResp = responses.find((r) => r.id === 2);

  if (!initResp?.result) {
    console.error('FAIL: initialize — no valid response');
    console.error(JSON.stringify(responses, null, 2));
    process.exit(1);
  }

  console.log('PASS: initialize');
  console.log(`  Server: ${initResp.result.serverInfo?.name} v${initResp.result.serverInfo?.version}`);

  if (!toolsResp?.result?.tools?.length) {
    console.error('FAIL: tools/list — no tools returned');
    console.error(JSON.stringify(responses, null, 2));
    process.exit(1);
  }

  const tools = toolsResp.result.tools;
  console.log(`PASS: tools/list — ${tools.length} tools registered`);
  console.log('  Sample tools:');
  for (const t of tools.slice(0, 8)) {
    console.log(`    - ${t.name}`);
  }
  if (tools.length > 8) {
    console.log(`    ... and ${tools.length - 8} more`);
  }

  // Try calling a read-only tool if available
  const diagTool = tools.find((t) => t.name === 'get_server_info' || t.name === 'check_connection');
  if (diagTool) {
    console.log(`\nCalling tool: ${diagTool.name} ...`);
    const proc2 = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      cwd: process.cwd(),
    });
    const result2Promise = readResponses(proc2);
    send(proc2, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-smoke-test', version: '1.0.0' },
      },
    });
    send(proc2, { jsonrpc: '2.0', method: 'notifications/initialized' });
    send(proc2, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: diagTool.name, arguments: {} },
    });
    await new Promise((r) => setTimeout(r, 5000));
    proc2.stdin.end();
    proc2.kill();
    const { responses: r2 } = await result2Promise;
    const callResp = r2.find((r) => r.id === 3);
    if (callResp?.result) {
      console.log(`PASS: tools/call (${diagTool.name})`);
      const text = callResp.result.content?.[0]?.text ?? JSON.stringify(callResp.result).slice(0, 200);
      console.log(`  Result: ${text.slice(0, 300)}`);
    } else {
      console.log(`WARN: tools/call (${diagTool.name}) — no response (may need SolidWorks running)`);
    }
  }

  console.log('\n=== Smoke test complete ===\n');
  process.exit(exitCode === 0 || exitCode === null ? 0 : 1);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});

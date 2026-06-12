#!/usr/bin/env node
/**
 * MCP stdio test for create_hex_socket_screw tool.
 * Usage: node scripts/test-screw-mcp.mjs
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const serverPath = resolve('dist/index.js');
const env = { ...process.env, USE_MOCK_SOLIDWORKS: 'false', LOG_LEVEL: 'error' };

function callTool(proc, id, name, args) {
  proc.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`,
  );
}

async function main() {
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
        // ignore
      }
    }
  });

  let id = 1;
  callTool(proc, id++, 'create_hex_socket_screw', {
    size: 'M3',
    length: 60,
    cosmeticThread: true,
    headChamfer: true,
  });

  const start = Date.now();
  while (Date.now() - start < 120000) {
    const resp = responses.get(1);
    if (resp) {
      const text = resp.result?.content?.[0]?.text ?? JSON.stringify(resp.error);
      console.log(text);
      proc.kill();
      process.exit(text.includes('Created M3') ? 0 : 1);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  console.error('timeout');
  process.exit(1);
}

main();

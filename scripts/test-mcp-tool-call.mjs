#!/usr/bin/env node
/** Quick tool/call test for a single MCP tool */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const toolName = process.argv[2] || 'generate_vba_script';
const defaultArgs = {
  generate_vba_script: { template: 'create_part', parameters: {} },
  create_feature_vba: { featureType: 'extrude', parameters: { depth: 25 } },
};
const toolArgs = process.argv[3]
  ? JSON.parse(process.argv[3])
  : (defaultArgs[toolName] ?? {});

const serverPath = resolve('dist/index.js');
const env = { ...process.env, USE_MOCK_SOLIDWORKS: 'true', LOG_LEVEL: 'error' };

const proc = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'pipe'], env });
const responses = [];
let buffer = '';

proc.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  for (const line of buffer.split('\n')) {
    if (!line.trim()) continue;
    try { responses.push(JSON.parse(line)); } catch { /* skip */ }
  }
  buffer = '';
});

proc.stderr.on('data', (d) => process.stderr.write(d));

function send(msg) { proc.stdin.write(`${JSON.stringify(msg)}\n`); }

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'tool-test', version: '1.0' },
}});
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: toolName, arguments: toolArgs } });

setTimeout(() => { proc.stdin.end(); proc.kill(); }, 8000);

proc.on('close', () => {
  const resp = responses.find((r) => r.id === 2);
  if (resp?.error) {
    console.error('FAIL:', resp.error);
    process.exit(1);
  }
  if (!resp?.result) {
    console.error('FAIL: no response', JSON.stringify(responses, null, 2));
    process.exit(1);
  }
  console.log(`PASS: tools/call (${toolName})`);
  const text = resp.result.content?.[0]?.text ?? JSON.stringify(resp.result);
  console.log(text.slice(0, 800));
  process.exit(0);
});

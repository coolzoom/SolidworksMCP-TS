#!/usr/bin/env node
/**
 * Draw a spur gear in SolidWorks via MCP tools.
 * Specs: bore 8mm, disc OD 20mm, circular pitch 5mm.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const serverPath = resolve('dist/index.js');
const env = {
  ...process.env,
  USE_MOCK_SOLIDWORKS: 'false',
  LOG_LEVEL: 'error',
};

// --- Gear parameters (mm) ---
const BORE_DIAMETER = 8;
const DISC_DIAMETER = 20;
const CIRCULAR_PITCH = 5;
const EXTRUDE_DEPTH = 8;

const boreRadius = BORE_DIAMETER / 2;
const outerRadius = DISC_DIAMETER / 2;
const rootRadius = outerRadius - 2.5; // dedendum ~2.5mm

// Teeth count from pitch at outer circle: z = π*D / p
const numTeeth = Math.max(6, Math.round((Math.PI * DISC_DIAMETER) / CIRCULAR_PITCH));

function buildGearProfilePoints() {
  const pitchAngle = (2 * Math.PI) / numTeeth;
  const toothFraction = 0.48;
  const points = [];

  for (let i = 0; i < numTeeth; i++) {
    const base = i * pitchAngle;
    const halfTooth = (pitchAngle * toothFraction) / 2;

    const angles = [
      base + halfTooth,
      base + halfTooth * 0.75,
      base + pitchAngle - halfTooth * 0.75,
      base + pitchAngle - halfTooth,
    ];
    const radii = [rootRadius, outerRadius, outerRadius, rootRadius];

    for (let j = 0; j < angles.length; j++) {
      points.push({
        x: radii[j] * Math.cos(angles[j]),
        y: radii[j] * Math.sin(angles[j]),
      });
    }
  }

  return points;
}

const gearPoints = buildGearProfilePoints();

function buildLineSteps(startId) {
  const steps = [];
  let id = startId;
  for (let i = 0; i < gearPoints.length; i++) {
    const start = gearPoints[i];
    const end = gearPoints[(i + 1) % gearPoints.length];
    steps.push({
      id: id++,
      tool: 'sketch_line',
      args: {
        start: { x: start.x, y: start.y, z: 0 },
        end: { x: end.x, y: end.y, z: 0 },
        construction: false,
      },
    });
  }
  return { steps, nextId: id };
}

const { steps: lineSteps, nextId } = buildLineSteps(12);

console.log(`Gear: bore=${BORE_DIAMETER}mm, OD=${DISC_DIAMETER}mm, pitch=${CIRCULAR_PITCH}mm`);
console.log(`Teeth: ${numTeeth}, profile segments: ${lineSteps.length}, extrude depth: ${EXTRUDE_DEPTH}mm`);

const steps = [
  { id: 10, tool: 'create_part', args: {} },
  { id: 11, tool: 'create_sketch', args: { plane: 'Front', offset: 0, reverse: false } },
  ...lineSteps,
  {
    id: nextId,
    tool: 'sketch_circle',
    args: { center: { x: 0, y: 0, z: 0 }, radius: boreRadius, construction: false },
  },
  { id: nextId + 1, tool: 'exit_sketch', args: {} },
  {
    id: nextId + 2,
    tool: 'create_extrusion',
    args: { depth: EXTRUDE_DEPTH, draft: 0, reverse: false },
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

async function waitFor(responses, id, timeoutMs = 60000) {
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
  console.log('\n=== Draw Gear in SolidWorks ===\n');

  const { proc, responses, send } = spawnServer();

  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'draw-gear', version: '1.0.0' },
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

    const resp = await waitFor(responses, step.id, 90000);
    const text = resultText(resp);

    if (resp.error || /failed|error/i.test(text)) {
      console.error(`FAIL: ${step.tool}`);
      console.error(text);
      proc.kill();
      process.exit(1);
    }

    console.log(`PASS: ${step.tool}`);
    console.log(`  ${text.slice(0, 500)}`);
  }

  proc.stdin.end();
  proc.kill();

  console.log('\n=== Gear created successfully in SolidWorks ===');
  console.log(`  Center bore: Ø${BORE_DIAMETER} mm`);
  console.log(`  Outer diameter: Ø${DISC_DIAMETER} mm`);
  console.log(`  Circular pitch: ${CIRCULAR_PITCH} mm (${numTeeth} teeth)`);
  console.log(`  Thickness: ${EXTRUDE_DEPTH} mm\n`);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});

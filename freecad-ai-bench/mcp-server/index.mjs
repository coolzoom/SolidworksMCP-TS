#!/usr/bin/env node
/**
 * FreeCAD MCP Server — ISO 4762 screws via FreeCADCmd + Fasteners Workbench.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const benchRoot = process.env.FREECAD_BENCH_ROOT
  ? resolve(process.env.FREECAD_BENCH_ROOT)
  : resolve(__dirname, '..');

const pythonScript = process.env.FREECAD_PYTHON_SCRIPT
  ? resolve(process.env.FREECAD_PYTHON_SCRIPT)
  : join(benchRoot, 'python', 'freecad-iso4762-screw.py');

const outputDir = process.env.FREECAD_OUTPUT_DIR
  ? resolve(process.env.FREECAD_OUTPUT_DIR)
  : join(benchRoot, 'output');

const ISO4762 = {
  M3: { pitch: 0.5, headDiameter: 5.5, headHeight: 3, hexAf: 2.5, hexDepth: 1.5 },
  M4: { pitch: 0.7, headDiameter: 7, headHeight: 4, hexAf: 3, hexDepth: 2 },
  M5: { pitch: 0.8, headDiameter: 8.5, headHeight: 5, hexAf: 4, hexDepth: 2.5 },
  M6: { pitch: 1.0, headDiameter: 10, headHeight: 6, hexAf: 5, hexDepth: 3 },
  M8: { pitch: 1.25, headDiameter: 13, headHeight: 8, hexAf: 6, hexDepth: 4 },
  M10: { pitch: 1.5, headDiameter: 16, headHeight: 10, hexAf: 8, hexDepth: 5 },
};

function findFreeCadCmd() {
  if (process.env.FREECAD_CMD && existsSync(process.env.FREECAD_CMD)) {
    return process.env.FREECAD_CMD;
  }

  const candidates = [
    join(process.env.LOCALAPPDATA || '', 'Programs', 'FreeCAD 1.1', 'bin', 'freecadcmd.exe'),
    join(process.env.LOCALAPPDATA || '', 'Programs', 'FreeCAD 1.1', 'bin', 'FreeCADCmd.exe'),
    join(process.env.ProgramFiles || 'C:\\Program Files', 'FreeCAD 0.21', 'bin', 'FreeCADCmd.exe'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function fastenersInstalled() {
  return existsSync(join(homedir(), 'AppData', 'Roaming', 'FreeCAD', 'v1-1', 'Mod', 'Fasteners'));
}

function runScrewGenerator({ size, length, realThread, outputPath }) {
  const freecadCmd = findFreeCadCmd();
  if (!freecadCmd) {
    return { success: false, error: 'FreeCADCmd not found. Install FreeCAD or set FREECAD_CMD.' };
  }
  if (!existsSync(pythonScript)) {
    return { success: false, error: `Python script missing: ${pythonScript}` };
  }

  mkdirSync(dirname(outputPath), { recursive: true });

  const env = {
    ...process.env,
    SCREW_SIZE: size,
    SCREW_LENGTH: String(length),
    SCREW_THREAD: realThread ? 'real' : 'simple',
    SCREW_OUTPUT: outputPath,
  };

  const result = spawnSync(freecadCmd, [pythonScript], {
    env,
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 300000,
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    return { success: false, error: output.trim() || `FreeCADCmd exited with code ${result.status}` };
  }

  const stepPath = outputPath.replace(/\.FCStd$/i, '.step');
  if (!existsSync(outputPath)) {
    return { success: false, error: `Expected output missing: ${outputPath}\n${output}` };
  }

  return {
    success: true,
    fcstd: outputPath,
    step: existsSync(stepPath) ? stepPath : undefined,
    log: output.trim(),
  };
}

const server = new Server(
  {
    name: 'freecad-mcp-server',
    version: '1.0.0',
    description: 'FreeCAD MCP — ISO 4762 hex socket screws with Fasteners Workbench real threads',
  },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_freecad_status',
      description: 'Check FreeCADCmd, Fasteners Workbench, and script paths',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_standard_screws',
      description: 'List supported ISO 4762 hex socket head cap screw sizes',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_hex_socket_screw',
      description:
        'Create ISO 4762 hex socket head cap screw in FreeCAD with real metric thread (Fasteners Workbench)',
      inputSchema: {
        type: 'object',
        properties: {
          size: {
            type: 'string',
            description: 'Thread size: M3, M4, M5, M6, M8, M10',
            default: 'M3',
          },
          length: {
            type: 'number',
            description: 'Shank length under head in mm (non-standard lengths use Custom)',
          },
          realThread: {
            type: 'boolean',
            description: 'Generate real ISO thread via Fasteners (default true)',
            default: true,
          },
          outputName: {
            type: 'string',
            description: 'Optional output base name (without extension)',
          },
        },
        required: ['length'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === 'get_freecad_status') {
      const freecadCmd = findFreeCadCmd();
      const lines = [
        `Bench root: ${benchRoot}`,
        `Python script: ${pythonScript} (${existsSync(pythonScript) ? 'OK' : 'MISSING'})`,
        `Output dir: ${outputDir}`,
        `FreeCADCmd: ${freecadCmd ?? 'NOT FOUND'}`,
        `Fasteners Workbench: ${fastenersInstalled() ? 'installed' : 'NOT INSTALLED'}`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    if (name === 'list_standard_screws') {
      const rows = Object.entries(ISO4762).map(
        ([k, s]) =>
          `${k}: pitch ${s.pitch}mm, head Ø${s.headDiameter}×${s.headHeight}mm, hex AF ${s.hexAf}mm depth ${s.hexDepth}mm`,
      );
      return {
        content: [{ type: 'text', text: `Supported ISO 4762 sizes:\n${rows.join('\n')}` }],
      };
    }

    if (name === 'create_hex_socket_screw') {
      const size = String(args.size ?? 'M3').toUpperCase();
      const length = Number(args.length);
      const realThread = args.realThread !== false;

      if (!ISO4762[size]) {
        return {
          content: [{ type: 'text', text: `Unsupported size ${size}. Use: ${Object.keys(ISO4762).join(', ')}` }],
          isError: true,
        };
      }
      if (!Number.isFinite(length) || length <= 0) {
        return { content: [{ type: 'text', text: 'length must be a positive number (mm)' }], isError: true };
      }

      const suffix = realThread ? 'iso4762_threaded' : 'iso4762';
      const lenLabel = Number.isInteger(length) ? String(length) : String(length).replace('.', '_');
      const base = args.outputName ?? `${size}x${lenLabel}`;
      const outputPath = join(outputDir, `${base}_${suffix}.FCStd`);

      const result = runScrewGenerator({ size, length, realThread, outputPath });
      if (!result.success) {
        return { content: [{ type: 'text', text: result.error }], isError: true };
      }

      const lines = [
        `Created ${size}×${length} hex socket head cap screw (${realThread ? 'real thread' : 'simple'})`,
        `  FCStd: ${result.fcstd}`,
      ];
      if (result.step) lines.push(`  STEP:  ${result.step}`);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Tool error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
});

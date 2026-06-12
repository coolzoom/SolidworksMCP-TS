#!/usr/bin/env node
/**
 * Configure FreeCAD MCP Server in Cursor.
 *
 * Usage:
 *   node freecad-ai-bench/scripts/configure-freecad-mcp.mjs [--cursor-scope global|project|both]
 */

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const benchRoot = resolve(scriptDir, '..');
const repoRoot = resolve(benchRoot, '..');

function parseArgs(argv) {
  let cursorScope = 'both';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cursor-scope') {
      cursorScope = argv[++i] ?? 'both';
      if (!['global', 'project', 'both'].includes(cursorScope)) {
        console.error(`Invalid --cursor-scope: ${cursorScope}`);
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node configure-freecad-mcp.mjs [--cursor-scope global|project|both]');
      process.exit(0);
    }
  }
  return { cursorScope };
}

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function toForwardSlash(p) {
  return p.replace(/\\/g, '/');
}

function toWindowsEnvPath(p) {
  return process.platform === 'win32' ? p.replace(/\//g, '\\') : p;
}

async function main() {
  const { cursorScope } = parseArgs(process.argv.slice(2));
  const entrypoint = resolve(benchRoot, 'mcp-server', 'index.mjs');

  if (!existsSync(entrypoint)) {
    console.error(`[FAIL] FreeCAD MCP entrypoint not found: ${entrypoint}`);
    process.exit(1);
  }

  let nodeCommand = 'node';
  const programFilesNode = join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe');
  if (existsSync(programFilesNode)) {
    nodeCommand = toForwardSlash(programFilesNode);
  }

  const mcpEntry = {
    command: nodeCommand,
    args: [toForwardSlash(entrypoint)],
    env: {
      FREECAD_BENCH_ROOT: toWindowsEnvPath(toForwardSlash(benchRoot)),
      FREECAD_PYTHON_SCRIPT: toWindowsEnvPath(toForwardSlash(join(benchRoot, 'python', 'freecad-iso4762-screw.py'))),
      FREECAD_OUTPUT_DIR: toWindowsEnvPath(toForwardSlash(join(benchRoot, 'output'))),
      NODE_PATH: toWindowsEnvPath(toForwardSlash(join(repoRoot, 'node_modules'))),
      LOG_LEVEL: 'info',
    },
  };

  const targets = [];
  if (cursorScope === 'global' || cursorScope === 'both') {
    targets.push({ path: join(homedir(), '.cursor', 'mcp.json'), label: 'Cursor global' });
  }
  if (cursorScope === 'project' || cursorScope === 'both') {
    targets.push({ path: join(repoRoot, '.cursor', 'mcp.json'), label: 'Cursor project' });
  }

  console.log('');
  console.log('FreeCAD MCP configuration');
  console.log(`  Bench:      ${benchRoot}`);
  console.log(`  Entrypoint: ${entrypoint}`);
  console.log(`  Node:       ${nodeCommand}`);
  console.log('');

  let configured = 0;
  for (const target of targets) {
    try {
      let config = {};
      if (await fileExists(target.path)) {
        config = JSON.parse(await fs.readFile(target.path, 'utf-8'));
      } else {
        await fs.mkdir(dirname(target.path), { recursive: true });
      }
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers.freecad = mcpEntry;
      await fs.writeFile(target.path, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
      console.log(`  [OK] ${target.label}: ${target.path}`);
      configured++;
    } catch (err) {
      console.log(`  [WARN] Skipped ${target.label}: ${target.path} (${err.message})`);
    }
  }

  if (configured === 0) {
    console.error('Could not write any Cursor MCP config files.');
    process.exit(1);
  }

  console.log('');
  console.log('Restart Cursor (or MCP: Reload Servers) to enable the freecad MCP server.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

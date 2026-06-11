#!/usr/bin/env node
/**
 * Configure SolidWorks MCP Server in Claude Desktop and/or Cursor.
 *
 * Usage:
 *   node scripts/configure-mcp.mjs [--client claude|cursor|both] [--project-dir <path>]
 */

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function parseArgs(argv) {
  let client = 'both';
  let projectDir = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--client') {
      client = argv[++i] ?? '';
      if (!['claude', 'cursor', 'both'].includes(client)) {
        console.error(`Invalid --client value: ${client} (use claude, cursor, or both)`);
        process.exit(1);
      }
    } else if (arg === '--project-dir') {
      projectDir = resolve(argv[++i] ?? '');
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/configure-mcp.mjs [--client claude|cursor|both] [--project-dir <path>]');
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  return { client, projectDir };
}

function detectSolidWorksPath() {
  const candidates = [
    join(process.env['ProgramFiles'] || 'C:\\Program Files', 'SOLIDWORKS Corp', 'SOLIDWORKS'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'SOLIDWORKS Corp', 'SOLIDWORKS'),
    'C:/Program Files/SOLIDWORKS Corp/SOLIDWORKS',
  ];

  for (const dir of candidates) {
    try {
      if (existsSync(join(dir, 'SLDWORKS.exe'))) {
        return dir.replace(/\\/g, '/');
      }
    } catch {
      // continue
    }
  }

  return 'C:/Program Files/SOLIDWORKS Corp/SOLIDWORKS';
}

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadDotEnv(projectDir) {
  const vars = {};
  try {
    const content = await fs.readFile(join(projectDir, '.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) vars[m[1].trim()] = m[2].trim();
    }
  } catch {
    // no .env
  }
  return vars;
}

async function main() {
  const { client, projectDir } = parseArgs(process.argv.slice(2));
  const dotEnv = await loadDotEnv(projectDir);
  const entrypoint = resolve(projectDir, 'dist', 'index.js').replace(/\\/g, '/');

  const swPath = (dotEnv.SOLIDWORKS_PATH || detectSolidWorksPath()).replace(/\\/g, '/');
  const swPathForEnv = process.platform === 'win32' ? swPath.replace(/\//g, '\\') : swPath;
  const swVersion = dotEnv.SOLIDWORKS_VERSION || '2024';

  let nodeCommand = 'node';
  if (dotEnv.NODE_WINAX_PATH) {
    const nodeExe = join(dotEnv.NODE_WINAX_PATH.replace(/\//g, '\\'), 'node.exe');
    if (existsSync(nodeExe)) {
      nodeCommand = nodeExe.replace(/\\/g, '/');
    }
  }

  const mcpEntry = {
    command: nodeCommand,
    args: [entrypoint],
    env: {
      SOLIDWORKS_PATH: swPathForEnv,
      SOLIDWORKS_VERSION: swVersion,
      ADAPTER_TYPE: 'winax-enhanced',
      LOG_LEVEL: 'info',
    },
  };

  const targets = [];

  if (client === 'claude' || client === 'both') {
    targets.push(
      join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    );
  }

  if (client === 'cursor' || client === 'both') {
    targets.push(join(homedir(), '.cursor', 'mcp.json'));
  }

  let configured = 0;

  for (const configPath of targets) {
    try {
      let config = {};
      if (await fileExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(content);
      } else {
        await fs.mkdir(dirname(configPath), { recursive: true });
      }

      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers.solidworks = mcpEntry;

      await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
      console.log(`  [OK] Updated: ${configPath}`);
      configured++;
    } catch (err) {
      console.log(`  [WARN] Skipped: ${configPath} (${err.message})`);
    }
  }

  if (configured === 0) {
    console.log('');
    console.log('Could not auto-configure any MCP client. Add manually:');
    console.log(JSON.stringify({ mcpServers: { solidworks: mcpEntry } }, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

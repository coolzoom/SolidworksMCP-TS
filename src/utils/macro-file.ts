import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Write a plain-text .swp macro file (same format used by extrusion/revolve fallbacks). */
export function writeTextMacroFile(macroPath: string, moduleName: string, vbaBody: string): string {
  let path = macroPath;
  if (!path.toLowerCase().endsWith('.swp')) {
    path = `${path.replace(/\.[^.]*$/, '')}.swp`;
  }

  mkdirSync(dirname(path), { recursive: true });

  const body = vbaBody.trimStart();
  const hasOptionExplicit = /^Option\s+Explicit/m.test(body);
  const hasAttribute = /^Attribute\s+VB_Name/m.test(body);
  const lines: string[] = [];

  if (!hasAttribute) {
    lines.push(`Attribute VB_Name = "${moduleName}"`);
  }
  if (!hasOptionExplicit) {
    lines.push('Option Explicit');
    lines.push('');
  }
  lines.push(body);

  writeFileSync(path, `${lines.join('\n')}\n`, 'utf-8');
  return path;
}

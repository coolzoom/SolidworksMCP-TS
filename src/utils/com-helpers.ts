/**
 * Helpers for SolidWorks COM interop via winax.
 */

/** Coerce COM VARIANT / unknown values to a finite number. */
export function coerceComNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (value != null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record) {
      return coerceComNumber(record.value, fallback);
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** RunMacro2 with required error out-parameter for winax COM bindings. */
export function runMacro2(
  swApp: any,
  macroPath: string,
  moduleName: string,
  procedureName: string,
  unloadAfterRun = true
): boolean {
  const runOption = unloadAfterRun ? 1 : 0;
  try {
    return Boolean(swApp.RunMacro2(macroPath, moduleName, procedureName, runOption, 0));
  } catch (_e) {
    try {
      return Boolean(swApp.RunMacro(macroPath, moduleName, procedureName));
    } catch {
      return false;
    }
  }
}

import { describe, expect, it } from 'vitest';
import { coerceComNumber, runMacro2 } from '../com-helpers.js';

describe('coerceComNumber', () => {
  it('returns finite numbers unchanged', () => {
    expect(coerceComNumber(3.14)).toBe(3.14);
  });

  it('coerces numeric strings', () => {
    expect(coerceComNumber('2.5')).toBe(2.5);
  });

  it('reads COM variant .value', () => {
    expect(coerceComNumber({ value: 42 })).toBe(42);
  });

  it('returns fallback for invalid values', () => {
    expect(coerceComNumber(undefined, 7)).toBe(7);
    expect(coerceComNumber('not-a-number', 0)).toBe(0);
  });
});

describe('runMacro2', () => {
  it('passes error out-parameter to RunMacro2', () => {
    const calls: unknown[] = [];
    const swApp = {
      RunMacro2: (...args: unknown[]) => {
        calls.push(args);
        return true;
      },
    };

    expect(runMacro2(swApp, 'C:\\test.swp', 'Module1', 'main', true)).toBe(true);
    expect(calls[0]).toEqual(['C:\\test.swp', 'Module1', 'main', 1, 0]);
  });
});

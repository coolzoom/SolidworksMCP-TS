import { describe, expect, it } from 'vitest';
import { getIso4762Spec, ISO4762_SCREWS } from '../standards/iso4762.js';

describe('ISO4762 screw standards', () => {
  it('should resolve M3 spec', () => {
    const spec = getIso4762Spec('M3');
    expect(spec.threadSize).toBe('M3x0.5');
    expect(spec.headDiameter).toBe(5.5);
    expect(spec.hexAf).toBe(2.5);
  });

  it('should reject unknown sizes', () => {
    expect(() => getIso4762Spec('M99')).toThrow(/Unsupported screw size/);
  });

  it('should include common sizes', () => {
    expect(Object.keys(ISO4762_SCREWS)).toEqual(expect.arrayContaining(['M3', 'M6', 'M10']));
  });
});

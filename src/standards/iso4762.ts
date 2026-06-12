/**
 * ISO 4762 Hex socket head cap screw dimensions (mm).
 * Values are nominal; suitable for simplified CAD models.
 */

export interface HexSocketScrewSpec {
  /** e.g. "M3" */
  designation: string;
  /** Thread major diameter (mm) */
  nominalDiameter: number;
  /** Thread pitch (mm) */
  pitch: number;
  /** Cosmetic thread callout size string for SolidWorks */
  threadSize: string;
  /** Head diameter dk (mm) */
  headDiameter: number;
  /** Head height k (mm) */
  headHeight: number;
  /** Socket width across flats s (mm) */
  hexAf: number;
  /** Socket depth t (mm) */
  hexDepth: number;
  /** Default head top edge chamfer (mm) */
  defaultHeadChamfer: number;
}

/** ISO 4762 lookup table (common sizes). */
export const ISO4762_SCREWS: Record<string, HexSocketScrewSpec> = {
  M3: {
    designation: 'M3',
    nominalDiameter: 3,
    pitch: 0.5,
    threadSize: 'M3x0.5',
    headDiameter: 5.5,
    headHeight: 3,
    hexAf: 2.5,
    hexDepth: 1.5,
    defaultHeadChamfer: 0.2,
  },
  M4: {
    designation: 'M4',
    nominalDiameter: 4,
    pitch: 0.7,
    threadSize: 'M4x0.7',
    headDiameter: 7,
    headHeight: 4,
    hexAf: 3,
    hexDepth: 2,
    defaultHeadChamfer: 0.25,
  },
  M5: {
    designation: 'M5',
    nominalDiameter: 5,
    pitch: 0.8,
    threadSize: 'M5x0.8',
    headDiameter: 8.5,
    headHeight: 5,
    hexAf: 4,
    hexDepth: 2.5,
    defaultHeadChamfer: 0.3,
  },
  M6: {
    designation: 'M6',
    nominalDiameter: 6,
    pitch: 1,
    threadSize: 'M6x1',
    headDiameter: 10,
    headHeight: 6,
    hexAf: 5,
    hexDepth: 3,
    defaultHeadChamfer: 0.35,
  },
  M8: {
    designation: 'M8',
    nominalDiameter: 8,
    pitch: 1.25,
    threadSize: 'M8x1.25',
    headDiameter: 13,
    headHeight: 8,
    hexAf: 6,
    hexDepth: 4,
    defaultHeadChamfer: 0.4,
  },
  M10: {
    designation: 'M10',
    nominalDiameter: 10,
    pitch: 1.5,
    threadSize: 'M10x1.5',
    headDiameter: 16,
    headHeight: 10,
    hexAf: 8,
    hexDepth: 5,
    defaultHeadChamfer: 0.5,
  },
};

export function getIso4762Spec(size: string): HexSocketScrewSpec {
  const key = size.toUpperCase().replace(/^M(\d)$/, 'M$1');
  const spec = ISO4762_SCREWS[key];
  if (!spec) {
    const supported = Object.keys(ISO4762_SCREWS).join(', ');
    throw new Error(`Unsupported screw size "${size}". Supported: ${supported}`);
  }
  return spec;
}

export function mmToMeters(mm: number): number {
  return mm / 1000;
}

import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const Variant = winax.Variant;
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);

const feat = model.FeatureByPositionReverse(0);
const sketchName = feat.Name;
model.ClearSelection2(true);
feat.Select2(false, 0);

const axisName = `Line1@${sketchName}`;
const calloutVariants = [
  ['undefined', undefined],
  ['null', null],
  ['Variant()', new Variant()],
  ['Variant(null)', new Variant(null)],
  ['0', 0],
];

console.log('=== SelectByID2 callout variants ===');
for (const [label, callout] of calloutVariants) {
  try {
    model.ClearSelection2(true);
    feat.Select2(false, 0);
    const ok = model.Extension.SelectByID2(axisName, 'SKETCHSEGMENT', 0, 0, 0, true, 16, callout, 0);
    console.log(`callout=${label} =>`, ok);
    if (ok) {
      const rev = model.FeatureManager.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
      console.log('  FeatureRevolve =>', rev?.Name ?? rev);
    }
  } catch (e) {
    console.log(`callout=${label} ERR`, String(e).split('\n')[0]);
  }
}

// Try fewer parameters (optional trailing)
console.log('\n=== SelectByID2 param counts ===');
try {
  model.ClearSelection2(true);
  feat.Select2(false, 0);
  const ok = model.Extension.SelectByID2(axisName, 'SKETCHSEGMENT', 0, 0, 0, true, 16);
  console.log('7 params =>', ok);
} catch (e) {
  console.log('7 params ERR', String(e).split('\n')[0]);
}

// FeatureRevolve param sweeps (sketch only)
console.log('\n=== FeatureRevolve param counts ===');
const revolveTries = [
  [false, false, Math.PI * 2, 0, false, false, false, true],
  [false, Math.PI * 2, 0, true, false, false, true],
  [true, false, false, Math.PI * 2, 0, 0, 0, 0, 0, 0, true],
];
for (const args of revolveTries) {
  try {
    model.ClearSelection2(true);
    feat.Select2(false, 0);
    const rev = model.FeatureManager.FeatureRevolve(...args);
    console.log(`FeatureRevolve(${args.length}) =>`, rev?.Name ?? rev);
  } catch (e) {
    console.log(`FeatureRevolve(${args.length}) ERR`, String(e).split('\n')[0]);
  }
}

console.log('done');

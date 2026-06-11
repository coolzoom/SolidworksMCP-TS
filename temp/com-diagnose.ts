import { loadWinax } from '../src/adapters/winax-loader.js';

const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const swModel = swApp.ActiveDoc;

if (!swModel) {
  console.log('No active doc - open Part6 with circle sketch first');
  process.exit(1);
}

console.log('Doc:', swModel.GetTitle());

const sm = swModel.SketchManager;
if (sm?.ActiveSketch) sm.InsertSketch(true);
swModel.ClearSelection2(true);

const feat = swModel.FeatureByPositionReverse(0);
console.log('Latest feature:', feat?.Name, feat?.GetTypeName2?.());
feat.Select2(false, 0);

const depth = 0.05;
const fm = swModel.FeatureManager;

const attempts: Array<{ name: string; run: () => unknown }> = [
  {
    name: 'FeatureExtrusion3(23)',
    run: () =>
      fm.FeatureExtrusion3(
        true,
        false,
        false,
        0,
        0,
        depth,
        0,
        false,
        false,
        false,
        false,
        0,
        0,
        false,
        false,
        false,
        false,
        true,
        true,
        true,
        0,
        0,
        false
      ),
  },
  {
    name: 'FeatureExtrusion spread',
    run: () => fm.FeatureExtrusion(true, false, false, 0, 0, depth, 0, false, false, false, false, 0, 0),
  },
  {
    name: 'FeatureRevolve2(12)',
    run: () => fm.FeatureRevolve2(true, false, false, false, false, Math.PI * 2, 0, 0, 0, 0, 0, true),
  },
];

for (const attempt of attempts) {
  try {
    swModel.ClearSelection2(true);
    feat.Select2(false, 0);
    const result = attempt.run();
    console.log(`OK  ${attempt.name}:`, result?.Name ?? result);
  } catch (e) {
    console.log(`ERR ${attempt.name}:`, e);
  }
}

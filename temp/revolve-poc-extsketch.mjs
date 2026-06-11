import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);

const feat = model.FeatureByPositionReverse(0);
const sketchName = feat.GetName?.() ?? 'Sketch1';
console.log('Sketch:', sketchName);

model.ClearSelection2(true);
feat.Select2(false, 0);

for (const type of ['EXTSKETCHSEGMENT', 'SKETCHSEGMENT']) {
  try {
    model.ClearSelection2(true);
    feat.Select2(false, 0);
    const ok = model.Extension.SelectByID2(`Line1@${sketchName}`, type, 0, 0, 0, true, 16, undefined, 0);
    console.log(`SelectByID2 ${type} =>`, ok);
  } catch (e) {
    console.log(`SelectByID2 ${type} ERR`, String(e).split('\n')[0]);
  }
}

const fm = model.FeatureManager;
const angle = Math.PI * 2;
const revolveTries = [
  ['FeatureRevolve(8)', () => fm.FeatureRevolve(false, false, angle, 0, false, false, false, true)],
  ['FeatureRevolve2(12a)', () => fm.FeatureRevolve2(true, false, false, false, false, angle, 0, 0, 0, 0, 0, true)],
  ['FeatureRevolve2(12b)', () => fm.FeatureRevolve2(false, false, false, false, false, angle, 0, 0, 0, 0, 0, true)],
];

for (const [name, fn] of revolveTries) {
  try {
    const rev = fn();
    console.log(name, '=>', rev?.Name ?? rev ?? 'null');
  } catch (e) {
    console.log(name, 'ERR', String(e).split('\n')[0]);
  }
}

console.log('done');

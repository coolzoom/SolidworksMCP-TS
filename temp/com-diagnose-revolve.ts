import { loadWinax } from '../src/adapters/winax-loader.js';
import { SolidWorksConfig } from '../src/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
swApp.Visible = true;

const template = SolidWorksConfig.getTemplatePath(swApp, 'part');
const model = swApp.NewDocument(template, 0, 0, 0);
console.log('Part:', model.GetTitle());

model.ClearSelection2(true);
model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);

model.ClearSelection2(true);
const feat = model.FeatureByPositionReverse(0);
feat.Select2(false, 0);
console.log('Sketch:', feat.Name);

const fm = model.FeatureManager;
const angle = Math.PI * 2;
const tries = [
  ['FeatureRevolve2(12a)', () => fm.FeatureRevolve2(true, false, false, false, false, angle, 0, 0, 0, 0, 0, true)],
  ['FeatureRevolve2(12b)', () => fm.FeatureRevolve2(true, false, false, false, false, angle, 0, 0, 0, 0, 0, true)],
  ['FeatureRevolve2(10 VBA)', () => fm.FeatureRevolve2(false, false, angle, 0, 0, 0, true, true, 0, 0)],
  ['FeatureRevolve', () => fm.FeatureRevolve(false, false, angle, 0, false, false, false, true)],
];

for (const [name, fn] of tries) {
  try {
    model.ClearSelection2(true);
    feat.Select2(false, 0);
    const f = fn();
    console.log(name, '=>', f?.Name ?? f);
  } catch (e) {
    console.log(name, 'ERR', String(e).split('\n')[0]);
  }
}

try {
  model.ClearSelection2(true);
  feat.Select2(false, 0);
  const sketch = feat.GetSpecificFeature2();
  const segs = sketch.GetSketchSegments();
  for (let i = 1; i <= segs.Count; i++) {
    const seg = segs.Item(i);
    if (seg.ConstructionGeometry) {
      console.log('Select4 axis =>', seg.Select4(true, undefined));
      break;
    }
  }
  const rev = fm.FeatureRevolve(false, false, angle, 0, false, false, false, true);
  console.log('FeatureRevolve+axis =>', rev?.Name ?? rev);
} catch (e) {
  console.log('FeatureRevolve+axis ERR', String(e).split('\n')[0]);
}

// Cylinder extrusion test
const model2 = swApp.NewDocument(template, 0, 0, 0);
model2.ClearSelection2(true);
model2.SketchManager.InsertSketch(true);
model2.SketchManager.CreateCircleByRadius(0, 0, 0, R);
model2.SketchManager.InsertSketch(true);
model2.ClearSelection2(true);
model2.FeatureByPositionReverse(0).Select2(false, 0);
try {
  const ex = model2.FeatureManager.FeatureExtrusion3(
    true, false, false, 0, 0, 0.05, 0,
    false, false, false, false, 0, 0,
    false, false, false, false, true, true, true, 0, 0, false
  );
  console.log('Cylinder extrude =>', ex?.Name ?? ex);
} catch (e) {
  console.log('Cylinder extrude ERR', e);
}

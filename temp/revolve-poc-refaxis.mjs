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

const sketch = model.FeatureByPositionReverse(0);
let rightPlane, frontPlane, topPlane;
for (let i = 0; i < model.GetFeatureCount(); i++) {
  const f = model.FeatureByPositionReverse(i);
  if (f.Name === 'Right Plane') rightPlane = f;
  if (f.Name === 'Front Plane') frontPlane = f;
  if (f.Name === 'Top Plane') topPlane = f;
}

const fm = model.FeatureManager;
const md = model;

const axisMethods = [
  () => fm.InsertRefAxis(2, 0, 0, 0, 0, undefined, 0),
  () => fm.InsertReferenceAxis(2, 0, 0, 0, 0, undefined, 0),
  () => md.InsertAxis2(true, false),
  () => fm.InsertAxis2(true, false),
  () => fm.FeatureRevolve2(false, false, Math.PI * 2, 0, 0, 0, true, true, 0, 0),
];

function selectPlanes() {
  model.ClearSelection2(true);
  rightPlane.Select2(false, 0);
  frontPlane.Select2(true, 1);
}

function selectSketchAndYAxis() {
  model.ClearSelection2(true);
  sketch.Select2(false, 0);
  // Y axis = intersection of Front and Right planes
  rightPlane.Select2(true, 16);
}

for (const name of ['InsertRefAxis', 'InsertReferenceAxis', 'InsertAxis2']) {
  console.log(`fm.${name} exists:`, typeof fm[name]);
  console.log(`md.${name} exists:`, typeof md[name]);
}

console.log('\n=== Two-plane ref axis ===');
try {
  selectPlanes();
  const axis = fm.InsertRefAxis(2, 0, 0, 0, 0, undefined, 0);
  console.log('InsertRefAxis =>', axis?.Name ?? axis);
} catch (e) {
  console.log('InsertRefAxis ERR', String(e).split('\n')[0]);
}

console.log('\n=== InsertAxis2 after plane intersection selection ===');
try {
  selectPlanes();
  const axis = md.InsertAxis2(true, false);
  console.log('InsertAxis2 =>', axis?.Name ?? axis);
} catch (e) {
  console.log('InsertAxis2 ERR', String(e).split('\n')[0]);
}

console.log('\n=== Revolve with sketch + two planes as axis hint ===');
try {
  model.ClearSelection2(true);
  sketch.Select2(false, 0);
  rightPlane.Select2(true, 16);
  frontPlane.Select2(true, 16);
  const rev = fm.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
  console.log('FeatureRevolve =>', rev?.Name ?? rev);
} catch (e) {
  console.log('FeatureRevolve ERR', String(e).split('\n')[0]);
}

console.log('done');

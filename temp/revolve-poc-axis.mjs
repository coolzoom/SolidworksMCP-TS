import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

console.log('=== Default feature tree ===');
const count = model.GetFeatureCount();
for (let i = 0; i < Math.min(count, 25); i++) {
  const f = model.FeatureByPositionReverse(i);
  console.log(i, f?.Name, f?.GetTypeName2?.());
}

model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);

console.log('\n=== After sketch ===');
for (let i = 0; i < Math.min(model.GetFeatureCount(), 25); i++) {
  const f = model.FeatureByPositionReverse(i);
  console.log(i, f?.Name, f?.GetTypeName2?.());
}

// Try Select2 on RefAxis / Origin features
console.log('\n=== Try Select2 on tree features for revolve ===');
const sketchFeat = model.FeatureByPositionReverse(0);
model.ClearSelection2(true);
sketchFeat.Select2(false, 0);

for (let i = 1; i < Math.min(model.GetFeatureCount(), 25); i++) {
  const f = model.FeatureByPositionReverse(i);
  const type = f?.GetTypeName2?.() ?? '';
  if (!type.toLowerCase().includes('origin') && !type.toLowerCase().includes('axis') && !type.toLowerCase().includes('plane')) continue;
  try {
    model.ClearSelection2(true);
    sketchFeat.Select2(false, 0);
    const sel = f.Select2(true, 16);
    console.log(`Select2 ${f.Name} (${type}) mark16 =>`, sel);
    const rev = model.FeatureManager.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
    console.log('  FeatureRevolve =>', rev?.Name ?? rev);
    if (rev) break;
  } catch (e) {
    console.log(`Select2 ${f?.Name} ERR`, String(e).split('\n')[0]);
  }
}

// InsertRefAxis - one plane + linear edge?
console.log('\n=== InsertRefAxis attempts ===');
const fm = model.FeatureManager;
for (const args of [
  [0, 0, 0, 0, 0, undefined, 0],
  [1, 0, 0, 0, 0, undefined, 0],
  [2, 0, 0, 0, 0, undefined, 0],
]) {
  try {
    model.ClearSelection2(true);
    sketchFeat.Select2(false, 0);
    const axis = fm.InsertRefAxis(...args);
    console.log('InsertRefAxis', args[0], '=>', axis?.Name ?? axis);
    if (axis) {
      model.ClearSelection2(true);
      sketchFeat.Select2(false, 0);
      axis.Select2(true, 16);
      const rev = fm.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
      console.log('  FeatureRevolve =>', rev?.Name ?? rev);
    }
  } catch (e) {
    console.log('InsertRefAxis', args[0], 'ERR', String(e).split('\n')[0]);
  }
}

console.log('done');

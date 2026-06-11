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

model.ClearSelection2(true);
model.FeatureByPositionReverse(0).Select2(false, 0);

const beforeCount = model.GetFeatureCount();
console.log('Features before:', beforeCount);

// swCommands from SolidWorks API (partial list)
const cmdIds = [
  35, 858, 859, 760, 761, 3534,
  360, 361, 362, 363, 364, 365,
  580, 581, 582, 583,
  2, 3, 4, 5,
  32805, 32806,
  879, 880, 881,
  124, 125, 126,
];

for (const id of cmdIds) {
  try {
    model.ClearSelection2(true);
    model.FeatureByPositionReverse(0).Select2(false, 0);
    const ok = swApp.RunCommand(id, '');
    const afterCount = model.GetFeatureCount();
    const latest = model.FeatureByPositionReverse(0);
    const type = latest?.GetTypeName2?.() ?? '?';
    const name = latest?.Name ?? '?';
    if (ok || afterCount > beforeCount || type.toLowerCase().includes('revol')) {
      console.log(`RunCommand(${id}) ok=${ok} features=${afterCount} latest=${name} type=${type}`);
    }
  } catch (e) {
    // silent for most failures
  }
}

console.log('Features after:', model.GetFeatureCount());
console.log('done');

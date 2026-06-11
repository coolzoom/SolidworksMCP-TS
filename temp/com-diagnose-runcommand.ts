import { loadWinax } from '../src/adapters/winax-loader.js';
import { SolidWorksConfig } from '../src/utils/solidworks-config.js';

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

const cmdIds = [858, 859, 760, 761, 3534, 35];
for (const id of cmdIds) {
  try {
    const ok = swApp.RunCommand(id, '');
    console.log('RunCommand', id, '=>', ok);
    const latest = model.FeatureByPositionReverse(0)?.GetTypeName2?.();
    console.log('  latest feature:', latest, model.FeatureByPositionReverse(0)?.Name);
  } catch (e) {
    console.log('RunCommand', id, 'ERR', String(e).split('\n')[0]);
  }
}

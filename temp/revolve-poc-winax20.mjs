import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const angle = Math.PI * 2;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);
if (!model) { console.log('NewDocument failed'); process.exit(1); }

model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);

model.ClearSelection2(true);
model.FeatureByPositionReverse(0).Select2(false, 0);

const fm = model.FeatureManager;
try {
  const rev = fm.FeatureRevolve2(
    true, true, false, false, false, false,
    0, 0, angle, 0,
    false, false, 0, 0,
    0, 0, 0,
    true, false, true,
  );
  console.log('winax 20-param no axis =>', rev?.Name ?? rev ?? 'null');
} catch (e) {
  console.log('ERR', String(e).split('\n')[0]);
}

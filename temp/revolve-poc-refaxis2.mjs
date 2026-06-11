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
const planes = [];
for (let i = 0; i < model.GetFeatureCount(); i++) {
  const f = model.FeatureByPositionReverse(i);
  const type = f?.GetTypeName2?.() ?? '';
  console.log('feat', i, JSON.stringify(f?.Name), type);
  if (type === 'RefPlane') planes.push(f);
}

console.log('RefPlanes found:', planes.length);

// Front sketch on default Front plane - revolve axis is normal to Front = Z? 
// Actually sphere workflow uses Front plane sketch with vertical centerline = Y axis in sketch coords
// Use first two default planes to create axis via InsertAxis2

if (planes.length >= 2) {
  try {
    model.ClearSelection2(true);
    planes[0].Select2(false, 0);
    planes[1].Select2(true, 1);
    const axis = model.InsertAxis2(true, false);
    console.log('InsertAxis2 =>', axis?.Name ?? axis, axis?.GetTypeName2?.());
    if (axis) {
      model.ClearSelection2(true);
      sketch.Select2(false, 0);
      axis.Select2(true, 16);
      const rev = model.FeatureManager.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
      console.log('FeatureRevolve =>', rev?.Name ?? rev);
    }
  } catch (e) {
    console.log('InsertAxis2/revolve ERR', String(e).split('\n')[0]);
  }
}

console.log('done');

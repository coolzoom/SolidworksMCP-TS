import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

// Test GetSketchSegments IN sketch edit mode (before exit)
model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);

console.log('In sketch edit mode...');
try {
  const active = model.SketchManager.ActiveSketch;
  console.log('ActiveSketch', !!active);
  const segs = active.GetSketchSegments();
  console.log('ActiveSketch.GetSketchSegments count', segs?.Count ?? segs?.length);
  if (segs?.Count) {
    for (let i = 1; i <= segs.Count; i++) {
      const seg = segs.Item(i);
      console.log(` seg ${i} construction=${seg.ConstructionGeometry}`);
      if (seg.ConstructionGeometry) {
        try {
          console.log(' Select4 =>', seg.Select4(true, undefined));
        } catch (e) {
          console.log(' Select4 ERR', String(e).split('\n')[0]);
        }
      }
    }
  }
} catch (e) {
  console.log('ActiveSketch segments ERR', String(e).split('\n')[0]);
}

model.SketchManager.InsertSketch(true);
console.log('Exited sketch');

// Alternative: semicircle as closed profile using lines (no construction axis)
model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.CreateLine(-R, 0, 0, R, 0, 0); // diameter
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, R, 0); // semicircle top
model.SketchManager.InsertSketch(true);

const feat2 = model.FeatureByPositionReverse(0);
model.ClearSelection2(true);
feat2.Select2(false, 0);
try {
  const rev = model.FeatureManager.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
  console.log('Semicircle closed profile revolve =>', rev?.Name ?? rev);
} catch (e) {
  console.log('Semicircle revolve ERR', String(e).split('\n')[0]);
}

console.log('done');

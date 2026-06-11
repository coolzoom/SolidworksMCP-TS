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

const feat = model.FeatureByPositionReverse(0);
const sketch = feat.GetSpecificFeature2();
const segs = sketch.GetSketchSegments();
console.log('segments type:', typeof segs, Array.isArray(segs), segs?.length, segs?.Count);

model.ClearSelection2(true);
feat.Select2(false, 0);

try {
  if (Array.isArray(segs)) {
    for (const seg of segs) {
      if (seg?.ConstructionGeometry) {
        console.log('array Select4 =>', seg.Select4(true, undefined));
      }
    }
  } else if (segs?.Count) {
    for (let i = 1; i <= segs.Count; i++) {
      const seg = segs.Item(i);
      console.log('item', i, 'construction', seg?.ConstructionGeometry);
    }
  }
  const rev = model.FeatureManager.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
  console.log('FeatureRevolve =>', rev?.Name ?? rev);
} catch (e) {
  console.log('ERR', e);
}

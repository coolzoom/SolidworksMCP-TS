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
console.log('1 sketch ok', feat.Name);

model.ClearSelection2(true);
feat.Select2(false, 0);
console.log('2 sketch selected');

const sketch = feat.GetSpecificFeature2();
console.log('3 GetSpecificFeature2 ok');

const segs = sketch.GetSketchSegments();
console.log('4 segments', typeof segs, segs?.length, segs?.Count);

if (segs?.Count) {
  for (let i = 1; i <= segs.Count; i++) {
    const seg = segs.Item(i);
    console.log(`5 seg ${i}`, seg?.ConstructionGeometry, typeof seg?.Select2);
    if (seg?.ConstructionGeometry) {
      try {
        console.log('6 Select2...');
        const ok = seg.Select2(true, 16);
        console.log('6 Select2 =>', ok);
      } catch (e) {
        console.log('6 Select2 ERR', e);
      }
    }
  }
}

console.log('7 done');

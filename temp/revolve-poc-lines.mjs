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
model.ClearSelection2(true);
feat.Select2(false, 0);

const sketch = feat.GetSpecificFeature2();
console.log('sketch ok');

try {
  const lines = sketch.GetLines2(0);
  console.log('GetLines2', typeof lines, lines?.length, lines?.Count);
} catch (e) {
  console.log('GetLines2 ERR', e);
}

try {
  const arcs = sketch.GetArcs2(0);
  console.log('GetArcs2', typeof arcs, arcs?.length, arcs?.Count);
} catch (e) {
  console.log('GetArcs2 ERR', e);
}

console.log('done');

import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCircleByRadius(0, 0, 0, 0.025);
model.SketchManager.InsertSketch(true);

const name = model.FeatureByPositionReverse(0).Name;
console.log('Sketch name:', name);

for (const type of ['SKETCH', 'SKETCHSEGMENT', 'EXTSKETCHSEGMENT']) {
  try {
    model.ClearSelection2(true);
    const ok = model.Extension.SelectByID2(name, type, 0, 0, 0, false, 0, undefined, 0);
    console.log(`SelectByID2("${name}", "${type}") =>`, ok);
  } catch (e) {
    console.log(`SelectByID2 "${type}" ERR`, String(e).split('\n')[0]);
  }
}

console.log('feat.Select2 =>', model.FeatureByPositionReverse(0).Select2(false, 0));

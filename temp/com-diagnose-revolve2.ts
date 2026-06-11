import { loadWinax } from '../src/adapters/winax-loader.js';
import { SolidWorksConfig } from '../src/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const template = SolidWorksConfig.getTemplatePath(swApp, 'part');
const model = swApp.NewDocument(template, 0, 0, 0);

model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);

const sketchName = model.FeatureByPositionReverse(0).Name;
console.log('Sketch:', sketchName);

model.ClearSelection2(true);
model.FeatureByPositionReverse(0).Select2(false, 0);

const axisNames = [`Line1@${sketchName}`, 'Line1', 'Line1@Sketch1'];
for (const axisName of axisNames) {
  try {
    model.ClearSelection2(true);
    model.FeatureByPositionReverse(0).Select2(false, 0);
    const ok = model.Extension.SelectByID2(axisName, 'SKETCHSEGMENT', 0, 0, 0, true, 16, undefined, 0);
    console.log('SelectByID2 axis', axisName, '=>', ok);
    if (ok) {
      const rev = model.FeatureManager.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
      console.log('  FeatureRevolve =>', rev?.Name ?? rev);
    }
  } catch (e) {
    console.log('SelectByID2 axis', axisName, 'ERR', String(e).split('\n')[0]);
  }
}

const SW_FM_REVOLVE = 72;
try {
  model.ClearSelection2(true);
  model.FeatureByPositionReverse(0).Select2(false, 0);
  const def = model.FeatureManager.CreateDefinition(SW_FM_REVOLVE);
  console.log('CreateDefinition =>', !!def);
  if (def) {
    def.AccessSelections(model, null);
    def.Angle = Math.PI * 2;
    const feat = model.FeatureManager.CreateFeature(def);
    console.log('CreateFeature revolve =>', feat?.Name ?? feat);
  }
} catch (e) {
  console.log('CreateDefinition ERR', String(e).split('\n')[0]);
}

import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCircleByRadius(0, 0, 0, R);
model.SketchManager.InsertSketch(true);
model.ClearSelection2(true);
model.FeatureByPositionReverse(0).Select2(false, 0);
model.FeatureManager.FeatureExtrusion3(
  true, false, false, 0, 0, 0.001, 0,
  false, false, false, false, 0, 0,
  false, false, false, false, true, true, true, 0, 0, false
);
console.log('Extrude ok');

// Try GetBodies2 with 2 params
for (const args of [[0, true], [0, false], [1, true]]) {
  try {
    const b = model.GetBodies2(...args);
    console.log('GetBodies2', args, '=>', b?.length ?? b?.Count ?? typeof b);
  } catch (e) {
    console.log('GetBodies2', args, 'ERR', String(e).split('\n')[0]);
  }
}

// Select face by coordinate (top of disk at z=0.001m)
model.ClearSelection2(true);
for (const z of [0.001, 0.0005, 0]) {
  try {
    const ok = model.Extension.SelectByID2('', 'FACE', 0, 0, z, false, 0, undefined, 0);
    console.log(`SelectByID2 FACE at z=${z} =>`, ok);
    if (ok) {
      try {
        const dome = model.InsertDome(R, 0, false);
        console.log('InsertDome =>', dome?.Name ?? dome);
      } catch (e) {
        console.log('InsertDome ERR', String(e).split('\n')[0]);
      }
      break;
    }
  } catch (e) {
    console.log(`SelectByID2 FACE z=${z} ERR`, String(e).split('\n')[0]);
  }
}

console.log('done');

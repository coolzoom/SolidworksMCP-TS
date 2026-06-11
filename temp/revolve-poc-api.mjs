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
const sketchName = feat.Name;
model.ClearSelection2(true);
feat.Select2(false, 0);

const sketch = feat.GetSpecificFeature2();

const methods = ['GetLines', 'GetLines2', 'GetArcs', 'GetArcs2'];
for (const m of methods) {
  try {
    const r = m.endsWith('2') ? sketch[m](0) : sketch[m]();
    const info = Array.isArray(r) ? `array[${r.length}]` : `type=${typeof r} keys=${r ? Object.keys(r).slice(0,5) : 'null'}`;
    console.log(m, '=>', info);
    if (Array.isArray(r) && r[0]) {
      console.log('  [0] type', typeof r[0], 'construction', r[0]?.ConstructionGeometry);
    }
  } catch (e) {
    console.log(m, 'ERR', String(e).split('\n')[0]);
  }
}

// CreateDefinition sanity: extrude vs revolve
const fm = model.FeatureManager;
for (const c of [33, 72, 73, 84]) {
  try {
    const def = fm.CreateDefinition(c);
    console.log('CreateDefinition', c, '=>', !!def, def?.constructor?.name ?? typeof def);
  } catch (e) {
    console.log('CreateDefinition', c, 'ERR', String(e).split('\n')[0]);
  }
}

// SelectByRay on centerline midpoint
try {
  model.ClearSelection2(true);
  feat.Select2(false, 0);
  const ok = model.Extension.SelectByRay(0, 0, 0, 0, 0, -1, 0.001, 2, true, 16, 0);
  console.log('SelectByRay =>', ok);
  const rev = fm.FeatureRevolve(false, false, Math.PI * 2, 0, false, false, false, true);
  console.log('FeatureRevolve after SelectByRay =>', rev?.Name ?? rev);
} catch (e) {
  console.log('SelectByRay ERR', String(e).split('\n')[0]);
}

console.log('sketchName', sketchName);

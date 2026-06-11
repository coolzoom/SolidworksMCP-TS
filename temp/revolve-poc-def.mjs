import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const angle = Math.PI * 2;
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

const fm = model.FeatureManager;

// winax COM objects can be falsy but still usable
for (const c of [72, 33, 84]) {
  try {
    const def = fm.CreateDefinition(c);
    console.log(`\nCreateDefinition(${c}) typeof=${typeof def} truthy=${!!def}`);
    const keys = ['RevolutionAngle', 'Angle', 'ReverseDirection', 'Type', 'Merge', 'ThinFeature'];
    for (const k of keys) {
      try {
        def[k] = k.includes('Angle') ? angle : false;
        console.log(`  set ${k} ok, get=`, def[k]);
      } catch (e) {
        console.log(`  set ${k} fail`, String(e).split('\n')[0]);
      }
    }
    try {
      const acc = def.AccessSelections(model, undefined);
      console.log('  AccessSelections =>', acc);
    } catch (e) {
      console.log('  AccessSelections ERR', String(e).split('\n')[0]);
    }
    try {
      const f = fm.CreateFeature(def);
      console.log('  CreateFeature =>', f?.Name ?? f);
    } catch (e) {
      console.log('  CreateFeature ERR', String(e).split('\n')[0]);
    }
  } catch (e) {
    console.log(`CreateDefinition(${c}) ERR`, String(e).split('\n')[0]);
  }
}

// Try default origin axes
const axisCandidates = [
  ['Y Axis', 'AXIS'],
  ['X Axis', 'AXIS'],
  ['Z Axis', 'AXIS'],
  ['Origin', 'EXTSKETCHPOINT'],
  ['Front Plane', 'PLANE'],
];
console.log('\n=== Default axis SelectByID2 ===');
for (const [name, type] of axisCandidates) {
  try {
    model.ClearSelection2(true);
    feat.Select2(false, 0);
    const ok = model.Extension.SelectByID2(name, type, 0, 0, 0, true, 16, 0, 0);
    console.log(`SelectByID2("${name}", "${type}") =>`, ok);
    if (ok) {
      const rev = fm.FeatureRevolve(false, false, angle, 0, false, false, false, true);
      console.log('  FeatureRevolve =>', rev?.Name ?? rev);
    }
  } catch (e) {
    console.log(`SelectByID2("${name}") ERR`, String(e).split('\n')[0]);
  }
}

// PowerShell-style: try Line1@Sketch with integer callout 0
console.log('\n=== Line segment names ===');
for (const n of [`Line1@${sketchName}`, `Arc1@${sketchName}`, `Line1@Sketch1`]) {
  for (const mark of [1, 16]) {
    try {
      model.ClearSelection2(true);
      feat.Select2(false, 0);
      const ok = model.Extension.SelectByID2(n, 'SKETCHSEGMENT', 0, 0, 0, true, mark, 0, 0);
      console.log(`SelectByID2 ${n} mark=${mark} =>`, ok);
    } catch (e) {
      console.log(`SelectByID2 ${n} mark=${mark} ERR`, String(e).split('\n')[0]);
    }
  }
}

console.log('\ndone');

import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

const planes = [];
for (let i = 0; i < model.GetFeatureCount(); i++) {
  const f = model.FeatureByPositionReverse(i);
  if (f?.GetTypeName2?.() === 'RefPlane') planes.push(f);
}

function selectTwoPlanes() {
  model.ClearSelection2(true);
  planes[0].Select2(false, 0);
  planes[1].Select2(true, 1);
}

const targets = [
  ['md.InsertAxis', model, 'InsertAxis'],
  ['md.InsertAxis2', model, 'InsertAxis2'],
  ['fm.InsertAxis', model.FeatureManager, 'InsertAxis'],
  ['fm.InsertAxis2', model.FeatureManager, 'InsertAxis2'],
];

const argSets = [
  [true, false],
  [false, true, false],
  [0, true, false],
];

for (const [label, obj, method] of targets) {
  if (typeof obj[method] !== 'function') {
    console.log(label, 'missing');
    continue;
  }
  for (const args of argSets) {
    try {
      selectTwoPlanes();
      const r = obj[method](...args);
      console.log(`${label}(${args.join(',')}) =>`, r?.GetTypeName2?.() ?? r ?? 'null');
    } catch (e) {
      console.log(`${label}(${args.join(',')}) ERR`, String(e).split('\n')[0]);
    }
  }
}

console.log('done');

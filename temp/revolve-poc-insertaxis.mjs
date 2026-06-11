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
model.ClearSelection2(true);
planes[0].Select2(false, 0);
planes[1].Select2(true, 1);

const md = model;
for (const name of ['InsertAxis', 'InsertAxis2', 'InsertAxis3', 'FeatureManager']) {
  console.log(name, typeof md[name]);
}

const tries = [
  [true, false],
  [false, false],
  [2, 0, 0, 0, true, false],
  [1, true, false],
];
for (const args of tries) {
  try {
    model.ClearSelection2(true);
    planes[0].Select2(false, 0);
    planes[1].Select2(true, 1);
    const r = md.InsertAxis2(...args);
    console.log(`InsertAxis2(${args.join(',')}) =>`, r?.GetTypeName2?.() ?? r);
  } catch (e) {
    console.log(`InsertAxis2(${args.join(',')}) ERR`, String(e).split('\n')[0]);
  }
}

console.log('done');

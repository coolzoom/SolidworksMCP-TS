import { existsSync } from 'node:fs';
import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');

console.log('Revision:', swApp.RevisionNumber?.());
console.log('Version:', SolidWorksConfig.getVersion(swApp));

for (const id of [8, 9, 10, 0, 1]) {
  const p = swApp.GetUserPreferenceStringValue(id);
  console.log(`pref[${id}]:`, p, 'exists:', p ? existsSync(p) : false);
}

const templates = SolidWorksConfig.getDefaultTemplates(swApp);
console.log('templates:', templates);

const template = SolidWorksConfig.getTemplatePath(swApp, 'part');
console.log('part template:', template, 'exists:', existsSync(template));

const doc = swApp.NewDocument(template, 0, 0, 0);
console.log('NewDocument result:', doc ? 'OK' : 'null');
if (doc) console.log('Title:', doc.GetTitle?.() ?? doc.GetTitle);

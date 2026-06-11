import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
swApp.Visible = true;

console.log('Revision:', swApp.RevisionNumber?.());
console.log('NewDocument type:', typeof swApp.NewDocument);

const template = SolidWorksConfig.getTemplatePath(swApp, 'part');
console.log('Template:', template);

const doc = swApp.NewDocument(template, 0, 0, 0);
console.log('Doc:', doc);
console.log('Doc type:', typeof doc);
console.log('GetTitle type:', typeof doc?.GetTitle);
try {
  console.log('Title:', doc?.GetTitle?.() ?? doc?.GetTitle);
} catch (e) {
  console.log('GetTitle error:', e.message);
}

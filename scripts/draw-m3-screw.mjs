import { createHexSocketScrewViaBridge } from '../dist/utils/screw-generator-bridge.js';

const result = createHexSocketScrewViaBridge({
  size: 'M3',
  length: 60,
  cosmeticThread: true,
  headChamfer: true,
});

if (!result.success) {
  console.error('FAILED:', result.error);
  process.exit(1);
}

console.log('SUCCESS:', result.partName);
console.log('Features:', result.features);
console.log('Spec:', result.spec?.threadSize);

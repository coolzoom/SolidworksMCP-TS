#!/usr/bin/env node
try {
  await import('winax');
  console.log('winax: OK');
  process.exit(0);
} catch (err) {
  console.log('winax: FAIL -', err.message);
  process.exit(1);
}

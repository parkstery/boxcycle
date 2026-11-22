import assert from 'node:assert/strict';
import test from 'node:test';
import { compare, largeFileWarnings } from '../../../../scripts/check-code-tidy.mjs';

const base = { fingerprint: 'same', knip: {}, duplicatedLines: 0,
  largeFiles: { 'src/App.tsx': 3657, 'src/components/map/MapView.tsx': 3404 } };
const current = (app, map = 3404) => ({ ...base,
  largeFiles: { 'src/App.tsx': app, 'src/components/map/MapView.tsx': map } });

test('App warns above baseline, permits exactly +500, and rejects +501', () => {
  assert.deepEqual(largeFileWarnings(base, current(3657)), []);
  assert.equal(largeFileWarnings(base, current(3658)).length, 1);
  assert.deepEqual(compare(base, current(4157)), []);
  assert.match(largeFileWarnings(base, current(4157))[0], /\+500.*4157/);
  assert.match(compare(base, current(4158))[0], /여유 500줄 초과/);
});

test('other files keep +150 and unrelated ratchets remain enforced', () => {
  assert.deepEqual(compare(base, current(3657, 3554)), []);
  assert.match(compare(base, current(3657, 3555))[0], /여유 150줄 초과/);
  assert.equal(largeFileWarnings(base, current(3657, 3555)).length, 0);
  assert.match(compare(base, { ...current(3657), fingerprint: 'changed' })[0], /측정 규칙이 바뀌었다/);
  assert.match(compare(base, { ...current(3657), duplicatedLines: 1 })[0], /반복 줄/);
});

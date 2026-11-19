import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectReadMetrics } from './collect-read-metrics.mjs';
const point = (from, to, n) => ({ interval: { startTime: from, endTime: to }, value: { int64Value: String(n) } });
const series = points => ({ metric: { labels: { type: 'QUERY' } }, points });

test('전 페이지 합계·PT 자정·배포 경계 겹침을 구분한다', async () => {
  const requests = [];
  const pages = [
    { timeSeries: [series([point('2026-11-19T07:59:00Z', '2026-11-19T08:00:00Z', 7)])], nextPageToken: 'second' },
    { timeSeries: [series([point('2026-11-19T08:00:00Z', '2026-11-19T08:01:00Z', 11), point('2026-11-19T08:01:00Z', '2026-11-19T08:02:00Z', 13)])] },
  ];
  const result = await collectReadMetrics({ request: async request => { requests.push(request); return { data: pages.shift() }; } }, {
    start: '2026-11-19T07:59:00Z', end: '2026-11-19T08:02:00Z', releaseAt: '2026-11-19T08:00:30Z',
  });
  assert.equal(requests[1].params.pageToken, 'second');
  assert.equal(requests[0].method, 'GET');
  assert.deepEqual(result.summary.dailyPt, { '2026-11-18': 7, '2026-11-19': 24 });
  assert.deepEqual(result.summary.dailyKst, { '2026-11-19': 31 });
  assert.deepEqual(result.summary.releaseWindows, { before: 7, after: 13, overlap: 11 });
  assert.equal(result.summary.total, 31);
  assert.equal(result.summary.postReleaseObserved, true);
});

test('PT 여름 자정·없는 데이터·반복 페이지·잘못된 구간을 처리한다', async () => {
  const input = { start: '2026-07-19T06:59:00Z', end: '2026-07-19T07:01:00Z' };
  const result = await collectReadMetrics({ request: async () => ({ data: { timeSeries: [series([
    point(input.start, '2026-07-19T07:00:00Z', 3), point('2026-07-19T07:00:00Z', input.end, 5),
  ])] } }) }, input);
  assert.deepEqual(result.summary.dailyPt, { '2026-07-18': 3, '2026-07-19': 5 });
  const empty = await collectReadMetrics({ request: async () => ({ data: {} }) }, input);
  assert.equal(empty.summary.latestPointEnd, null);
  const beforeOnly = await collectReadMetrics({ request: async () => ({ data: { timeSeries: [series([
    point(input.start, input.end, 0),
  ])] } }) }, { ...input, releaseAt: '2026-07-19T08:00:00Z' });
  assert.equal(beforeOnly.summary.releaseWindows.after, 0);
  assert.equal(beforeOnly.summary.postReleaseObserved, false);
  await assert.rejects(collectReadMetrics({ request: async () => ({ data: { nextPageToken: 'loop' } }) }, input), /토큰/);
  await assert.rejects(collectReadMetrics({ request: async () => { throw Error('must not call'); } }, { start: 'bad', end: input.end }), /시작/);
});

// 읽기 전용 Cloud Monitoring 수집. Firestore 문서 조회·앱 실행은 하지 않는다.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const project = 'boxcycle-dc2df';
const metric = 'firestore.googleapis.com/document/read_count';
const dateFormatters = new Map(['Asia/Seoul', 'America/Los_Angeles'].map(timeZone => [
  timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }),
]));
function dayAt(ms, zone) {
  const parts = Object.fromEntries(dateFormatters.get(zone).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function collectReadMetrics(client, { start, end, releaseAt = null }) {
  const startMs = Date.parse(start), endMs = Date.parse(end);
  const releaseMs = releaseAt == null ? null : Date.parse(releaseAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || endMs - startMs > 31 * 86400_000) {
    throw new Error('시작·종료 ISO 시각과 최대 31일 구간이 필요합니다.');
  }
  if (releaseMs != null && !Number.isFinite(releaseMs)) throw new Error('배포 ISO 시각이 올바르지 않습니다.');
  const series = [], seenTokens = new Set();
  let pageToken;
  do {
    const response = await client.request({
      url: `https://monitoring.googleapis.com/v3/projects/${project}/timeSeries`,
      method: 'GET',
      params: {
        filter: `metric.type="${metric}" AND resource.type="firestore_instance"`,
        'interval.startTime': new Date(startMs).toISOString(),
        'interval.endTime': new Date(endMs).toISOString(),
        'aggregation.alignmentPeriod': '60s',
        'aggregation.perSeriesAligner': 'ALIGN_SUM',
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      },
    });
    series.push(...(response.data.timeSeries ?? []));
    pageToken = response.data.nextPageToken;
    if (pageToken && seenTokens.has(pageToken)) throw new Error('Monitoring 페이지 토큰이 반복되었습니다.');
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);

  const dailyKst = {}, dailyPt = {}, byType = {}, releaseWindows = { before: 0, after: 0, overlap: 0 };
  const releaseWindowPoints = { before: 0, after: 0, overlap: 0 };
  let total = 0, points = 0, latestEndMs = null;
  for (const row of series) {
    const type = row.metric?.labels?.type ?? 'UNKNOWN';
    for (const point of row.points ?? []) {
      const value = Number(point.value?.int64Value ?? point.value?.doubleValue);
      const from = Date.parse(point.interval?.startTime), to = Date.parse(point.interval?.endTime);
      if (!Number.isSafeInteger(value) || value < 0 || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
        throw new Error('Monitoring 포인트가 올바르지 않습니다.');
      }
      // 양 끝이 요청 구간 안에 있는 완전한 분만 집계한다.
      if (from < startMs || to > endMs) continue;
      total += value;
      points += 1;
      latestEndMs = Math.max(latestEndMs ?? to, to);
      byType[type] = (byType[type] ?? 0) + value;
      const kst = dayAt(to - 1, 'Asia/Seoul'), pt = dayAt(to - 1, 'America/Los_Angeles');
      dailyKst[kst] = (dailyKst[kst] ?? 0) + value;
      dailyPt[pt] = (dailyPt[pt] ?? 0) + value;
      if (releaseMs != null) {
        const window = to <= releaseMs ? 'before' : from >= releaseMs ? 'after' : 'overlap';
        releaseWindows[window] += value;
        releaseWindowPoints[window] += 1;
      }
    }
  }
  const summary = {
    collectedAt: new Date().toISOString(), project, metric, start, end, releaseAt,
    total, points, series: series.length, latestPointEnd: latestEndMs == null ? null : new Date(latestEndMs).toISOString(),
    byType, dailyKst, dailyPt, releaseWindows: releaseMs == null ? null : releaseWindows,
    releaseWindowPoints: releaseMs == null ? null : releaseWindowPoints,
    postReleaseObserved: releaseMs == null ? null : releaseWindowPoints.after > 0,
    caveat: 'Monitoring 지표이며 청구 내역·클라이언트별 귀속·배포의 인과 효과가 아니다. 부분일과 집계 지연에 유의한다.',
  };
  return { summary, series };
}

async function main() {
  const args = new Map(process.argv.slice(2).map(arg => {
    const at = arg.indexOf('=');
    if (!arg.startsWith('--') || at < 3) throw new Error('--start=ISO --end=ISO --out=폴더 [--release-at=ISO]');
    return [arg.slice(2, at), arg.slice(at + 1)];
  }));
  if (![...args.keys()].every(key => ['start', 'end', 'out', 'release-at'].includes(key))) throw new Error('알 수 없는 인자');
  if (!args.get('start') || !args.get('end') || !args.get('out')) throw new Error('--start, --end, --out 필요');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const require = createRequire(resolve(root, 'functions/package.json'));
  const { initFirebaseAdminForCli } = require('./lib/initAdminForCli.js');
  const { GoogleAuth } = require('google-auth-library');
  initFirebaseAdminForCli({ projectId: project });
  const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/monitoring.read'] }).getClient();
  const result = await collectReadMetrics(client, { start: args.get('start'), end: args.get('end'), releaseAt: args.get('release-at') });
  const out = resolve(args.get('out'));
  mkdirSync(out, { recursive: true });
  // 기존 증거를 덮어쓰지 않는다.
  const stamp = result.summary.collectedAt.replace(/[:.]/g, '-');
  writeFileSync(resolve(out, `${stamp}-summary.json`), JSON.stringify(result.summary, null, 2), { flag: 'wx' });
  writeFileSync(resolve(out, `${stamp}-series.json.gz`), gzipSync(JSON.stringify(result.series)), { flag: 'wx' });
  console.log(JSON.stringify(result.summary, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // HTTP 에러 객체에 인증 헤더가 담길 수 있으므로 객체 전체는 출력하지 않는다.
    console.error(`수집 실패: ${error.response?.status ?? ''} ${error.message}`);
    process.exitCode = 1;
  });
}

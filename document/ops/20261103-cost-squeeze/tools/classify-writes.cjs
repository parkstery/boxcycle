// 읽기 전용: 분당 Firestore 쓰기를 위치 쓰기 트리거 호출 수로 회귀하고, 트리거 응답 시간 분포로 서버 집계 쓰기 비율을 본다.
// 실행: node <이 파일> C:/20.HDev/boxcycle/functions <시작 UTC> <끝 UTC>
const path = require("path");
const [fnDir, from, to] = process.argv.slice(2);
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
const { GoogleAuth } = require(path.join(fnDir, "node_modules/google-auth-library"));
const PROJECT = "boxcycle-dc2df";
const TRIGGER = "routeactivityonlivepublicationridewritten";
(async () => {
  initFirebaseAdminForCli({});
  const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/monitoring.read", "https://www.googleapis.com/auth/logging.read"] }).getClient();
  async function perMin(filter, groupBy) {
    const u = new URL(`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries`);
    u.searchParams.set("filter", filter);
    u.searchParams.set("interval.startTime", from);
    u.searchParams.set("interval.endTime", to);
    u.searchParams.set("aggregation.alignmentPeriod", "60s");
    u.searchParams.set("aggregation.perSeriesAligner", "ALIGN_SUM");
    u.searchParams.set("aggregation.crossSeriesReducer", "REDUCE_SUM");
    if (groupBy) u.searchParams.append("aggregation.groupByFields", groupBy);
    return (await client.request({ url: u.toString() })).data.timeSeries ?? [];
  }
  const add = (m, s) => { for (const p of s.points) { const k = p.interval.endTime; m[k] = (m[k] ?? 0) + Number(p.value.int64Value ?? p.value.doubleValue ?? 0); } };
  const writes = {}, calls = {}, other = {};
  for (const s of await perMin('metric.type="firestore.googleapis.com/document/write_count"')) add(writes, s);
  for (const s of await perMin('metric.type="run.googleapis.com/request_count" AND resource.type="cloud_run_revision"', "resource.label.service_name")) {
    add(s.resource.labels.service_name === TRIGGER ? calls : other, s);
  }
  const keys = Object.keys(writes).sort();
  const xs = keys.map((k) => calls[k] ?? 0), ys = keys.map((k) => writes[k]);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), syy = ys.reduce((a, y) => a + (y - my) ** 2, 0);
  const slope = sxy / sxx, icpt = my - slope * mx;
  console.log(`분 ${n} 쓰기합 ${ys.reduce((a, b) => a + b, 0)} 호출합 ${xs.reduce((a, b) => a + b, 0)}`);
  console.log(`회귀: 분당쓰기 = ${icpt.toFixed(2)} + ${slope.toFixed(3)} × 분당호출, R²=${((sxy * sxy) / (sxx * syy)).toFixed(3)}`);
  const quiet = keys.filter((k) => (calls[k] ?? 0) === 0);
  console.log(`호출 0인 분 ${quiet.length}개의 쓰기 합 ${quiet.reduce((a, k) => a + writes[k], 0)}`);
  const filter = `resource.type="cloud_run_revision" AND resource.labels.service_name="${TRIGGER}" AND log_id("run.googleapis.com/requests") AND timestamp>="${from}" AND timestamp<="${to}"`;
  const lat = []; let pageToken;
  do {
    const r = await client.request({ url: "https://logging.googleapis.com/v2/entries:list", method: "POST", data: { resourceNames: [`projects/${PROJECT}`], filter, orderBy: "timestamp asc", pageSize: 1000, pageToken } });
    for (const e of r.data.entries ?? []) lat.push(parseFloat(e.httpRequest?.latency ?? "0") * 1000);
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  const bins = [5, 10, 20, 40, 80, 160, 320, 1000, Infinity], h = bins.map(() => 0);
  for (const v of lat) h[bins.findIndex((b) => v < b)]++;
  console.log("트리거 응답 ms 분포", lat.length, bins.map((b, i) => `<${b}:${h[i]}`).join(" "));
})().catch((e) => { console.error("ERR", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 400)); process.exit(1); });

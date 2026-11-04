// 읽기 전용: Cloud Monitoring 에서 분당 Firestore 쓰기 수·트리거 함수 호출 수를 읽는다.
const path = require("path");
const fnDir = process.argv[2], startIso = process.argv[3], endIso = process.argv[4];
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
const { GoogleAuth } = require(path.join(fnDir, "node_modules/google-auth-library"));
const PROJECT = "boxcycle-dc2df";
(async () => {
  initFirebaseAdminForCli({});
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/monitoring.read"] });
  const client = await auth.getClient();
  async function series(filter, groupBy) {
    const u = new URL(`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries`);
    u.searchParams.set("filter", filter);
    u.searchParams.set("interval.startTime", startIso);
    u.searchParams.set("interval.endTime", endIso);
    u.searchParams.set("aggregation.alignmentPeriod", "60s");
    u.searchParams.set("aggregation.perSeriesAligner", "ALIGN_SUM");
    u.searchParams.set("aggregation.crossSeriesReducer", "REDUCE_SUM");
    for (const g of groupBy) u.searchParams.append("aggregation.groupByFields", g);
    const r = await client.request({ url: u.toString() });
    return r.data.timeSeries ?? [];
  }
  const val = (p) => Number(p.value.int64Value ?? p.value.doubleValue ?? 0);
  const fs = await series('metric.type="firestore.googleapis.com/document/write_count"', ["metric.label.op"]);
  for (const s of fs) console.log("firestore writes", JSON.stringify(s.metric.labels), "합계", s.points.reduce((a, p) => a + val(p), 0));
  const run = await series('metric.type="run.googleapis.com/request_count" AND resource.type="cloud_run_revision"', ["resource.label.service_name"]);
  const rows = run.map((s) => ({ name: s.resource.labels.service_name, total: s.points.reduce((a, p) => a + val(p), 0), peak: Math.max(...s.points.map(val)) })).sort((a, b) => b.total - a.total);
  for (const r of rows) console.log(String(r.total).padStart(6), "peak/min", String(r.peak).padStart(4), r.name);
  const t = run.find((s) => s.resource.labels.service_name === "routeactivityonlivepublicationridewritten");
  if (t) for (const p of [...t.points].reverse()) console.log(new Date(new Date(p.interval.endTime).getTime() + 9 * 3600e3).toISOString().slice(11, 16), val(p));
})().catch((e) => { console.error("ERR", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 400)); process.exit(1); });

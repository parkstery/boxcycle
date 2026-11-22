// 옛 단일 응답 보조 도구. 전체 기간 총량은 collect-read-metrics.mjs(전 페이지 처리)를 사용한다.
// 읽기 전용: Cloud Monitoring 에서 Firestore read_count 를 시간대별(KST)로 읽는다.
// 사용: node mon-reads.cjs <functions 폴더> <startIso> <endIso> [alignSec=3600]
const path = require("path");
const fnDir = process.argv[2], startIso = process.argv[3], endIso = process.argv[4];
const align = Number(process.argv[5] ?? 3600);
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
    u.searchParams.set("aggregation.alignmentPeriod", `${align}s`);
    u.searchParams.set("aggregation.perSeriesAligner", "ALIGN_SUM");
    u.searchParams.set("aggregation.crossSeriesReducer", "REDUCE_SUM");
    for (const g of groupBy) u.searchParams.append("aggregation.groupByFields", g);
    const r = await client.request({ url: u.toString() });
    return r.data.timeSeries ?? [];
  }
  const val = (p) => Number(p.value.int64Value ?? p.value.doubleValue ?? 0);
  const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
  for (const [metric, label] of [["document/read_count", "metric.label.type"], ["document/write_count", "metric.label.op"], ["document/delete_count", null]]) {
    const ss = await series(`metric.type="firestore.googleapis.com/${metric}"`, label ? [label] : []);
    console.log(`\n== ${metric} ==`);
    for (const s of ss) {
      const total = s.points.reduce((a, p) => a + val(p), 0);
      console.log("라벨", JSON.stringify(s.metric.labels ?? {}), "합계", total);
      for (const p of [...s.points].reverse()) if (val(p) > 0) console.log("  ", kst(p.interval.startTime), String(val(p)).padStart(7));
    }
  }
})().catch((e) => { console.error("ERR", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 400)); process.exit(1); });

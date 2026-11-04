// 읽기 전용: 위치 쓰기 트리거의 요청 로그 시각을 읽어 간격 분포를 본다.
const path = require("path");
const fnDir = process.argv[2], from = process.argv[3], to = process.argv[4];
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
const { GoogleAuth } = require(path.join(fnDir, "node_modules/google-auth-library"));
(async () => {
  initFirebaseAdminForCli({});
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/logging.read"] });
  const client = await auth.getClient();
  const filter = `resource.type="cloud_run_revision" AND resource.labels.service_name="routeactivityonlivepublicationridewritten" AND log_id("run.googleapis.com/requests") AND timestamp>="${from}" AND timestamp<="${to}"`;
  let ts = [], pageToken;
  do {
    const r = await client.request({ url: "https://logging.googleapis.com/v2/entries:list", method: "POST", data: { resourceNames: ["projects/boxcycle-dc2df"], filter, orderBy: "timestamp asc", pageSize: 1000, pageToken } });
    for (const e of r.data.entries ?? []) ts.push(Date.parse(e.timestamp));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  console.log("entries", ts.length);
  const gaps = ts.slice(1).map((t, i) => (t - ts[i]) / 1000);
  const bins = { "<0.3s": 0, "0.3-1s": 0, "1-2s": 0, "2-3.5s": 0, "3.5-4.5s": 0, "4.5-8s": 0, "8-11s": 0, "11-13s": 0, ">13s": 0 };
  for (const g of gaps) { const k = g < .3 ? "<0.3s" : g < 1 ? "0.3-1s" : g < 2 ? "1-2s" : g < 3.5 ? "2-3.5s" : g < 4.5 ? "3.5-4.5s" : g < 8 ? "4.5-8s" : g < 11 ? "8-11s" : g < 13 ? "11-13s" : ">13s"; bins[k]++; }
  console.log(JSON.stringify(bins));
  const fmt = (t) => new Date(t + 9 * 3600e3).toISOString().slice(11, 21);
  // 버스트(앞뒤 1초 안에 이웃이 있는 호출)를 빼고, 남은 호출에서 4초·12초 줄기를 찾는다.
  const isBurst = ts.map((t, i) => (i > 0 && t - ts[i - 1] < 1000) || (i < ts.length - 1 && ts[i + 1] - t < 1000));
  console.log("burst", isBurst.filter(Boolean).length, "steady", isBurst.filter((b) => !b).length);
  const used = new Set(); const chains = [];
  for (let i = 0; i < ts.length; i++) {
    if (used.has(i)) continue;
    for (const period of [4000, 12000]) {
      const chain = [i]; let last = ts[i];
      for (let j = i + 1; j < ts.length && ts[j] - last <= period + 400; j++) {
        if (used.has(j)) continue;
        const g = ts[j] - last;
        if (g >= period - 300 && g <= period + 400) { chain.push(j); last = ts[j]; }
      }
      if (chain.length >= 3) { chain.forEach((k) => used.add(k)); chains.push({ period, n: chain.length, from: fmt(ts[chain[0]]), to: fmt(ts[chain[chain.length - 1]]) }); break; }
    }
  }
  for (const c of chains) console.log(`${c.period / 1000}s x${c.n}  ${c.from} ~ ${c.to}`);
})().catch((e) => { console.error("ERR", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 300)); process.exit(1); });

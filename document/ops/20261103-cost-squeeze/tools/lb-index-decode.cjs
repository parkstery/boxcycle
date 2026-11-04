const path = require("path");
const fnDir = process.argv[2];
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
const { getFirestore } = require(path.join(fnDir, "node_modules/firebase-admin/lib/firestore/index.js"));
function decode(msg) {
  const m = /create_composite=([A-Za-z0-9_\-=%]+)/.exec(msg); if (!m) return msg.includes("building") ? "(building)" : "(no link)";
  const b = Buffer.from(decodeURIComponent(m[1]).replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const out = [];
  // IndexField: 0x0a <len> <field_path> 0x10 <order 1=ASC 2=DESC>
  for (let i = 0; i < b.length - 3; i++) {
    if (b[i] !== 0x0a) continue;
    const len = b[i + 1]; const end = i + 2 + len;
    if (len < 2 || end + 1 >= b.length || b[end] !== 0x10) continue;
    const name = b.slice(i + 2, end).toString("latin1");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    out.push(`${name}:${b[end + 1] === 1 ? "ASC" : b[end + 1] === 2 ? "DESC" : "?" + b[end + 1]}`);
  }
  return out.join(", ");
}
(async () => {
  initFirebaseAdminForCli({}); const db = getFirestore();
  for (const tr of ["T1", "All"]) {
    const t = `tenths${tr}`, r = `rounded${tr}`;
    const base = db.collection("leaderboardScores").where("board", "==", "distance").where("periodKey", "==", "W2026-45").where("scopeType", "==", "world").where("scopeCode", "==", "-").where("member", "==", true).where(t, ">", 0);
    const shapes = {
      top: base.orderBy(t, "desc").orderBy(r, "desc").orderBy("uid", "asc").limit(21),
      count: base.where(t, ">", 5).count(),
      nearestAbove: base.where(t, ">", 5).orderBy(t, "asc").orderBy(r, "asc").orderBy("uid", "desc").limit(1),
      after: base.orderBy(t, "desc").orderBy(r, "desc").orderBy("uid", "asc").startAfter(5, 500, "u").limit(3),
    };
    for (const [n, q] of Object.entries(shapes)) { try { await q.get(); console.log(tr, n, "OK"); } catch (e) { console.log(tr, n, "=>", decode(String(e.message))); } }
  }
})();

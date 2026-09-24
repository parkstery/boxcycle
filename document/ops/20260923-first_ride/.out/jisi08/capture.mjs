/**
 * 지시08 §6 — Claim 전/후 Ready Ride 캡처 A~D.
 * Functions 에뮬레이터(실 Mapbox `.secret.local`) + Vite :5002. 인터셉트 금지.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi08");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5002";
const FS = "http://127.0.0.1:8080/v1/projects/boxcycle-dc2df/databases/(default)/documents";

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name, buf.length);
}

function uidFromJwt(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = authHeader.slice(7).split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json.user_id || json.sub || null;
  } catch {
    return null;
  }
}

function cellIdAt(lng, lat) {
  const zoom = 20;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return `${zoom}_${x}_${y}`;
}

function chunkOf(cellId) {
  const [, xs, ys] = cellId.split("_");
  const shift = 8;
  return `12_${Number(xs) >> shift}_${Number(ys) >> shift}`;
}

function cellsAlong(coords) {
  const cells = new Set();
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1];
    const b = coords[i];
    for (let s = 0; s <= 10; s += 1) {
      const t = s / 10;
      cells.add(cellIdAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
    }
  }
  return [...cells];
}

function geoHash(coords) {
  return createHash("sha256").update(JSON.stringify(coords)).digest("hex").slice(0, 16);
}

async function seedTokens(uid) {
  const url = `${FS}/users/${uid}?updateMask.fieldPaths=routeTokenBalance&updateMask.fieldPaths=routeTokenOnboardingGranted`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        routeTokenBalance: { integerValue: "50" },
        routeTokenOnboardingGranted: { booleanValue: true },
      },
    }),
  });
}

/**
 * Auth 없는 Firestore REST 는 rules 403. Admin SDK(에뮬레이터)로만 시드한다.
 */
async function seedClaimFromRoute(uid, coords) {
  const cellIds = cellsAlong(coords);
  const byChunk = new Map();
  for (const id of cellIds) {
    const cid = chunkOf(id);
    if (!byChunk.has(cid)) byChunk.set(cid, {});
    byChunk.get(cid)[id] = "2026-09-24";
  }
  const flatPath = [];
  for (const [lng, lat] of coords) flatPath.push(lng, lat);
  const payload = {
    uid,
    chunks: Object.fromEntries(byChunk),
    path: flatPath,
    cellCount: cellIds.length,
  };
  const seedPath = path.join(OUT, "_seed-claim.tmp.json");
  fs.writeFileSync(seedPath, JSON.stringify(payload));
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    process.execPath,
    [path.join(OUT, "seed-claim-admin.mjs"), seedPath],
    { encoding: "utf8", cwd: ROOT, env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" } },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error("seedClaim Admin write failed");
  }
  console.log("seedClaim admin", (r.stdout || "").trim());
  return { cellCount: cellIds.length, chunks: [...byChunk.keys()] };
}

async function enterGuest(page) {
  let capturedUid = null;
  page.on("request", (req) => {
    if (!req.url().includes("ensureRouteTokenOnboardingHttp") && !req.url().includes("getDistanceAutoRoute"))
      return;
    const uid = uidFromJwt(req.headers()["authorization"]);
    if (uid) capturedUid = uid;
  });
  await page.addInitScript(() => {
    window.__rtwForceGenerateCostBase = 0;
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 90000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 90000 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape").catch(() => {});
  for (let i = 0; i < 40 && !capturedUid; i++) await page.waitForTimeout(250);
  if (!capturedUid) throw new Error("no auth uid");
  await seedTokens(capturedUid);
  await page.waitForTimeout(800);
  return capturedUid;
}

async function pickRegion(page, query = "논현동") {
  await page.getByRole("button", { name: "지역 선택" }).click();
  await page.waitForTimeout(400);
  await page.locator("#menu-place-search-input").fill(query);
  await page.waitForTimeout(1000);
  await page.locator(".menu-place-search__item").first().click();
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function readRoute(page) {
  return page.evaluate(() => {
    const map = window.__RTW_MAP__;
    let coords = null;
    let n = 0;
    try {
      for (const [id] of Object.entries(map?.getStyle?.()?.sources || {})) {
        const data = map.getSource(id)?._data;
        const c =
          data?.features?.[0]?.geometry?.coordinates ||
          data?.geometry?.coordinates ||
          (Array.isArray(data?.coordinates) ? data.coordinates : null);
        if (Array.isArray(c) && c.length > n) {
          n = c.length;
          coords = c;
        }
      }
    } catch {}
    return { n, coords };
  });
}

async function waitRoute(page, ms = 90000, { differFromHash = null } = {}) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const info = await readRoute(page);
    if (info.n > 8) {
      const h = info.coords ? geoHash(info.coords) : null;
      if (!differFromHash || h !== differFromHash) return { ...info, hash: h };
    }
    await page.waitForTimeout(400);
  }
  return { n: 0, coords: null, hash: null };
}

async function waitAutoRoute(page, { differFromHash = null, timeoutMs = 90000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const last = page._rtwLastAuto;
    if (last?.hash && last.result?.status === "found") {
      if (!differFromHash || last.hash !== differFromHash) {
        await page.waitForTimeout(1200);
        return last;
      }
    }
    await page.waitForTimeout(300);
  }
  return page._rtwLastAuto ?? null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 740, height: 400 },
    locale: "ko-KR",
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER_ERR", msg.text().slice(0, 160));
  });
  const autoLogs = [];
  page.on("response", async (res) => {
    if (!res.url().includes("getDistanceAutoRoute")) return;
    console.log("HTTP", res.status(), "getDistanceAutoRoute");
    try {
      const j = await res.json();
      const result = j?.result ?? j;
      const coords = result?.geometry?.coordinates;
      const hash = Array.isArray(coords) ? geoHash(coords) : null;
      autoLogs.push({
        status: result?.status,
        bearing: result?.startBearingSampleDeg,
        distance: result?.distance,
        selfOverlapRatio: result?.selfOverlapRatio,
        algorithmVersion: result?.algorithmVersion,
        hash,
        coords: Array.isArray(coords) ? coords.length : 0,
      });
      page._rtwLastAuto = { result, hash, coords };
    } catch {}
  });

  const uid = await enterGuest(page);
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 60000 });
  await pickRegion(page);

  // A — Claim 전
  page._rtwLastAuto = null;
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  const beforeAuto = await waitAutoRoute(page);
  const before = await waitRoute(page, 30000);
  const beforeHash = beforeAuto?.hash ?? before.hash ?? null;
  console.log("A route pts", before.n, "hash", beforeHash, "bearing", beforeAuto?.result?.startBearingSampleDeg);
  await page.waitForTimeout(800);
  await shot(page, "01-before-claim.png");

  if (!beforeHash || !before.coords) throw new Error("A failed — no route");

  const seeded = await seedClaimFromRoute(uid, before.coords);
  console.log("seedClaim", seeded);

  // B — Claim 후 (다른 경로). 응답 geometry 해시가 바뀌길 기다린다.
  await seedTokens(uid);
  page._rtwLastAuto = null;
  const another = page.getByRole("button", { name: "다른 경로" });
  if (await another.isVisible().catch(() => false)) {
    await another.click();
  } else {
    await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  }
  const afterAuto = await waitAutoRoute(page, { differFromHash: beforeHash });
  const afterHash = afterAuto?.hash ?? null;
  console.log(
    "B hash",
    afterHash,
    "bearing",
    afterAuto?.result?.startBearingSampleDeg,
    "changed",
    afterHash !== beforeHash,
  );
  await page.waitForTimeout(1500);
  await shot(page, "02-after-claim.png");

  // C — 리로드로 마젠타 traces 구독 후 재생성
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape").catch(() => {});
  const gate = page.getByRole("dialog", { name: "시작" });
  if (await gate.isVisible({ timeout: 4000 }).catch(() => false)) {
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 60000 });
  const title = await page.locator(".local-first__title").innerText().catch(() => "");
  if (!/Ready Ride/.test(title) || /어디에서/.test(title)) {
    await pickRegion(page);
  }
  await seedTokens(uid);
  page._rtwLastAuto = null;
  const startBtn = page.getByRole("button", { name: "Ready Ride 시작" });
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await waitAutoRoute(page, { differFromHash: beforeHash });
  }
  await page.evaluate(() => {
    const m = window.__RTW_MAP__;
    if (m) m.easeTo({ zoom: Math.min(m.getZoom(), 13.5), duration: 0 });
  });
  await page.waitForTimeout(1500);
  await shot(page, "03-overlay-my-roads.png");

  // D — Claim 없는 사용자(게스트 초기화)
  await page.locator(".hud-account, button:has-text(\"게스트\")").first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "게스트 초기화" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.waitForTimeout(5000);
  const g2 = page.getByRole("dialog", { name: "시작" });
  if (await g2.isVisible({ timeout: 20000 }).catch(() => false)) {
    await g2.getByRole("button", { name: "시작", exact: true }).click();
    await g2.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 60000 });
  await pickRegion(page);
  await seedTokens(uid); // may 403 — force cost 0 covers
  page._rtwLastAuto = null;
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  const noClaimAuto = await waitAutoRoute(page);
  const noClaim = await waitRoute(page, 30000);
  console.log("D route pts", noClaim.n, "hash", noClaimAuto?.hash, "bearing", noClaimAuto?.result?.startBearingSampleDeg);
  await page.waitForTimeout(800);
  await shot(page, "04-no-claim-user.png");

  await browser.close();
  const meta = {
    at: new Date().toISOString(),
    base: BASE,
    uid,
    beforeHash,
    afterHash,
    geometryChanged: Boolean(beforeHash && afterHash && beforeHash !== afterHash),
    beforeBearing: beforeAuto?.result?.startBearingSampleDeg ?? null,
    afterBearing: afterAuto?.result?.startBearingSampleDeg ?? null,
    seeded,
    autoLogs,
  };
  fs.writeFileSync(path.join(OUT, "capture-meta.json"), JSON.stringify(meta, null, 2));
  console.log("META", JSON.stringify(meta, null, 2));
  if (!meta.geometryChanged) {
    console.error("FAIL: geometry did not change after claim");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});

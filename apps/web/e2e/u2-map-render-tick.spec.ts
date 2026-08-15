import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * U-2 — 주행 30s 맵 틱 계측. U2_PHASE=baseline|after (기본 baseline).
 * T0 실패 시 파일을 남기되 T1~T4 판정은 하지 않는다.
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const PHASE = process.env.U2_PHASE === "after" ? "after" : "baseline";
const RUNS = 3;
const RIDE_MS = 30_000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const OUT_FILE =
  PHASE === "after"
    ? path.join(OUT_DIR, "U2-tick-after.json")
    : path.join(OUT_DIR, "U2-tick-baseline.json");

type LongFrame = { t: number; dt: number };
type Snap = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  sentinelDropped: number;
  events: { move: number; zoom: number; moveend: number; zoomend: number; idle: number; perSec: Record<string, number> };
  pathA: { enter: number; emit: number; enterAt: number[]; emitAt: number[] };
  pathB: { run: number; runAt: number[] };
  syncActivityMs: Array<{ t: number; ms: number }>;
  moveToTopMs: Array<{ t: number; ms: number }>;
  raf: {
    samples: number;
    p50: number | null;
    p95: number | null;
    over16_7: number;
    over16_7Rate: number;
    longFrames: LongFrame[];
  };
  headingFromMove: { hit: number; miss: number; maxStepM: number };
  followJumpTo: number;
};

test.describe("U-2 맵 렌더 틱", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행");

  test(`30s 주행 3런 (${PHASE})`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await setSpeedKmh(page, 20);

    const runs: Array<{ snap: Snap; t0: { ok: boolean; reasons: string[] }; corr: ReturnType<typeof correlate> }> =
      [];
    for (let i = 0; i < RUNS; i += 1) {
      await page.evaluate(() => {
        (window as Window & { __RTW_MAP_TICK_START__?: () => void }).__RTW_MAP_TICK_START__?.();
      });
      await page.waitForTimeout(RIDE_MS);
      const snap = (await page.evaluate(() => {
        const w = window as Window & { __RTW_MAP_TICK_STOP__?: () => Snap | null };
        return w.__RTW_MAP_TICK_STOP__?.() ?? null;
      })) as Snap | null;
      expect(snap, `run ${i + 1} snapshot`).toBeTruthy();
      const t0 = assertT0(snap!);
      runs.push({ snap: snap!, t0, corr: correlate(snap!) });
    }

    const t0AllOk = runs.every((r) => r.t0.ok);
    const rates = runs.map((r) => r.snap.raf.over16_7Rate);
    const medianRate = median(rates);
    const maxRate = Math.max(...rates);
    const payload = {
      phase: PHASE,
      t0AllOk,
      longFrameRate: { runs: rates, median: medianRate, max: maxRate },
      runs: runs.map((r, i) => ({
        i: i + 1,
        t0: r.t0,
        durationMs: r.snap.durationMs,
        sentinelDropped: r.snap.sentinelDropped,
        eventsPerSec: r.snap.events.perSec,
        pathA: { enter: r.snap.pathA.enter, emit: r.snap.pathA.emit },
        pathB: { run: r.snap.pathB.run },
        syncMs: summarizeMs(r.snap.syncActivityMs.map((s) => s.ms)),
        moveToTopMs: summarizeMs(r.snap.moveToTopMs.map((s) => s.ms)),
        raf: {
          samples: r.snap.raf.samples,
          p50: r.snap.raf.p50,
          p95: r.snap.raf.p95,
          over16_7: r.snap.raf.over16_7,
          over16_7Rate: r.snap.raf.over16_7Rate,
        },
        headingFromMove: r.snap.headingFromMove,
        followJumpTo: r.snap.followJumpTo,
        correlation: r.corr,
      })),
      raw: runs.map((r) => r.snap),
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
    expect(t0AllOk, `T0 실패: ${JSON.stringify(runs.map((r) => r.t0))}`).toBe(true);
  });
});

function assertT0(snap: Snap): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (snap.sentinelDropped !== 0) reasons.push(`sentinel=${snap.sentinelDropped}`);
  if (!(snap.raf.samples > 0)) reasons.push("raf.samples=0");
  if (!(snap.durationMs >= 25_000)) reasons.push(`duration=${snap.durationMs}`);
  const ev = snap.events.move + snap.events.zoom + snap.events.moveend + snap.events.zoomend + snap.events.idle;
  if (!(ev > 0)) reasons.push("events=0");
  const times = [
    ...snap.pathA.emitAt,
    ...snap.pathB.runAt,
    ...snap.raf.longFrames.map((f) => f.t),
    ...snap.syncActivityMs.map((s) => s.t),
  ];
  if (times.some((t) => !Number.isFinite(t) || Math.abs(t) > 1e12)) reasons.push("non-finite t");
  if (snap.raf.p50 != null && !Number.isFinite(snap.raf.p50)) reasons.push("p50 sentinel");
  return { ok: reasons.length === 0, reasons };
}

/** 긴 프레임 t 직전 40ms 안에 A emit / B run 이 있으면 상관으로 센다. */
function correlate(snap: Snap) {
  const win = 40;
  const long = snap.raf.longFrames;
  let nearA = 0;
  let nearB = 0;
  let nearEither = 0;
  const rows: Array<{ t: number; dt: number; nearA: boolean; nearB: boolean }> = [];
  for (const lf of long) {
    const a = snap.pathA.emitAt.some((t) => t <= lf.t && lf.t - t <= win);
    const b = snap.pathB.runAt.some((t) => t <= lf.t && lf.t - t <= win);
    if (a) nearA += 1;
    if (b) nearB += 1;
    if (a || b) nearEither += 1;
    if (rows.length < 24) rows.push({ t: lf.t, dt: lf.dt, nearA: a, nearB: b });
  }
  const n = long.length || 1;
  return {
    longFrames: long.length,
    nearA,
    nearB,
    nearEither,
    fracA: nearA / n,
    fracB: nearB / n,
    fracEither: nearEither / n,
    sampleRows: rows,
  };
}

function summarizeMs(xs: number[]): { n: number; p50: number | null; max: number | null } {
  if (xs.length === 0) return { n: 0, p50: null, max: null };
  const s = [...xs].sort((a, b) => a - b);
  return { n: s.length, p50: s[Math.floor(s.length / 2)] ?? null, max: s[s.length - 1] ?? null };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

async function guestStart(page: import("@playwright/test").Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function loadIntroCourse(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문" }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  const items = modal.locator("button.oc-modal__item");
  await expect(items.first()).toBeVisible();
  const n = await items.count();
  await items.nth(Math.max(0, n - 1)).click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function dismissRideSummaryIfAny(page: import("@playwright/test").Page) {
  const summary = page.getByRole("dialog", { name: "주행 결과" });
  if (!(await summary.isVisible().catch(() => false))) return;
  const skip = summary.getByRole("button", { name: "저장 안 함" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  else await summary.getByRole("button", { name: "닫기" }).first().click();
  await expect(summary).toBeHidden({ timeout: 10_000 });
}

async function ensureRiding(page: import("@playwright/test").Page) {
  await dismissRideSummaryIfAny(page);
  if (await page.getByRole("button", { name: "주행 종료" }).isVisible().catch(() => false)) return;
  if (await page.getByRole("button", { name: "재개" }).first().isVisible().catch(() => false)) return;
  const start = page.getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
}

async function ensureDockExpanded(page: import("@playwright/test").Page) {
  await ensureRiding(page);
  const fold = page.getByRole("button", { name: "경로 패널 접기" });
  if (!(await fold.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "경로 패널 펼치기" }).click();
  }
  await expect(page.getByRole("slider", { name: "세션 속도 km/h" })).toBeVisible({ timeout: 10_000 });
}

async function setSpeedKmh(page: import("@playwright/test").Page, kmh: number) {
  await ensureDockExpanded(page);
  await page.getByRole("slider", { name: "세션 속도 km/h" }).fill(String(kmh));
}

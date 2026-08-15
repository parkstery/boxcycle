import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const PHASE = process.env.U3_PHASE === "after" ? "after" : "baseline";
const RIDE_MS = 30_000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const OUT_FILE =
  PHASE === "after"
    ? path.join(OUT_DIR, "U3-camera-trace-after.json")
    : path.join(OUT_DIR, "U3-camera-trace.json");

type Frame = {
  t: number;
  lng: number;
  lat: number;
  bearing: number;
  pitch: number;
  zoom: number;
  centerStepM: number;
  bearingStepDeg: number;
  zoomStep: number;
  riderStepM: number;
  centerStepPx: number;
  mPerPx: number;
};

type Snap = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  sentinelDropped: number;
  frames: Frame[];
};

test.use({
  launchOptions: {
    args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
  },
});

test.describe("U-3 카메라 출력 시계열", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행");

  test(`30s 추적 (${PHASE})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?rideCam=1");
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await setSpeedKmh(page, 20);
    await setFollowLeft(page);
    await setRideDistanceM(page, 1);
    await page.evaluate(() => {
      (window as Window & { __RTW_MAP_TICK_START__?: () => void }).__RTW_MAP_TICK_START__?.();
      (window as Window & { __RTW_CAMERA_TRACE_START__?: () => void }).__RTW_CAMERA_TRACE_START__?.();
    });
    const shotsDir = path.join(OUT_DIR, "U3-shots");
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: path.join(shotsDir, `${PHASE}.png`), fullPage: false });
    const t0 = Date.now();
    await page.waitForTimeout(RIDE_MS);
    while (Date.now() - t0 < 90_000) {
      const n = await page.evaluate(
        () => (window as Window & { __RTW_CAMERA_TRACE_COUNT__?: number }).__RTW_CAMERA_TRACE_COUNT__ ?? 0,
      );
      if (n >= 500) break;
      await page.waitForTimeout(2_000);
    }
    const snap = (await page.evaluate(() => {
      const w = window as Window & { __RTW_CAMERA_TRACE_STOP__?: () => Snap | null };
      return w.__RTW_CAMERA_TRACE_STOP__?.() ?? null;
    })) as Snap | null;
    expect(snap, "camera trace snapshot").toBeTruthy();

    const p0 = assertP0(snap!);
    const verdict = analyze(snap!.frames);
    const r1 = await layerOrder(page);
    const r2 = await styleReloadRecover(page);
    const r3 = await page.evaluate(() => {
      const w = window as Window & {
        __RTW_MAP_TICK_STOP__?: () => {
          pathA?: { emit: number };
          moveToTopMs?: unknown[];
        } | null;
      };
      return w.__RTW_MAP_TICK_STOP__?.() ?? null;
    });

    const payload = {
      phase: PHASE,
      p0,
      verdict,
      r1,
      r2,
      r3,
      durationMs: snap!.durationMs,
      sentinelDropped: snap!.sentinelDropped,
      frameCount: snap!.frames.length,
      zoomMin: min(snap!.frames.map((f) => f.zoom)),
      zoomMax: max(snap!.frames.map((f) => f.zoom)),
      frames: snap!.frames,
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
    expect(p0.ok, `P0 실패: ${p0.reasons.join(",")}`).toBe(true);
  });
});

function assertP0(snap: Snap): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (snap.sentinelDropped !== 0) reasons.push(`sentinel=${snap.sentinelDropped}`);
  if (snap.frames.length < 500) reasons.push(`frames=${snap.frames.length}<500`);
  let last = -Infinity;
  for (const f of snap.frames) {
    if (!Number.isFinite(f.t) || f.t < last) {
      reasons.push("t not monotonic");
      break;
    }
    last = f.t;
  }
  return { ok: reasons.length === 0, reasons };
}

function analyze(frames: Frame[]) {
  const skip = frames.slice(2);
  const px = skip.map((f) => f.centerStepPx);
  const rider = skip.map((f) => f.riderStepM);
  const brg = skip.map((f) => f.bearingStepDeg);
  const z = skip.map((f) => f.zoomStep);
  const altPx = countAlternating(px);
  const altRider = countAlternating(rider);
  const signFlipBrg = countSignFlips(brg);
  const evenOddPx = evenOddMeans(px);
  const evenOddRider = evenOddMeans(rider);
  const excerpt = skip.slice(40, 56).map((f) => ({
    t: f.t,
    centerStepPx: f.centerStepPx,
    riderStepM: f.riderStepM,
    bearingStepDeg: f.bearingStepDeg,
    zoom: f.zoom,
    zoomStep: f.zoomStep,
  }));
  const zoomAt24 = skip.filter((f) => f.zoom >= 23.99).length;
  const pxNearZero = px.filter((v) => v < 5).length;
  const altFracPx = px.length > 2 ? altPx / (px.length - 2) : 0;
  const altFracRider = rider.length > 2 ? altRider / (rider.length - 2) : 0;
  const evenOddImbalance = Math.abs(1 - (evenOddPx.ratio || 1));
  return {
    n: skip.length,
    altFracPx,
    altFracRider,
    signFlipBrgFrac: brg.length > 1 ? signFlipBrg / (brg.length - 1) : 0,
    zoomStepAbsMean: mean(z.map(Math.abs)),
    zoomAt24Frac: skip.length ? zoomAt24 / skip.length : 0,
    pxP50: percentile(px, 0.5),
    pxP95: percentile(px, 0.95),
    riderP50: percentile(rider, 0.5),
    evenOddPx,
    evenOddRider,
    pxNearZero,
    excerpt,
    phaseFingerprint:
      evenOddImbalance >= 0.25 &&
      pxNearZero > skip.length * 0.15 &&
      altFracRider < 0.35,
  };
}

function evenOddMeans(xs: number[]): { even: number; odd: number; ratio: number | null } {
  const e: number[] = [];
  const o: number[] = [];
  xs.forEach((v, i) => (i % 2 ? o : e).push(v));
  const even = mean(e);
  const odd = mean(o);
  return { even, odd, ratio: odd === 0 ? null : even / odd };
}

function countAlternating(xs: number[]): number {
  let n = 0;
  for (let i = 2; i < xs.length; i += 1) {
    const d0 = xs[i - 1]! - xs[i - 2]!;
    const d1 = xs[i]! - xs[i - 1]!;
    if (d0 === 0 || d1 === 0) continue;
    if (d0 * d1 < 0) n += 1;
  }
  return n;
}

function countSignFlips(xs: number[]): number {
  let n = 0;
  for (let i = 1; i < xs.length; i += 1) {
    if (xs[i]! === 0 || xs[i - 1]! === 0) continue;
    if (xs[i]! * xs[i - 1]! < 0) n += 1;
  }
  return n;
}

function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))] ?? null;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function min(xs: number[]): number | null {
  return xs.length ? Math.min(...xs) : null;
}
function max(xs: number[]): number | null {
  return xs.length ? Math.max(...xs) : null;
}

async function layerOrder(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const map = (window as Window & { __RTW_MAP__?: { getStyle: () => { layers?: { id: string }[] } } })
      .__RTW_MAP__;
    const ids = (map?.getStyle()?.layers ?? []).map((l) => l.id);
    const route = ids.indexOf("route");
    const pulse = ids.indexOf("boxcycle-activity-pulse-dots-layer");
    const heat = ids.indexOf("boxcycle-activity-heat-dots-layer");
    return { route, pulse, heat, pulseAboveRoute: pulse > route && pulse >= 0 && route >= 0 };
  });
}

async function styleReloadRecover(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const map = (
      window as Window & {
        __RTW_MAP__?: {
          getStyle: () => unknown;
          setStyle: (s: unknown) => void;
          once: (ev: string, fn: () => void) => void;
        };
      }
    ).__RTW_MAP__;
    if (!map) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      map.once("style.load", done);
      map.setStyle(map.getStyle());
      setTimeout(done, 8_000);
    });
  });
  await page.waitForTimeout(1_500);
  return layerOrder(page);
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

async function openMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (await sheet.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: "맵 뷰 설정" }).click();
  await expect(sheet).toBeVisible({ timeout: 10_000 });
}

async function closeMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (!(await sheet.isVisible().catch(() => false))) return;
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function setFollowLeft(page: import("@playwright/test").Page) {
  await openMapSheet(page);
  await page
    .getByRole("dialog", { name: "맵 뷰" })
    .getByRole("button", { name: "좌측", exact: true })
    .click({ force: true });
  await closeMapSheet(page);
}

async function setRideDistanceM(page: import("@playwright/test").Page, m: number) {
  await openMapSheet(page);
  const slider = page.getByRole("slider", { name: /거리 / });
  await slider.fill(String(m));
  await closeMapSheet(page);
}

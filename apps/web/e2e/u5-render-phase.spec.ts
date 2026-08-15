import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const OUT_FILE = path.join(OUT_DIR, "U5-render-phase.json");

type Render = {
  t: number;
  zoom: number;
  adoptedSeq: number;
  lagFrames: number;
  writeZoom: number | null;
};

type Snap = {
  durationMs: number;
  sentinelDropped: number;
  writeCount: number;
  renderCount: number;
  writes: { seq: number; t: number; zoom: number }[];
  renders: Render[];
};

test.use({
  headless: false,
  launchOptions: {
    args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
  },
});

test.describe("U-5 Mapbox render 카메라 채택", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행");

  test("5km/h 1m 좌측 headed", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?rideCam=1");
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await setSpeedKmh(page, 5);
    await setFollowLeft(page);
    await setRideDistanceM(page, 1);
    await page.evaluate(() => {
      (window as Window & { __RTW_CAMERA_PHASE_START__?: () => void }).__RTW_CAMERA_PHASE_START__?.();
    });
    const t0 = Date.now();
    await page.waitForTimeout(30_000);
    while (Date.now() - t0 < 90_000) {
      const n = await page.evaluate(() => {
        const w = window as Window & {
          __RTW_CAMERA_PHASE_WRITE_N__?: number;
          __RTW_CAMERA_PHASE_RENDER_N__?: number;
        };
        return { w: w.__RTW_CAMERA_PHASE_WRITE_N__ ?? 0, r: w.__RTW_CAMERA_PHASE_RENDER_N__ ?? 0 };
      });
      if (n.w >= 500 && n.r >= 500) break;
      await page.waitForTimeout(2_000);
    }
    const snap = (await page.evaluate(() => {
      const w = window as Window & { __RTW_CAMERA_PHASE_STOP__?: () => Snap | null };
      return w.__RTW_CAMERA_PHASE_STOP__?.() ?? null;
    })) as Snap | null;
    expect(snap, "phase snapshot").toBeTruthy();

    const q0 = assertQ0(snap!);
    const q2 = analyze(snap!);
    const payload = {
      headed: true,
      speedKmh: 5,
      distanceM: 1,
      follow: "leftFlat",
      q0,
      q2,
      durationMs: snap!.durationMs,
      sentinelDropped: snap!.sentinelDropped,
      writeCount: snap!.writeCount,
      renderCount: snap!.renderCount,
      lagExcerpt: snap!.renders.slice(40, 56).map((r) => ({
        t: r.t,
        lagFrames: r.lagFrames,
        adoptedSeq: r.adoptedSeq,
        zoom: r.zoom,
        writeZoom: r.writeZoom,
      })),
      renders: snap!.renders,
      writes: snap!.writes,
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
    expect(q0.ok, `Q0 실패: ${q0.reasons.join(",")}`).toBe(true);
  });
});

function assertQ0(snap: Snap): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (snap.sentinelDropped !== 0) reasons.push(`sentinel=${snap.sentinelDropped}`);
  if (snap.writeCount < 500) reasons.push(`writes=${snap.writeCount}<500`);
  if (snap.renderCount < 500) reasons.push(`renders=${snap.renderCount}<500`);
  let last = 0;
  for (const w of snap.writes) {
    if (!Number.isFinite(w.seq) || w.seq < last) {
      reasons.push("seq not monotonic");
      break;
    }
    last = w.seq;
  }
  return { ok: reasons.length === 0, reasons };
}

function analyze(snap: Snap) {
  const lags = snap.renders.map((r) => r.lagFrames);
  const hist: Record<string, number> = {};
  for (const L of lags) hist[String(L)] = (hist[String(L)] ?? 0) + 1;
  let alt01 = 0;
  let pairs = 0;
  for (let i = 1; i < lags.length; i += 1) {
    const a = lags[i - 1]!;
    const b = lags[i]!;
    if ((a === 0 || a === 1) && (b === 0 || b === 1)) {
      pairs += 1;
      if (a !== b) alt01 += 1;
    }
  }
  const altFrac = pairs > 0 ? alt01 / pairs : 0;
  const always0 = lags.length > 0 && lags.every((L) => L === 0);
  const ratio = snap.writeCount === 0 ? null : snap.renderCount / snap.writeCount;
  const zoomGet = snap.renders.map((r) => r.zoom);
  const zoomWrite = snap.writes.map((w) => w.zoom);
  return {
    lagHist: hist,
    alt01Frac: altFrac,
    always0,
    phaseFingerprint: altFrac >= 0.45 && !always0,
    renderWriteRatio: ratio,
    zoomGetMin: zoomGet.length ? Math.min(...zoomGet) : null,
    zoomGetMax: zoomGet.length ? Math.max(...zoomGet) : null,
    zoomWriteMin: zoomWrite.length ? Math.min(...zoomWrite) : null,
    zoomWriteMax: zoomWrite.length ? Math.max(...zoomWrite) : null,
  };
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

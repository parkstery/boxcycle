import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const SHOT = process.env.U5_SHOT === "restored" ? "restored-1m" : "before-1m";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay/U5-shots");

test.describe("U-5 1m 좌측 팔로우 샷", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행");

  test(`${SHOT}.png`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?rideCam=1");
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await setSpeedKmh(page, 5);
    await setFollowLeft(page);
    await setRideDistanceM(page, 1);
    await page.evaluate(() => {
      (window as Window & { __RTW_MAP_TICK_START__?: () => void }).__RTW_MAP_TICK_START__?.();
    });
    await page.waitForTimeout(8_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(OUT_DIR, `${SHOT}.png`), fullPage: false });

    const r1 = await layerOrder(page);
    const r3 = await page.evaluate(() => {
      const w = window as Window & {
        __RTW_MAP_TICK_STOP__?: () => { pathA?: { emit: number }; moveToTopMs?: unknown[] } | null;
      };
      return w.__RTW_MAP_TICK_STOP__?.() ?? null;
    });
    fs.writeFileSync(
      path.join(OUT_DIR, `${SHOT}.json`),
      JSON.stringify({ shot: SHOT, r1, pathA: r3?.pathA ?? null, moveToTopN: r3?.moveToTopMs?.length ?? null }),
    );
    expect(r1.pulseAboveRoute, "activity pulse above route").toBe(true);
    expect(r3?.pathA?.emit ?? -1, "path A emit").toBe(0);
  });
});

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

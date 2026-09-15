import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 계정 패널 정비 계약 (2026-09-15 Chief 채택안).
 *
 *   - 기간 축은 하나: 오늘 · 주간 · 월간 · 연간, 기본 「오늘」
 *   - 통계 타일 세트는 **한 벌**(종전 일일 + 기간 = 두 벌)
 *   - 거리 히어로 1개
 *   - 「마지막 주행」 카드가 곧 최근 주행 목록의 입구(별도 행 없음)
 *
 * 실행: npm run test:e2e:account-panel -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/account-panel");

test.describe("계정 패널", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:account-panel");

  test("기간 축 하나 · 통계 한 벌 · 마지막 주행이 목록 입구", async ({ page }) => {
    test.setTimeout(150_000);
    // 앱은 폰 세로에서 「화면 회전 안내」 오버레이를 띄운다 — 실제 사용 형태인 가로로 본다.
    await page.setViewportSize({ width: 932, height: 430 });
    await page.goto("/");
    await guestStart(page);
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await page.getByRole("button", { name: "주행 종료" }).click();
    await dismissRideSummaryIfAny(page);

    await page.getByRole("button", { name: "사용자 정보" }).click();
    const sheet = page.getByRole("dialog", { name: "사용자 정보" });
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    // 1) 기간 탭 4개, 「오늘」이 맨 앞이자 기본 선택
    const tabs = sheet.getByRole("tab");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toHaveText("오늘");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toHaveText("주간");
    await expect(tabs.nth(2)).toHaveText("월간");
    await expect(tabs.nth(3)).toHaveText("연간");

    // 2) 통계 타일 세트는 한 벌뿐 — 종전 회귀(일일 + 기간 = 두 벌) 고정
    await expect(page.locator(".user-info-sheet__stats")).toHaveCount(1);
    await expect(page.locator(".user-info-sheet__stats > div")).toHaveCount(3);
    await expect(page.locator(".user-info-sheet__stats-hero")).toHaveCount(1);

    // 3) 중복 표시가 사라졌다
    await expect(page.locator(".user-info-sheet__snapshot")).toHaveCount(0);
    await expect(page.locator(".user-info-sheet__stats-cal")).toHaveCount(0);
    await expect(page.locator(".user-info-sheet__h-toggle")).toHaveCount(0);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(OUT_DIR, "today.png") });

    // 4) 기간 전환이 같은 한 블록을 바꾼다
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".user-info-sheet__stats")).toHaveCount(1);
    await page.screenshot({ path: path.join(OUT_DIR, "week.png") });

    // 5) 마지막 주행 카드가 최근 주행 목록을 연다
    const lastRide = page.locator(".user-info-sheet__last-ride");
    await expect(lastRide).toHaveCount(1);
    await expect(lastRide).toHaveAttribute("aria-expanded", "false");
    await lastRide.click();
    await expect(lastRide).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#user-info-sheet-history-list")).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, "history-open.png") });
  });
});

async function guestStart(page: import("@playwright/test").Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function armRideInput(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "체험 속도로 준비" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function loadIntroCourse(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문" }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  const items = modal.locator("button.oc-modal__item");
  await expect(items.first()).toBeVisible();
  await items.first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function dismissRideSummaryIfAny(page: import("@playwright/test").Page) {
  const summary = page.getByRole("dialog", { name: "주행 결과" });
  if (!(await summary.isVisible({ timeout: 8_000 }).catch(() => false))) return;
  const skip = summary.getByRole("button", { name: "저장 안 함" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  else await summary.getByRole("button", { name: "닫기" }).first().click();
  await expect(summary).toBeHidden({ timeout: 10_000 });
}

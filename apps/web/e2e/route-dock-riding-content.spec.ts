import { test, expect } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 주행 중 RouteDock 계약 — Chief 의도(2026-09-28, 2026-09-15 의도를 뒤집음):
 *   "주행이 시작돼도 패널을 자동으로 접지 마라. 접으면 스톱 메뉴를 찾기 어렵다.
 *    접을 사용자는 스스로 접는다."
 *
 * 회귀 방지 대상 둘:
 *   1) 주행 시작 시 패널이 제멋대로 접히는 것(자동 접힘 부활)
 *   2) 펼친 패널이 **빈 껍데기**가 되는 것(경유지 목록 소실)
 *
 * 실행: npm run test:e2e:route-dock -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/route-dock");

test.describe("주행 중 RouteDock", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:route-dock");

  test("주행 시작해도 펼친 채로 남고, 경로 내용·주행 제어가 보인다", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await guestStart(page);
    await armRideInput(page);
    await loadIntroCourse(page);

    // 주행 전 — 펼쳐져 있고 경유지 목록이 보인다
    const stops = page.locator(".route-dock__stops li");
    await expect(stops.first()).toBeVisible({ timeout: 15_000 });
    const beforeCount = await stops.count();
    expect(beforeCount, "주행 전 경유지 수").toBeGreaterThan(0);

    await startRide(page);

    // 1) 자동 접힘 없음 — 접기 버튼이 그대로다(= 펼친 상태 유지)
    await expect(
      page.getByRole("button", { name: "경로 패널 접기" }),
      "주행 시작해도 펼친 상태를 유지한다",
    ).toBeVisible({ timeout: 15_000 });
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // 2) 주행 제어가 헤더에 그대로 있다 — 멈추려는 사용자가 찾아 헤맬 곳이 없어야 한다
    await expect(page.getByRole("button", { name: "일시정지" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeEnabled();

    // 3) 내용이 보인다 — 빈 껍데기가 아니어야 한다
    await expect(stops.first(), "주행 중 펼친 패널에 경유지가 보여야 한다").toBeVisible({
      timeout: 10_000,
    });
    expect(await stops.count(), "주행 중 경유지 수").toBe(beforeCount);
    const firstLabel = (await page.locator(".route-dock__stop-label").first().innerText()).trim();
    expect(firstLabel.length, "경유지 라벨이 비어 있지 않아야 한다").toBeGreaterThan(0);
    await page.screenshot({ path: path.join(OUT_DIR, "riding-expanded.png") });

    // 4) 표시는 하되 조작은 잠근다 — 주행 중 경로 변형 방지
    const removes = page.locator(".route-dock__stop-remove");
    for (let i = 0; i < (await removes.count()); i += 1) {
      await expect(removes.nth(i), "주행 중 경유지 삭제는 잠금").toBeDisabled();
    }
  });
});

async function guestStart(page: import("@playwright/test").Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

/**
 * 주행 입력 준비 — Go 의 사전조건(SENSOR-2 §1.4). e2e 에는 BLE 장치가 없으므로
 * 센서 시트에서 「센서 없음」를 명시적으로 고른다(ride-entry.spec 과 동일).
 */
async function armRideInput(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "센서 없음" }).click();
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
  const n = await items.count();
  await items.nth(Math.max(0, n - 1)).click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function startRide(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "주행 시작" }).click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeEnabled({ timeout: 30_000 });
}

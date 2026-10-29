import { test, expect } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guestStart as sharedGuestStart, prepareManualRideInput } from "./rideEntryHelpers";

/**
 * 주행 중 RouteDock 계약 — Chief 의도(2026-10-24):
 *   주행 시작 시 주소 카드는 **접힌 상태**(› 펼치기). 숨기지 않는다.
 *   펼치면 경유지 수·라벨은 주행 전과 같고, 일시정지·종료는 RideControlBar 에 유지.
 *
 * 회귀 방지:
 *   1) 접힌 채로 남아야 하며 펼치기로 다시 볼 수 있어야 한다
 *   2) 펼친 패널이 **빈 껍데기**가 되는 것(경유지 목록 소실)
 *
 * 실행: npm run test:e2e:route-dock -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.UI_REVALIDATION_EVIDENCE_DIR ?? path.resolve(__dirname, "../.out/route-dock");

test.describe("주행 중 RouteDock", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:route-dock");

  test("주행 시작하면 접히고, 펼치면 경로 내용·주행 제어가 보인다", async ({ page }) => {
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
    // 주소 라벨이 「불러오는 중」에 멈추지 않는다 — 역지오코딩 결과가 렌더에 반영된다
    await expect(page.locator(".route-dock__label").first()).not.toHaveText("주소 불러오는 중…", {
      timeout: 15_000,
    });
    await page.screenshot({ path: path.join(OUT_DIR, "stops-labeled.png") });

    await startRide(page);

    fs.mkdirSync(OUT_DIR, { recursive: true });

    // 1) 주행 시작 시 접힘 — › 로 다시 펼칠 수 있다
    await expect(
      page.getByRole("button", { name: "경로 패널 펼치기" }),
      "주행 시작하면 접힌 상태로 시작한다",
    ).toBeVisible({ timeout: 15_000 });

    const collapsedCard = page.locator(".route-dock__card");
    const collapsedCardBox = (await collapsedCard.boundingBox())!;
    expect(collapsedCardBox.width).toBeGreaterThanOrEqual(28);
    expect(collapsedCardBox.width).toBeLessThanOrEqual(44);
    expect(collapsedCardBox.height).toBeGreaterThanOrEqual(28);
    expect(collapsedCardBox.height).toBeLessThanOrEqual(44);

    const collapsedGeometry = await page.evaluate(() => {
      const cardEl = document.querySelector(".route-dock__card")!;
      const ledEl = document.querySelector(".route-dock__led-toggle")!;
      const cardR = cardEl.getBoundingClientRect();
      const ledR = ledEl.getBoundingClientRect();
      const cx = ledR.x + ledR.width / 2;
      const cy = ledR.y + ledR.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const cardStyle = getComputedStyle(cardEl);
      const inViewport =
        ledR.left >= 0 &&
        ledR.top >= 0 &&
        ledR.right <= window.innerWidth &&
        ledR.bottom <= window.innerHeight;
      const ledInsideCard =
        ledR.left >= cardR.left - 0.5 &&
        ledR.top >= cardR.top - 0.5 &&
        ledR.right <= cardR.right + 0.5 &&
        ledR.bottom <= cardR.bottom + 0.5;
      const hitOk = hit === ledEl || ledEl.contains(hit);
      return { inViewport, ledInsideCard, hitOk, cardBg: cardStyle.backgroundColor };
    });
    expect(collapsedGeometry.inViewport).toBe(true);
    expect(collapsedGeometry.ledInsideCard).toBe(true);
    expect(collapsedGeometry.hitOk).toBe(true);
    expect(collapsedGeometry.cardBg === "rgba(0, 0, 0, 0)" || collapsedGeometry.cardBg === "transparent").toBeTruthy();

    await page.screenshot({ path: path.join(OUT_DIR, "riding-collapsed.png") });

    await expect(page.locator(".route-dock__stops")).toBeHidden();

    // 2) 주행 제어는 RideControlBar 에 그대로
    await expect(page.getByRole("button", { name: "일시정지" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeEnabled();

    await page.getByRole("button", { name: "경로 패널 펼치기" }).click();

    // 3) 펼치면 내용이 보인다 — 빈 껍데기가 아니어야 한다
    await expect(stops.first(), "주행 중 펼친 패널에 경유지가 보여야 한다").toBeVisible({
      timeout: 10_000,
    });
    expect(await stops.count(), "주행 중 경유지 수").toBe(beforeCount);
    const firstLabel = (await page.locator(".route-dock__label").first().innerText()).trim();
    expect(firstLabel.length, "경유지 라벨이 비어 있지 않아야 한다").toBeGreaterThan(0);
    await page.screenshot({ path: path.join(OUT_DIR, "riding-expanded.png") });

    // 4) 표시는 하되 조작은 잠근다 — 주행 중 경유지 삭제·바꾸기 UI 는 렌더하지 않는다
    await expect(page.locator(".route-dock__remove"), "주행 중 경유지 삭제는 잠금").toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start·End 바꾸기" })).toHaveCount(0);
  });
});

async function guestStart(page: import("@playwright/test").Page) {
  await sharedGuestStart(page);
}

/**
 * 주행 입력 준비 — Go 의 사전조건(SENSOR-2 §1.4). e2e 에는 BLE 장치가 없으므로
 * 센서 시트에서 「센서 없음」를 명시적으로 고른다(ride-entry.spec 과 동일).
 */
async function armRideInput(page: import("@playwright/test").Page) {
  await prepareManualRideInput(page);
}

async function loadIntroCourse(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "입문", exact: true }).click();
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

import { test, expect } from "./open-meteo-stub";
import { guestStart } from "./rideEntryHelpers";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";

/**
 * 지도 롱프레스 경로 선택 — 800×360 계약.
 * Firebase 에뮬레이터 필요. 짧은 클릭은 팝업 없음, 길게 누르면 경로 생성 UI.
 */
test.describe("지도 롱프레스 경로 선택", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — RIDE_VERIFY_LIVE=1");

  test("짧은 탭은 팝업 없음·롱프레스 후 경로 생성 UI", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto("/");
    await guestStart(page);

    const map = page.locator(".mapboxgl-canvas").first();
    await expect(map).toBeVisible({ timeout: 30_000 });

    const cx = 400;
    const cy = 180;
    await map.click({ position: { x: cx, y: cy } });
    await expect(page.locator(".map-view__pick").last()).toHaveCount(0);

    await map.dispatchEvent("pointerdown", {
      pointerId: 1,
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      pointerType: "touch",
    });
    await page.waitForTimeout(550);
    await map.dispatchEvent("pointerup", {
      pointerId: 1,
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      pointerType: "touch",
    });

    await expect(page.locator(".map-view__pick").last()).toBeVisible({ timeout: 20_000 });
  });
});

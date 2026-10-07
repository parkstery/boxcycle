import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 주행 스토리 — Chief 예시 장면(2026-10-07) 캡처.
 *   「오늘 2번째 라이딩 · 경로를 다 끝내지 못함」 → 결과 시트 맨 위에 헤드라인 + 사실 한 줄.
 * 오늘 오전 3km 주행 1건을 이 기기 기록(localStorage)에 심어 두고, 입문 경로를 조금 달린 뒤 멈춘다.
 *
 * 실행(apps/web): node scripts/e2e/run-with-functions-emulator.mjs "npx playwright test ride-story-shots --workers=1 --retries=0"
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/ride-story");
const SESSIONS_KEY = "boxcycle_web_ride_sessions_v1";

test.describe("주행 스토리", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요");

  for (const vp of [
    { name: "690x275", width: 690, height: 275 },
    { name: "1280x800", width: 1280, height: 800 },
  ]) {
    test(`오늘 두 번째·미완주 — 헤드라인과 남은 거리 (${vp.name})`, async ({ page }) => {
      test.setTimeout(180_000);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await guestStart(page);

      const morning = new Date();
      morning.setHours(8, 0, 0, 0);
      await page.evaluate(
        ([key, iso]) => {
          localStorage.setItem(
            key,
            JSON.stringify([
              {
                id: "seed-morning",
                endedAt: iso,
                elapsedSec: 900,
                distanceMeters: 3000,
                avgSpeedKmh: 12,
                caloriesEstimate: null,
                routeDistanceMeters: 3000,
                routeDurationSec: 900,
              },
            ]),
          );
        },
        [SESSIONS_KEY, morning.toISOString()] as const,
      );
      await page.reload();
      await armRideInput(page, 50);
      await loadIntroCourse(page);
      await page.getByRole("button", { name: "주행 시작" }).click();
      await expect(page.getByRole("button", { name: "주행 종료" })).toBeEnabled({ timeout: 30_000 });
      await expect
        .poll(() => readCumulativeKm(page), { timeout: 90_000, intervals: [500] })
        .toBeGreaterThan(0.15);
      await page.getByRole("button", { name: "주행 종료" }).click();

      const sheet = page.getByRole("dialog", { name: "주행 결과" });
      await expect(sheet).toBeVisible({ timeout: 30_000 });
      const headline = sheet.locator(".ride-summary__story-headline");
      const detail = sheet.locator(".ride-summary__story-detail");
      await expect(headline).toHaveText("오늘 두 번째 라이딩이에요. 다시 페달을 밟으셨네요.");
      await expect(detail).toContainText(/^\d+\.\dkm 중 \d+\.\dkm · 남은 \d+\.\dkm/);
      await expect(detail).toContainText("오늘 2번 · 합계 3.");
      console.log(`[ride-story] ${vp.name} headline=${await headline.textContent()} | detail=${await detail.textContent()}`);

      const m = await sheet.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { scroll: el.scrollHeight, client: el.clientHeight, top: r.top, bottom: r.bottom };
      });
      console.log(`[ride-story] ${vp.name} sheet=${JSON.stringify(m)}`);
      expect(m.scroll, "시트가 스크롤되면 안 된다").toBe(m.client);
      expect(m.bottom).toBeLessThanOrEqual(vp.height);

      // 결함(2026-10-07) — 종료 후 계기가 초기화돼도 시간·평속은 결과값을 지킨다(「00:00 · 0.0 km/h」 금지)
      await page.waitForTimeout(3_000);
      const sub = ((await sheet.locator(".ride-summary__substats").textContent()) ?? "").replace(/\s+/g, " ");
      console.log(`[ride-story] ${vp.name} substats=${sub}`);
      expect(sub, "경과 시간이 00:00 으로 초기화되면 안 된다").not.toContain("00:00");
      expect(sub, "평속이 0.0 으로 초기화되면 안 된다").not.toMatch(/(^|\s)0\.0\s*km\/h/);

      await page.screenshot({ path: path.join(OUT_DIR, `ride-end-${vp.name}.png`) });
      await sheet.screenshot({ path: path.join(OUT_DIR, `ride-end-sheet-${vp.name}.png`) });

      // M1 — 시트를 닫으면 다음 주행 카드가 스토리 한 줄로 이어 간다(오늘 이미 탔다)
      const skip = sheet.getByRole("button", { name: "저장 안 함" });
      if (await skip.count()) await skip.click();
      else await sheet.getByRole("button", { name: "닫기" }).first().click();
      const card = page.locator(".next-ride-anchor");
      await expect(card).toBeVisible({ timeout: 20_000 });
      const story = card.locator(".next-ride__story");
      await expect(story).toBeVisible();
      console.log(`[ride-story] ${vp.name} next-ride=${(await story.textContent())?.trim()}`);
      await expect(story).toHaveText(/오늘 한 번 더 이어 가 볼까요\?|절반을 넘으셨어요/);
      await card.screenshot({ path: path.join(OUT_DIR, `next-ride-${vp.name}.png`) });
      await page.screenshot({ path: path.join(OUT_DIR, `next-ride-full-${vp.name}.png`) });
    });
  }
});

async function readCumulativeKm(page: Page): Promise<number> {
  const value = page.locator(".hud-metrics__cell--w-distance .hud-metrics__value").first();
  const text = (await value.textContent().catch(() => null)) ?? "";
  const match = text.match(/([\d.]+)/);
  return match ? parseFloat(match[1]!) : NaN;
}

async function guestStart(page: Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function armRideInput(page: Page, speedKmh: number) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "센서 없음" }).click();
  const speedInput = sheet.getByRole("spinbutton", { name: "속도 km/h" });
  if (await speedInput.count()) {
    await speedInput.fill(String(speedKmh));
    await speedInput.blur();
  }
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function loadIntroCourse(page: Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문" }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  const items = modal.locator("button.oc-modal__item");
  await expect(items.first()).toBeVisible();
  await items.nth(Math.max(0, (await items.count()) - 1)).click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

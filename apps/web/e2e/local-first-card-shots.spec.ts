import { test, expect } from "./open-meteo-stub";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 첫 Ready Ride 카드(LocalFirstEntryCard) 캡처·실측 — UI 공간밀도 원칙 §3 보고용.
 * 폰 가로 근사 740×300 과 PC 1280×900 에서 카드 rect·칩 크기·넘침을 잰다.
 *
 * 실행: node scripts/e2e/run-with-functions-emulator.mjs "playwright test local-first-card-shots --workers=1 --retries=0"
 * SHOT_LABEL=before|after 로 파일 이름을 나눈다.
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/local-first");
const LABEL = process.env.SHOT_LABEL ?? "shot";

const WONJU_REGION = {
  name: "단구동",
  lngLat: [127.9386, 37.3215],
  zoom: 13,
  source: "search",
  at: "2026-10-07T00:00:00.000Z",
};

for (const vp of [
  { width: 740, height: 300 },
  { width: 1280, height: 900 },
]) {
  test(`첫 Ready Ride 카드 ${vp.width}x${vp.height}`, async ({ page }) => {
    test.skip(!LIVE, "Firebase 에뮬레이터 필요");
    test.setTimeout(120_000);
    await page.setViewportSize(vp);
    await page.addInitScript((region) => {
      localStorage.setItem("rtw.localFirst.region", JSON.stringify(region));
    }, WONJU_REGION);
    await page.goto("/");
    const gate = page.getByRole("dialog", { name: "시작" });
    await expect(gate).toBeVisible({ timeout: 30_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 30_000 });

    const card = page.locator(".local-first__card");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".local-first__chip").first()).toBeVisible();

    const m = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const rect = (e: Element) => {
        const b = e.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const chips = [...el.querySelectorAll(".local-first__chip")].map(rect);
      const targets = [...el.querySelectorAll("button")].map(rect);
      const clipped = chips.filter((c) => c.x + c.w > r.right + 0.5).length;
      return {
        card: rect(el),
        chips,
        clippedChips: clipped,
        minTargetH: Math.min(...targets.map((t) => t.h)),
        intro: el.querySelector(".local-first__link") ? rect(el.querySelector(".local-first__link")!) : null,
      };
    });
    const vpArea = vp.width * vp.height;
    console.log(
      `[local-first ${LABEL} ${vp.width}x${vp.height}]`,
      JSON.stringify({ ...m, areaPct: +((m.card.w * m.card.h * 100) / vpArea).toFixed(2) }),
    );
    await page.screenshot({ path: path.join(OUT_DIR, `${LABEL}-${vp.width}.png`) });
    await card.screenshot({ path: path.join(OUT_DIR, `${LABEL}-${vp.width}-card.png`) });
  });
}

test("경로를 만든 뒤 거리 칩을 누르면 그 거리로 다시 만든다", async ({ page }) => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((region) => {
    localStorage.setItem("rtw.localFirst.region", JSON.stringify(region));
  }, WONJU_REGION);
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });

  const card = page.locator(".local-first__card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  const isRoutePost = (r: import("@playwright/test").Response) =>
    r.request().method() === "POST" &&
    r.url().includes("getDistanceAutoRoute") &&
    !(r.request().postData() ?? "").includes('"warm":true');

  const first = page.waitForResponse(isRoutePost, { timeout: 120_000 });
  await card.getByRole("button", { name: "시작", exact: true }).click();
  expect((await first).ok()).toBe(true);
  await expect(card.getByRole("button", { name: "다른 경로" })).toBeVisible({ timeout: 30_000 });

  const second = page.waitForResponse(isRoutePost, { timeout: 120_000 });
  await card.getByRole("button", { name: "5 km" }).click();
  const resp = await second;
  const sent = resp.request().postDataJSON() as { data?: { targetDistanceMeters?: number } };
  expect(sent.data?.targetDistanceMeters).toBe(5000);
  await expect(card.getByRole("button", { name: "5 km" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: path.join(OUT_DIR, "regenerated-5km.png") });
});


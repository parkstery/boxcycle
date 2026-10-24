/**
 * LocalFirstEntryCard 첫 방문(지역 확정 후) — 800×360 before 캡처. Firebase 에뮬레이터 필요.
 * node scripts/e2e/run-with-functions-emulator.mjs "node document/ops/20261023-ui-redesign/evidence/entry-card-history/capture-first-card.mjs"
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.CAPTURE_BASE_URL ?? `http://127.0.0.1:${process.env.RTW_DEV_PORT ?? "5002"}`;

const WONJU_REGION = {
  name: "단구동",
  lngLat: [127.9386, 37.3215],
  zoom: 13,
  source: "search",
  at: "2026-10-07T00:00:00.000Z",
};

async function guestStart(page) {
  const intro = page.getByRole("region", { name: "앱 소개" });
  if (await intro.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "게스트로 시작" }).click();
  }
  const location = page.getByRole("dialog", { name: "어디에서 시작할까요?" });
  if (await location.isVisible().catch(() => false)) {
    const rome = location.getByRole("button", { name: "기본 위치" });
    if (await rome.isVisible().catch(() => false)) {
      await rome.click();
      await location.waitFor({ state: "hidden", timeout: 15_000 });
    }
  }
  await page.getByRole("button", { name: "사용자 정보" }).waitFor({ state: "visible", timeout: 60_000 });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
  await page.addInitScript((region) => {
    localStorage.setItem("rtw.localFirst.region", JSON.stringify(region));
  }, WONJU_REGION);
  await page.goto(`${base}/`);
  await guestStart(page);
  const card = page.locator(".local-first__card");
  await card.waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText("어디에서 첫 라이딩을 할까요?").waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  const out = path.join(__dirname, "before-first-visit-card-800x360.png");
  await page.screenshot({ path: out, fullPage: false });
  console.log("wrote", out);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

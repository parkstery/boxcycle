/**
 * 지시04 정정 §4 — 경로 기하가 보이는 캡처는 반드시 실 운영 백엔드로.
 * 인터셉트 없음. npm run dev(운영 백엔드, 이미 기동 중)를 그대로 사용.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi04");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5000";

fs.mkdirSync(OUT, { recursive: true });
async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name);
}
async function enterGuest(page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => { try { localStorage.removeItem("rtw.localFirst.region"); } catch {} });
  await page.reload({ waitUntil: "domcontentloaded" });
  const gate = page.getByRole("dialog", { name: "시작" });
  if (await gate.isVisible({ timeout: 5000 }).catch(() => false)) {
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
}
async function waitCard(page) {
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
}
async function pickRegion(page, query) {
  await page.getByRole("button", { name: "지역 선택" }).click();
  await page.waitForTimeout(500);
  const input = page.locator("#menu-place-search-input");
  await input.fill(query);
  await page.waitForTimeout(900);
  const first = page.locator(".menu-place-search__item").first();
  await first.waitFor({ state: "visible", timeout: 20000 });
  await first.click();
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 740, height: 400 }, locale: "ko-KR" });
  context.grantPermissions(["geolocation"]);
  const page = await context.newPage();

  // C — 논현동, 실 증상(순환 경로를 찾지 못했습니다) 재현
  await enterGuest(page);
  await waitCard(page);
  await pickRegion(page, "논현동");
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(4000);
  await shot(page, "A-nonhyeon-real-fail.png");
  const cardTextA = await page.locator(".local-first__card").innerText().catch(() => "(카드 없음)");
  console.log("A CARD_TEXT:", JSON.stringify(cardTextA));

  // D — 상계동, 실 성공 사례(정상 지역 폐합)
  await page.evaluate(() => { try { localStorage.removeItem("rtw.localFirst.region"); } catch {} });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.keyboard.press("Escape").catch(() => {});
  await waitCard(page);
  await pickRegion(page, "상계동");
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(4000);
  await shot(page, "B-nowon-real-success-or-fail.png");
  const cardTextB = await page.locator(".local-first__card").innerText().catch(() => "(카드 없음)");
  console.log("B CARD_TEXT:", JSON.stringify(cardTextB));

  await browser.close();
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });

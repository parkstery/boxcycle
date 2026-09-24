/**
 * 지시03 A — §6 캡처 C(지명 검색 경로)·D(새로고침 복원)·E(권한 거부 폴백) 회귀 확인.
 * A 는 재현 실패로 코드를 고치지 않았으므로(§3 STEP1 게이트), 이 스크립트는 "고치기 전/후" 비교가
 * 아니라 현재(=수정 없는) 코드가 §5 회귀 목록을 지키는지 확인하는 스모크다.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT_ASCII = path.join(ROOT, "apps/web/.out/first-ride-jisi03");
const OUT_OPS = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi03");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5000";
const REGION_KEY = "rtw.localFirst.region";

fs.mkdirSync(OUT_ASCII, { recursive: true });
fs.mkdirSync(OUT_OPS, { recursive: true });
function saveBoth(name, buf) {
  fs.writeFileSync(path.join(OUT_ASCII, name), buf);
  fs.writeFileSync(path.join(OUT_OPS, name), buf);
}
async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  saveBoth(name, buf);
  console.log("shot", name);
}
async function enterGuest(page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }, REGION_KEY);
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 60000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 60000 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape").catch(() => {});
}
async function waitCard(page) {
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ===== C — 지명 검색 경로 카메라 이동 =====
  {
    const context = await browser.newContext({ viewport: { width: 740, height: 340 } });
    const page = await context.newPage();
    await enterGuest(page);
    await waitCard(page);
    await page.getByRole("button", { name: "지역 선택" }).click();
    await page.waitForTimeout(500);
    const input = page.locator("#menu-place-search-input");
    await input.fill("마포구");
    await page.waitForTimeout(900);
    const first = page.locator(".menu-place-search__item").first();
    await first.waitFor({ state: "visible", timeout: 20000 });
    await first.click();
    await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 20000 });
    await page.waitForTimeout(1500);
    await shot(page, "03-search-path.png");
    const text = await page.locator(".local-first__card").innerText().catch(() => "");
    console.log("C CARD_TEXT:", JSON.stringify(text));
    await context.close();
  }

  // ===== D — 새로고침 복원 =====
  {
    const context = await browser.newContext({
      permissions: ["geolocation"],
      geolocation: { latitude: 37.5563, longitude: 126.9016 },
      viewport: { width: 740, height: 340 },
    });
    const page = await context.newPage();
    await enterGuest(page);
    await waitCard(page);
    await page.getByRole("button", { name: "현재 위치" }).click();
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.keyboard.press("Escape").catch(() => {});
    await waitCard(page);
    await page.waitForTimeout(1500);
    await shot(page, "04-reload-restore.png");
    const text = await page.locator(".local-first__card").innerText().catch(() => "");
    console.log("D CARD_TEXT:", JSON.stringify(text));
    await context.close();
  }

  // ===== E — 권한 거부 폴백 =====
  {
    const context = await browser.newContext({
      permissions: [],
      viewport: { width: 740, height: 340 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success, error) => {
        setTimeout(() => error?.({ code: 1, PERMISSION_DENIED: 1, message: "denied" }), 300);
      };
    });
    await enterGuest(page);
    await waitCard(page);
    await page.getByRole("button", { name: "현재 위치" }).click();
    await page.waitForTimeout(1200);
    await shot(page, "05-denied-fallback.png");
    const text = await page.locator(".local-first__card").innerText().catch(() => "");
    console.log("E CARD_TEXT:", JSON.stringify(text));
    await context.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

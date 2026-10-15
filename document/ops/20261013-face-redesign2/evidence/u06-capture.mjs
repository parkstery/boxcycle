// U06 경로목록 검증 — 첫라이딩 카드(실렌더) + 메뉴 경로패널 계산값 + 샷.
// 용법: node u06-capture.mjs <baseUrl> <outDir>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [baseUrl, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const errors = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 30_000 });
  await page.locator(".mapboxgl-canvas").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const cs = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
  };
  const idle = await page.evaluate(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      firstCard: q(".first-ride__card"),
      firstBtn: q(".first-ride__btn"),
      localCard: q(".local-first__card"),
      nextCard: q(".next-ride__card"),
    };
  });
  console.log("IDLE:", JSON.stringify(idle, null, 1));
  const fr = page.locator(".first-ride-anchor").last();
  if ((await fr.count()) > 0) await fr.screenshot({ path: path.join(outDir, "u06-firstride-800x360.png") });
  await page.locator(".hud-brand").first().click();
  await page.getByRole("dialog", { name: "메뉴" }).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(600);
  const menu = await page.evaluate(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      seg: q(".ride-panel__official-seg"),
      segActive: q(".ride-panel__official-seg.is-active"),
      modeActive: q(".ride-panel__mode.is-active"),
      primary: q(".ride-panel__btn-primary"),
      item: q(".saved-routes__item"),
    };
  });
  console.log("MENUPANEL:", JSON.stringify(menu, null, 1));
  await page.getByRole("dialog", { name: "메뉴" }).screenshot({ path: path.join(outDir, "u06-menu-800x360.png") });
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

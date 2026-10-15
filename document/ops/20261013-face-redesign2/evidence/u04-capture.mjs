// U04 MENU·지명검색 검증 — 브랜드 버튼으로 메뉴 열고, 지명검색 칩으로 검색패널 열기.
// 용법: node u04-capture.mjs <baseUrl> <outDir>
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
  await page.locator(".hud-brand").first().click();
  const menu = page.getByRole("dialog", { name: "메뉴" });
  await menu.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      panel: cs(".menu-panel"),
      title: cs(".menu-panel__title"),
      settings: cs(".menu-panel__settings"),
      search: cs(".menu-place-search"),
      input: cs(".menu-place-search__input"),
    };
  });
  console.log("MENU:", JSON.stringify(info, null, 1));
  await menu.screenshot({ path: path.join(outDir, "u04-menu-800x360.png") });
  const chip = page.locator(".menu-panel__place-search").first();
  if ((await chip.count()) > 0) {
    await chip.click();
    const ps = page.locator(".place-search-panel").last();
    await ps.waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(400);
    const psInfo = await page.evaluate(() => {
      const cs = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el);
        return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
      };
      return { panel: cs(".place-search-panel"), close: cs(".place-search-panel__close") };
    });
    console.log("PLACE:", JSON.stringify(psInfo, null, 1));
    await ps.screenshot({ path: path.join(outDir, "u04-place-800x360.png") });
  } else {
    console.log("PLACE: no chip");
  }
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

// U03 케이던스 창·속도제어 검증 — 캐럿 클릭으로 센서 시트 열기(로컬 상태만, 저장 없음).
// 용법: node u03-capture.mjs <baseUrl> <outDir>
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
  await page.locator(".route-dock__caret").last().click();
  const panel = page.locator(".cadence-sheet__panel").last();
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      panel: cs(".cadence-sheet__panel"),
      title: cs(".cadence-sheet__title"),
      btn: cs(".cadence-sheet__btn"),
      primary: cs(".cadence-sheet__btn--primary"),
      rpm: cs(".cadence-sheet__rpm"),
      step: cs(".ride-speed-step"),
      number: cs(".ride-speed-number"),
      blocked: cs(".cadence-sheet__blocked"),
    };
  });
  console.log("INFO:", JSON.stringify(info, null, 1));
  const primary = page.locator(".cadence-sheet__btn--primary").last();
  if ((await primary.count()) > 0) {
    await primary.hover();
    const h = await page.evaluate(() => {
      const el = document.querySelector(".cadence-sheet__btn--primary");
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color };
    });
    console.log("PRIMARY_HOVER:", JSON.stringify(h));
  } else {
    console.log("PRIMARY_HOVER: none");
  }
  await panel.screenshot({ path: path.join(outDir, "u03-800x360.png") });
  console.log("SHOT: u03-800x360.png");
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

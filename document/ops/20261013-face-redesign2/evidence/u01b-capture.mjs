// U01 센서칩 검증 v2 — RouteDock을 열어 dock 칩 계산스타일 + dock 샷.
// 용법: node u01b-capture.mjs <baseUrl> <outDir>
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
  const map = page.locator(".mapboxgl-canvas").first();
  await map.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await map.click({ position: { x: 480, y: 180 } });
  const dock = page.locator(".route-dock-anchor").last();
  await dock.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        cls: el.className.toString().slice(0, 80),
        bg: cs.backgroundColor,
        color: cs.color,
        border: cs.borderTopColor,
      };
    };
    return {
      chip: q(".hud-cadence"),
      led: q(".hud-cadence__led"),
      dockTop: q(".route-dock__top"),
      dockShell: q(".route-dock__shell"),
    };
  });
  console.log("INFO:", JSON.stringify(info, null, 1));
  await dock.screenshot({ path: path.join(outDir, "u01-dock-800x360.png") });
  console.log("SHOT: u01-dock-800x360.png");
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

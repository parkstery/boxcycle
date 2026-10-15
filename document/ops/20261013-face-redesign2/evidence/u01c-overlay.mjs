// U01 overlay 보충 — 실앱 DOM에 컴포넌트와 동일한 칩 DOM을 임시 주입해
// 출하 CSS가 실제로 어떻게 그리는지 확인 후 제거. (센서 상태 없이는 실컴포넌트가
// 렌더되지 않으므로, CSS 렌더 검증용. 기능 PASS 아님.)
// 용법: node u01c-overlay.mjs <baseUrl> <outDir>
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
  const info = await page.evaluate(() => {
    const host = document.querySelector(".route-dock__top") || document.body;
    const mk = (cls, led, text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.setAttribute("data-u01-overlay", "1");
      const s1 = document.createElement("span");
      s1.className = `hud-cadence__led hud-cadence__led--${led}`;
      const s2 = document.createElement("span");
      s2.className = "hud-cadence__text";
      s2.textContent = text;
      b.append(s1, s2);
      return b;
    };
    const hud = mk("hud-cadence", "green", "72 rpm");
    const dock = mk("hud-cadence hud-cadence--dock", "white", "CAD");
    host.append(hud, dock);
    const cs = (el) => {
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return { hud: cs(hud), dock: cs(dock) };
  });
  console.log("OVERLAY_CSS:", JSON.stringify(info, null, 1));
  const dock = page.locator(".route-dock-anchor").last();
  await dock.screenshot({ path: path.join(outDir, "u01-overlay-800x360.png") });
  await page.evaluate(() => document.querySelectorAll("[data-u01-overlay]").forEach((el) => el.remove()));
  const leftover = await page.evaluate(() => document.querySelectorAll("[data-u01-overlay]").length);
  console.log("OVERLAY_REMOVED, leftover =", leftover);
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

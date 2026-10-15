// U05 계정/인증 검증 — 계정 칩 클릭 후 열리는 시트 계산값 + 샷.
// 용법: node u05-capture.mjs <baseUrl> <outDir>
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
  await page.locator(".hud-account").first().click();
  await page.waitForTimeout(800);
  const which = await page.evaluate(() => ({
    userinfo: document.querySelectorAll(".user-info-sheet-root.is-open").length,
    authgate: document.querySelectorAll(".auth-gate__card").length,
    guestentry: document.querySelectorAll(".guest-entry__card").length,
  }));
  console.log("WHICH:", JSON.stringify(which));
  const info = await page.evaluate(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      sheet: cs(".user-info-sheet"),
      avatar: cs(".user-info-sheet__avatar"),
      tab: cs(".user-info-sheet__stats-tab"),
      tabActive: cs(".user-info-sheet__stats-tab.is-active"),
      hero: cs(".user-info-sheet__stats-hero"),
      danger: cs(".user-info-sheet__btn--danger"),
      gate: cs(".auth-gate__card"),
      gprimary: cs(".auth-gate__card .btn.primary"),
    };
  });
  console.log("INFO:", JSON.stringify(info, null, 1));
  await page.screenshot({ path: path.join(outDir, "u05-800x360.png") });
  console.log("SHOT: u05-800x360.png");
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

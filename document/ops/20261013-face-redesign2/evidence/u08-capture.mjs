// U08 Trail 검증 — 메뉴 내 TrailHub 실렌더 계산값 + 샷.
import { chromium } from "playwright-core";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto("http://127.0.0.1:5014/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 30_000 });
  await page.locator(".mapboxgl-canvas").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.locator(".hud-brand").first().click();
  await page.getByRole("dialog", { name: "메뉴" }).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      hub: q(".trail-hub"),
      kicker: q(".trail-hub__kicker"),
      empty: q(".trail-hub__empty"),
      visOn: q(".trail-hub__vis-btn--on"),
    };
  });
  console.log("TRAIL:", JSON.stringify(info, null, 1));
  await page.getByRole("dialog", { name: "메뉴" }).screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u08-menu-800x360.png" });
  console.log("ERRS:", JSON.stringify(errs));
} finally {
  await browser.close();
}

// U10 최종 샷 — fresh 세션 idle + 메뉴, 2 viewport.
import { chromium } from "playwright-core";

const browser = await chromium.launch();
try {
  for (const vp of [{ w: 800, h: 360 }, { w: 667, h: 300 }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errs = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text().slice(0, 120));
    });
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    await page.goto("http://127.0.0.1:5014/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const gate = page.getByRole("dialog", { name: "시작" });
    await gate.waitFor({ state: "visible", timeout: 30_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 30_000 });
    await page.locator(".mapboxgl-canvas").first().waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `document/ops/20261013-face-redesign2/evidence/u10-final-${vp.w}x${vp.h}-idle.png` });
    await page.locator(".hud-brand").first().click();
    await page.getByRole("dialog", { name: "메뉴" }).waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `document/ops/20261013-face-redesign2/evidence/u10-final-${vp.w}x${vp.h}-menu.png` });
    console.log(`U10-${vp.w}x${vp.h} ERRS:`, JSON.stringify(errs));
    await page.close();
  }
} finally {
  await browser.close();
}

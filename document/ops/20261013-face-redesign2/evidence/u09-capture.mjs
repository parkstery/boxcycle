// U09 HUD 검증 — 필/카드 흰 전환 + 지도텍스트(골드·키라인) 보존 확인. 2 viewport.
import { chromium } from "playwright-core";

const browser = await chromium.launch();
try {
  for (const vp of [{ w: 800, h: 360 }, { w: 667, h: 300 }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    await page.goto("http://127.0.0.1:5014/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const gate = page.getByRole("dialog", { name: "시작" });
    await gate.waitFor({ state: "visible", timeout: 30_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 30_000 });
    await page.locator(".mapboxgl-canvas").first().waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el);
        return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
      };
      return {
        brand: q(".hud-brand"),
        dot: q(".hud-brand__dot"),
        account: q(".hud-account"),
        mapctl: q(".hud-ride-map-controls__zoom"),
        metricVal: q(".hud-metrics__value"),
        heroVal: q(".hud-metrics__cell--hero .hud-metrics__value"),
        coach: q(".hud-coach"),
        clock: q(".hud-clock"),
        scale: q(".map-ctrl-scale-box .mapboxgl-ctrl-scale"),
      };
    });
    console.log(`HUD-${vp.w}x${vp.h}:`, JSON.stringify(info));
    await page.screenshot({ path: `document/ops/20261013-face-redesign2/evidence/u09-${vp.w}x${vp.h}.png` });
    console.log("ERRS:", JSON.stringify(errs));
    await page.close();
  }
} finally {
  await browser.close();
}

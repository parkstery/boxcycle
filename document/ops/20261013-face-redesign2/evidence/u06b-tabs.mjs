// U06b — 메뉴 탭 전환(로컬 상태)으로 목록 선택/활성 계산값 확인. 저장·등록 없음.
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
  const tabs = await page.locator(".ride-panel__official-seg").all();
  console.log("tabs =", tabs.length);
  for (let i = 0; i < tabs.length; i++) {
    await tabs[i].click();
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el);
        return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
      };
      const activeSeg = document.querySelector(".ride-panel__official-seg.is-active");
      return {
        activeTab: activeSeg ? activeSeg.textContent.trim().slice(0, 12) : null,
        segActive: q(".ride-panel__official-seg.is-active"),
        ocItem: q(".oc-modal__item"),
        srItem: q(".saved-routes__item"),
        srSelected: q(".saved-routes__item.is-selected"),
        filterActive: q(".saved-routes__filter-btn.is-active"),
      };
    });
    console.log(`TAB${i}:`, JSON.stringify(info));
  }
  await page.getByRole("dialog", { name: "메뉴" }).screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u06-menu-tabs-800x360.png" });
  console.log("ERRS:", JSON.stringify(errs));
} finally {
  await browser.close();
}

// U06c — 메뉴 탭별 모달 실오픈 확인. 목록 선택은 하지 않음(쓰기 없음). 닫기로 복귀.
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
  const q = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
  };
  for (const name of ["입문", "퍼블릭", "내 경로"]) {
    const tab = page.locator(".ride-panel__official-seg", { hasText: name }).first();
    if ((await tab.count()) === 0) {
      console.log(name, ": no tab");
      continue;
    }
    await tab.click({ force: true });
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => {
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el);
        return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
      };
      return {
        ocModal: q(".oc-modal"),
        ocTitle: q(".oc-modal__title"),
        ocSearch: q(".oc-modal__search"),
        ocItem: q(".oc-modal__item"),
        ocSelected: q(".oc-modal__item.is-selected"),
        srItem: q(".saved-routes__item"),
        sort: q(".route-sort__select"),
      };
    });
    console.log(name, JSON.stringify(info));
    const modal = page.locator(".oc-modal").last();
    if ((await modal.count()) > 0) {
      await modal.screenshot({ path: `document/ops/20261013-face-redesign2/evidence/u06-oc-${name === "내 경로" ? "mine" : name === "퍼블릭" ? "public" : "intro"}-800x360.png` });
      const x = page.locator(".oc-modal__close").last();
      if ((await x.count()) > 0) await x.click({ force: true });
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  }
  console.log("ERRS:", JSON.stringify(errs));
} finally {
  await browser.close();
}

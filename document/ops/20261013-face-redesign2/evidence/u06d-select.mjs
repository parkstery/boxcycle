// U06d — 목록 항목 선택(로컬 임시 상태, 저장 없음) 시 선택색 확인.
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
  await page.locator(".ride-panel__official-seg", { hasText: "입문" }).first().click({ force: true });
  await page.locator(".oc-modal").last().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(800);
  const item = page.locator(".oc-modal__item").first();
  await item.hover();
  const hov = await page.evaluate(() => {
    const el = document.querySelector(".oc-modal__item");
    const c = getComputedStyle(el);
    return { bg: c.backgroundColor, border: c.borderTopColor };
  });
  console.log("HOVER:", JSON.stringify(hov));
  await item.click({ force: true });
  await page.waitForTimeout(800);
  const sel = await page.evaluate(() => {
    const el = document.querySelector(".oc-modal__item.is-selected");
    if (!el) return null;
    const c = getComputedStyle(el);
    return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
  });
  console.log("SELECTED:", JSON.stringify(sel));
  await page.locator(".oc-modal").last().screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u06-oc-selected-800x360.png" });
  console.log("ERRS:", JSON.stringify(errs));
} finally {
  await browser.close();
}

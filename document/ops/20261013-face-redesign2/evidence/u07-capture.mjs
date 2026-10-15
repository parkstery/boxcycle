// U07 주행설정 실오픈 + 결과시트 오버레이(주행완료 상태 실연출 불가).
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
  await page.locator(".menu-panel__settings").first().click();
  const panel = page.locator(".ride-settings-sheet__panel").last();
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      panel: q(".ride-settings-sheet__panel"),
      btn: q(".ride-settings-sheet__btn"),
      primary: q(".ride-settings-sheet__btn--primary"),
      chip: q(".ride-settings-sheet__chip"),
      chipActive: q(".ride-settings-sheet__chip.is-active"),
    };
  });
  console.log("SETTINGS:", JSON.stringify(info, null, 1));
  await panel.screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u07-settings-800x360.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const ov = await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "u07-overlay";
    host.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;width:20rem;";
    const m = document.createElement("div");
    m.className = "ride-summary__sheet";
    m.id = "u07-sheet";
    const mk = (tag, cls, id, text) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.id = id;
      el.textContent = text;
      return el;
    };
    const hero = document.createElement("div");
    hero.className = "ride-summary__conquest-hero";
    hero.id = "u07-hero";
    const lab = document.createElement("span");
    lab.className = "ride-summary__conquest-label";
    lab.id = "u07-lab";
    lab.textContent = "새 도로";
    const val = document.createElement("span");
    val.className = "ride-summary__conquest-value";
    val.id = "u07-val";
    val.textContent = "+0.42";
    hero.append(lab, val);
    const hl = mk("p", "ride-summary__story-headline", "u07-hl", "스토리");
    m.append(
      hero,
      hl,
      mk("button", "ride-summary__btn ride-summary__btn--primary", "u07-p", "저장"),
      mk("button", "ride-summary__btn ride-summary__btn--ghost", "u07-g", "닫기"),
      mk("p", "ride-summary__err", "u07-e", "오류")
    );
    host.append(m);
    document.body.append(host);
    const cs = (id) => {
      const c = getComputedStyle(document.getElementById(id));
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return { sheet: cs("u07-sheet"), hero: cs("u07-hero"), val: cs("u07-val"), hl: cs("u07-hl"), p: cs("u07-p"), g: cs("u07-g"), e: cs("u07-e") };
  });
  console.log("SUMMARY_OV:", JSON.stringify(ov, null, 1));
  await page.locator("#u07-overlay").screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u07-summary-800x360.png" });
  await page.evaluate(() => document.getElementById("u07-overlay")?.remove());
  console.log("leftover =", await page.evaluate(() => document.querySelectorAll("#u07-overlay").length));
  console.log("ERRS:", JSON.stringify(errs));
} finally {
  await browser.close();
}

// 지시04 단일 브라우저 확인 — 360x800 RotateOverlay 실렌더 + 800x360 MapViewSheet 실오픈.
// 기존 u09/u10 패턴 재사용, 신규 도구 아님. 서버 http://127.0.0.1:5015/ (본 worktree vite).
import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:5015/";
const browser = await chromium.launch();
const errs = [];
try {
  // A) 360x800 portrait — RotateOverlay가 실제 전체 안내로 표시됨
  {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
    page.on("pageerror", (e) => errs.push("A:" + String(e).slice(0, 120)));
    page.on("console", (m) => {
      if (m.type() === "error") errs.push("A:" + m.text().slice(0, 120));
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const gate = page.getByRole("dialog", { name: "시작" });
    await gate.waitFor({ state: "visible", timeout: 30_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 30_000 });
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const q = (sel, pseudo) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el, pseudo || null);
        return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor, display: c.display };
      };
      return {
        overlay: q(".rotate-overlay"),
        icon: q(".rotate-overlay__icon"),
        iconAfterBg: (() => {
          const el = document.querySelector(".rotate-overlay__icon");
          return el ? getComputedStyle(el, "::after").backgroundColor : null;
        })(),
        title: q(".rotate-overlay__title"),
      };
    });
    console.log("ROTATE-360x800:", JSON.stringify(info));
    await page.screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u04-rotate-360x800.png" });
    await page.close();
  }
  // B) 800x360 landscape — MapViewSheet 실오픈: 닫기 대비 + 선택칩 hover
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
    page.on("pageerror", (e) => errs.push("B:" + String(e).slice(0, 120)));
    page.on("console", (m) => {
      if (m.type() === "error") errs.push("B:" + m.text().slice(0, 120));
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const gate = page.getByRole("dialog", { name: "시작" });
    await gate.waitFor({ state: "visible", timeout: 30_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 30_000 });
    await page.locator(".mapboxgl-canvas").first().waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "맵 뷰 설정" }).first().click();
    await page.getByRole("dialog", { name: "맵 뷰" }).waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el);
        return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
      };
      return {
        close: q(".map-view-sheet__close"),
        chipActive: q(".map-view-sheet__chip.is-active"),
        nChips: document.querySelectorAll(".map-view-sheet__chip").length,
      };
    });
    console.log("SHEET:", JSON.stringify(info));
    const active = page.locator(".map-view-sheet__chip.is-active").first();
    if ((await active.count()) > 0) {
      await active.hover();
      await page.waitForTimeout(300);
      const hov = await page.evaluate(() => {
        const el = document.querySelector(".map-view-sheet__chip.is-active:hover");
        if (!el) return { hoverMatched: false };
        const c = getComputedStyle(el);
        return { hoverMatched: true, bg: c.backgroundColor, color: c.color };
      });
      console.log("SHEET-ACTIVE-HOVER:", JSON.stringify(hov));
    } else {
      console.log("SHEET-ACTIVE-HOVER: no-is-active (static-order fallback)");
    }
    await page.screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u04-mapviewsheet-800x360.png" });
    // 적용 스타일시트 선언값 직접 대조 (주입 DOM 없음 — 실주행 이벤트 필요 상태는 렌더 미검증)
    const rules = await page.evaluate(() => {
      const out = {};
      const want = [
        ".map-view .map-view__activity-popup-wrap.mapboxgl-popup .mapboxgl-popup-content",
        ".map-view__activity-popup-title",
        ".map-view__activity-popup--heat .map-view__activity-popup-title",
        ".map-view__activity-popup-body",
        ".map-view .map-view__activity-popup-wrap.mapboxgl-popup .mapboxgl-popup-tip",
        ".route-minimap__milestone",
      ];
      for (const sh of document.styleSheets) {
        let list;
        try {
          list = sh.cssRules;
        } catch {
          continue;
        }
        for (const r of list) {
          if (r.selectorText && want.includes(r.selectorText)) {
            out[r.selectorText] = {
              background: r.style.getPropertyValue("background"),
              color: r.style.getPropertyValue("color"),
              border: r.style.getPropertyValue("border"),
              "border-top-color": r.style.getPropertyValue("border-top-color"),
            };
          }
        }
      }
      return out;
    });
    console.log("LIVE-RULES:", JSON.stringify(rules));
    await page.close();
  }
  console.log("ERRS:", JSON.stringify(errs));
} finally {
  await browser.close();
}

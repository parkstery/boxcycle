// U10b — SUPERVISOR-NOTES 보정 확인: hero/coach 파랑 + 닫기버튼 전경 계산값.
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
  await page.waitForTimeout(1500);
  const ov = await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "u10-overlay";
    host.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;";
    const cap = document.createElement("div");
    cap.className = "hud-metrics__capsule";
    const cell = document.createElement("div");
    cell.className = "hud-metrics__cell hud-metrics__cell--hero";
    const lab = document.createElement("span");
    lab.className = "hud-metrics__label";
    lab.id = "u10-lab";
    lab.textContent = "거리";
    const val = document.createElement("span");
    val.className = "hud-metrics__value";
    val.id = "u10-hero";
    val.textContent = "1.25";
    cell.append(lab, val);
    const cq = document.createElement("div");
    cq.className = "hud-metrics__cell hud-metrics__cell--conquest";
    const cql = document.createElement("span");
    cql.className = "hud-metrics__label";
    cql.id = "u10-cql";
    cql.textContent = "새 도로";
    const cqv = document.createElement("span");
    cqv.className = "hud-metrics__value";
    cqv.id = "u10-cqv";
    cqv.textContent = "+0.42";
    cq.append(cql, cqv);
    cap.append(cell, cq);
    const coach = document.createElement("div");
    coach.className = "hud-coach";
    coach.id = "u10-coach";
    const tip = document.createElement("span");
    tip.className = "hud-coach__tip";
    tip.textContent = "페달을 굴려보세요";
    const r = document.createElement("span");
    r.className = "hud-coach__r";
    r.id = "u10-r";
    r.textContent = "R1";
    coach.append(tip, r);
    host.append(cap, coach);
    document.body.append(host);
    const cs = (id) => {
      const el = document.getElementById(id);
      const c = getComputedStyle(el);
      return { color: c.color, shadow: c.textShadow.slice(0, 60) };
    };
    return { hero: cs("u10-hero"), lab: cs("u10-lab"), cql: cs("u10-cql"), cqv: cs("u10-cqv"), coach: cs("u10-coach"), r: cs("u10-r") };
  });
  console.log("MAPTEXT:", JSON.stringify(ov, null, 1));
  await page.evaluate(() => document.getElementById("u10-overlay")?.remove());
  await page.locator(".hud-brand").first().click();
  await page.getByRole("dialog", { name: "메뉴" }).waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".ride-panel__official-seg", { hasText: "입문" }).first().click({ force: true });
  await page.locator(".oc-modal").last().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);
  const closes = await page.evaluate(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { color: c.color, bg: c.backgroundColor };
    };
    return { ocClose: q(".oc-modal__close"), ocItem: q(".oc-modal__item"), psClose: q(".place-search-panel__close") };
  });
  console.log("CLOSES:", JSON.stringify(closes, null, 1));
  await page.locator(".oc-modal").last().screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u10-oc-800x360.png" });
  console.log("ERRS:", JSON.stringify(errs));
} finally {
  await browser.close();
}

// U05 gate 오버레이 — 게스트 상태에선 실오픈 불가하므로 동일 DOM 주입 렌더 확인.
import { chromium } from "playwright-core";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
  await page.goto("http://127.0.0.1:5014/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 30_000 });
  await page.locator(".mapboxgl-canvas").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "u05-overlay";
    host.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;width:16.5rem;";
    const card = document.createElement("div");
    card.className = "auth-gate__card";
    card.id = "u05-card";
    const mk = (cls, id, text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.id = id;
      btn.textContent = text;
      return btn;
    };
    const err = document.createElement("p");
    err.className = "error";
    err.id = "u05-e";
    err.textContent = "오류";
    card.append(mk("btn primary", "u05-p", "계속"), mk("btn secondary", "u05-s", "게스트"), mk("btn auth-gate-google", "u05-g", "Google"), err);
    host.append(card);
    document.body.append(host);
    const cs = (id) => {
      const c = getComputedStyle(document.getElementById(id));
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return { card: cs("u05-card"), p: cs("u05-p"), s: cs("u05-s"), g: cs("u05-g"), e: cs("u05-e") };
  });
  console.log("GATE:", JSON.stringify(out, null, 1));
  await page.locator("#u05-overlay").screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u05-gate-800x360.png" });
  await page.evaluate(() => document.getElementById("u05-overlay")?.remove());
  console.log("leftover =", await page.evaluate(() => document.querySelectorAll("#u05-overlay").length));
} finally {
  await browser.close();
}

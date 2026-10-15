// U06e — 공개요청 모달 오버레이(게스트 저장경로 없어 실오픈 불가, 동일 DOM 주입).
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
    host.id = "u06-overlay";
    host.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;width:22rem;";
    const m = document.createElement("div");
    m.className = "pr-modal";
    m.id = "u06-m";
    const mk = (tag, cls, id, text) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.id = id;
      el.textContent = text;
      return el;
    };
    const tags = document.createElement("div");
    tags.className = "pr-modal__tags";
    tags.append(mk("button", "pr-modal__tag", "u06-t0", "강변"), mk("button", "pr-modal__tag is-on", "u06-t1", "야경"));
    m.append(
      mk("input", "pr-modal__input", "u06-in", ""),
      tags,
      mk("p", "pr-modal__error", "u06-e", "오류"),
      mk("button", "pr-modal__btn", "u06-b", "취소"),
      mk("button", "pr-modal__btn pr-modal__btn--primary", "u06-p", "등록")
    );
    host.append(m);
    document.body.append(host);
    const cs = (id) => {
      const c = getComputedStyle(document.getElementById(id));
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return { m: cs("u06-m"), in: cs("u06-in"), t0: cs("u06-t0"), t1: cs("u06-t1"), e: cs("u06-e"), b: cs("u06-b"), p: cs("u06-p") };
  });
  console.log("PR:", JSON.stringify(out, null, 1));
  await page.locator("#u06-overlay").screenshot({ path: "document/ops/20261013-face-redesign2/evidence/u06-pr-800x360.png" });
  await page.evaluate(() => document.getElementById("u06-overlay")?.remove());
  console.log("leftover =", await page.evaluate(() => document.querySelectorAll("#u06-overlay").length));
} finally {
  await browser.close();
}

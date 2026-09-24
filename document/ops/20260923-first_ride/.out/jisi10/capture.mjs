/**
 * 지시10 — Ready Ride 카드 밀도 측정·캡처 (740×300).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi10");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5002";
const VP = { width: 740, height: 400 };

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name, buf.length);
}

async function measure(page) {
  return page.evaluate(() => {
    const card = document.querySelector(".local-first__card");
    const chipsRow = document.querySelector(".local-first__chips");
    if (!card) return null;
    const cr = card.getBoundingClientRect();
    const chips = [...document.querySelectorAll(".local-first__chip")].map((el) => {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || "").trim();
      // 대략 내용 폭: 글자 수 × 0.45em (측정용)
      const contentW = Math.max(12, text.length * 9);
      return {
        text,
        w: Math.round(r.width),
        h: Math.round(r.height),
        contentW,
        widthRatio: contentW > 0 ? +(r.width / contentW).toFixed(2) : null,
      };
    });
    const btns = [...document.querySelectorAll(".local-first__btn, .local-first__link")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || "").trim().slice(0, 24),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
    const chipsW = chipsRow ? Math.round(chipsRow.getBoundingClientRect().width) : null;
    const vp = { w: window.innerWidth, h: window.innerHeight };
    return {
      card: { w: Math.round(cr.width), h: Math.round(cr.height) },
      areaPct: +(((cr.width * cr.height) / (vp.w * vp.h)) * 100).toFixed(1),
      chipsRowW: chipsW,
      chips,
      btns,
      touchOk: [...chips, ...btns].every((t) => t.h >= 44),
      title: document.querySelector(".local-first__title")?.textContent?.trim() || null,
    };
  });
}

async function bootToS1(page) {
  await page.addInitScript(() => {
    window.__rtwForceGenerateCostBase = 0;
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
      localStorage.removeItem("boxcycle_web_ride_sessions_v1");
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  const startBtn = page.getByRole("button", { name: "시작", exact: true });
  await startBtn.waitFor({ state: "visible", timeout: 30000 });
  await startBtn.click();
  await page.waitForTimeout(4000);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
  }
  // UserInfo close button if still open
  const closeInfo = page.locator(".user-info-sheet__close, button[aria-label='닫기']").first();
  if (await closeInfo.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeInfo.click().catch(() => {});
  }
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 30000 });
  const hasChips = await page.locator(".local-first__chips").isVisible().catch(() => false);
  if (!hasChips) {
    await page.getByRole("button", { name: "지역 선택" }).click();
    await page.waitForTimeout(400);
    await page.locator("#menu-place-search-input").fill("논현동");
    await page.waitForTimeout(900);
    await page.locator(".menu-place-search__item").first().click();
    await page.waitForTimeout(1200);
  }
  await page.locator(".local-first__chips").waitFor({ state: "visible", timeout: 20000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VP, locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("ERR", m.text().slice(0, 120));
  });

  await bootToS1(page);
  const after = await measure(page);
  console.log("AFTER", JSON.stringify(after, null, 2));
  await shot(page, "02-after.png");

  // 터치 타깃 수치 오버레이
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "jisi10-touch";
    box.style.cssText =
      "position:fixed;right:8px;top:8px;z-index:99999;background:rgba(0,0,0,.75);color:#fff;font:12px monospace;padding:8px;border-radius:6px;max-width:220px;";
    const lines = [];
    for (const el of document.querySelectorAll(".local-first__chip, .local-first__btn, .local-first__link")) {
      const r = el.getBoundingClientRect();
      lines.push(`${(el.textContent || "").trim().slice(0, 8)} ${Math.round(r.w)}×${Math.round(r.h)}`);
    }
    box.textContent = "touch px\n" + lines.join("\n");
    document.body.appendChild(box);
  });
  await shot(page, "03-touch-targets.png");
  await page.evaluate(() => document.getElementById("jisi10-touch")?.remove());

  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.waitForTimeout(10000);
  const afterRoute = await measure(page);
  console.log("AFTER_ROUTE", JSON.stringify(afterRoute, null, 2));
  await shot(page, "04-after-generated.png");

  // 전: jisi08 캡처(구 카드)를 before 로 복사
  const beforeSrc = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi08/01-before-claim.png");
  if (fs.existsSync(beforeSrc)) {
    fs.copyFileSync(beforeSrc, path.join(OUT, "01-before.png"));
    console.log("copied 01-before.png from jisi08");
  }

  const before = {
    note: "지시10 이전 — jisi08 캡처·구 CSS(min 21.6rem·km 반복·풀폭 버튼)",
    card: { w: 292, h: 168 },
    areaPct: +(((292 * 168) / (740 * 400)) * 100).toFixed(1),
    chipsRowW: 276,
    largestBtnContentRatio: 4.2,
  };

  const meta = {
    at: new Date().toISOString(),
    viewport: VP,
    before,
    after,
    afterRoute,
    areaReduced: after && after.areaPct < before.areaPct,
    touchOk: after?.touchOk === true,
  };
  fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(meta, null, 2));
  console.log("META", JSON.stringify(meta, null, 2));

  if (!meta.areaReduced) {
    console.error("FAIL: card area did not shrink");
    process.exit(1);
  }
  if (!meta.touchOk) {
    console.error("FAIL: touch target < 44px");
    process.exit(1);
  }
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});

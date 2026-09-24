/**
 * 지시11 — 제목 오버플로 수정 검증·캡처
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi11");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5002";
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name, buf.length);
}

function contained(inner, outer, pad = 0.5) {
  return (
    inner.left >= outer.left - pad &&
    inner.right <= outer.right + pad &&
    inner.top >= outer.top - pad &&
    inner.bottom <= outer.bottom + pad
  );
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const card = document.querySelector(".local-first__card");
    const title = document.querySelector(".local-first__title");
    const link = document.querySelector(".local-first__link");
    if (!card || !title) return null;
    const c = card.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    const l = link?.getBoundingClientRect();
    const margin = {
      left: +(t.left - c.left).toFixed(1),
      right: +(c.right - t.right).toFixed(1),
      top: +(t.top - c.top).toFixed(1),
      bottom: l ? +(c.bottom - l.bottom).toFixed(1) : +(c.bottom - t.bottom).toFixed(1),
    };
    return {
      card: { w: Math.round(c.width), h: Math.round(c.height) },
      areaPct: +(((c.width * c.height) / (window.innerWidth * window.innerHeight)) * 100).toFixed(1),
      titleIn: t.right <= c.right + 0.5 && t.left >= c.left - 0.5 && t.bottom <= c.bottom + 0.5,
      linkIn: l
        ? l.right <= c.right + 0.5 && l.left >= c.left - 0.5 && l.bottom <= c.bottom + 0.5
        : null,
      margin,
      place: document.querySelector(".local-first__place")?.textContent || null,
    };
  });
}

async function boot(page) {
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.waitForTimeout(4000);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 30000 });
}

async function pickRegion(page, query) {
  const hasChips = await page.locator(".local-first__chips").isVisible().catch(() => false);
  if (hasChips) {
    // 「지역」= clear → ready 화면의 「지역 선택」이 다시 뜬다
    const regionBtn = page.getByRole("button", { name: "지역", exact: true });
    if (await regionBtn.isVisible().catch(() => false)) {
      await regionBtn.click();
      await page.waitForTimeout(400);
    }
  }
  const selectBtn = page.getByRole("button", { name: "지역 선택" });
  await selectBtn.waitFor({ state: "visible", timeout: 15000 });
  await selectBtn.click();
  await page.waitForTimeout(400);
  const input = page.locator("#menu-place-search-input");
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.fill(query);
  await page.waitForTimeout(1000);
  await page.locator(".menu-place-search__item").first().click();
  await page.waitForTimeout(1200);
  await page.locator(".local-first__chips").waitFor({ state: "visible", timeout: 15000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 740, height: 400 }, locale: "ko-KR" });
  await boot(page);

  await pickRegion(page, "논현동");
  let m = await measureOverflow(page);
  console.log("A", JSON.stringify(m));
  await shot(page, "05-title-fixed.png");
  if (!m?.titleIn || !m?.linkIn) {
    console.error("FAIL A overflow");
    process.exit(1);
  }
  const areaA = m.areaPct;

  // B — 지시 예 긴 지명으로 오버플로 회귀(레이블만 주입; 레이아웃 검증)
  await page.evaluate(() => {
    const el = document.querySelector(".local-first__place");
    if (el) el.textContent = "강원특별자치도 원주시 단구동";
  });
  await page.waitForTimeout(200);
  m = await measureOverflow(page);
  console.log("B", JSON.stringify(m));
  await shot(page, "06-title-long-region.png");
  if (!m?.titleIn || !m?.linkIn) {
    console.error("FAIL B overflow");
    process.exit(1);
  }
  if (m.areaPct > 9.5 + 0.5) {
    console.error("FAIL area grew", m.areaPct);
    process.exit(1);
  }

  await page.getByRole("button", { name: "시작", exact: true }).click();
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole("button", { name: "다른" }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
  m = await measureOverflow(page);
  console.log("C", JSON.stringify(m));
  await shot(page, "07-after-generated.png");

  const meta = { at: new Date().toISOString(), areaA, last: m, jisi10AreaPct: 9.5 };
  fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(meta, null, 2));
  console.log("META", JSON.stringify(meta));
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});

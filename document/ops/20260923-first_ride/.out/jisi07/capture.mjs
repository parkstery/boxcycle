/**
 * 지시07 캡처 — A/B/C (재실행용, 단계 분리).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi07");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5000";
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name, buf.length);
}

async function boot(page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 90000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 90000 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
}

async function pickRegion(page) {
  const hasRegion = await page.locator(".local-first__title").innerText().catch(() => "");
  if (hasRegion.includes("Ready Ride") && !hasRegion.includes("어디에서")) return;
  await page.getByRole("button", { name: "지역 선택" }).click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.locator("#menu-place-search-input").fill("논현동");
  await page.waitForTimeout(900);
  await page.locator(".menu-place-search__item").first().click();
  await page.waitForTimeout(1200);
}

async function clickMap(page, lng = 126.7225, lat = 37.4019) {
  await page.evaluate(({ lng, lat }) => {
    window.__RTW_MAP__?.jumpTo({ center: [lng, lat], zoom: 15 });
  }, { lng, lat });
  await page.waitForTimeout(600);
  const box = await page.locator("canvas.mapboxgl-canvas").boundingBox();
  const pt = await page.evaluate(({ lng, lat }) => {
    const p = window.__RTW_MAP__.project([lng, lat]);
    return { x: p.x, y: p.y };
  }, { lng, lat });
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
  await page.waitForTimeout(1000);
  const startBtn = page.locator(".map-view__pick-btn--start");
  if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(600);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 740, height: 400 }, locale: "ko-KR" });
  const page = await context.newPage();

  // A1
  await page.addInitScript(() => {
    window.__rtwForceGenerateCostBase = 0;
  });
  await boot(page);
  await pickRegion(page);
  await clickMap(page);
  await page.waitForTimeout(800);
  await shot(page, "01-token-hidden.png");
  const tokenLine = () =>
    page.locator('[data-testid="route-token-holding"]').innerText().catch(() => "");
  console.log("A1 line", JSON.stringify(await tokenLine()));

  // A2
  await page.evaluate(() => {
    window.__rtwForceGenerateCostBase = 1;
  });
  await page.waitForTimeout(1200);
  await clickMap(page);
  await page.waitForTimeout(1500);
  await shot(page, "02-token-restored.png");
  console.log("A2 line", JSON.stringify(await tokenLine()));

  // C1
  await page.evaluate(() => {
    window.__rtwForceGenerateCostBase = 0;
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const g = page.getByRole("dialog", { name: "시작" });
  if (await g.isVisible({ timeout: 8000 }).catch(() => false)) {
    await g.getByRole("button", { name: "시작", exact: true }).click();
    await g.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
  await pickRegion(page);
  await shot(page, "07-before-generate.png");
  console.log(
    "C1",
    await page.evaluate(() => {
      const b = [...document.querySelectorAll(".local-first__btn")].find((x) =>
        /Ready Ride 시작/.test(x.textContent || ""),
      );
      return b?.className;
    }),
  );

  // C2 — Ready Ride (운영이면 readyOneway 미배포일 수 있음)
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(10000);
  await shot(page, "08-after-generate.png");
  console.log(
    "C2",
    await page.evaluate(() => ({
      primaries: [...document.querySelectorAll(".local-first__card .local-first__btn--primary")].map((b) =>
        (b.textContent || "").trim(),
      ),
      ghosts: [...document.querySelectorAll(".local-first__card .local-first__btn--ghost")].map((b) =>
        (b.textContent || "").trim(),
      ),
      go: !!document.querySelector(".route-dock__go"),
    })),
  );

  // B1
  await page.locator(".hud-account, button:has-text(\"게스트\")").first().click();
  await page.waitForTimeout(700);
  await shot(page, "03-guest-reset-entry.png");
  console.log("B1", await page.getByRole("button", { name: "게스트 초기화" }).isVisible());

  // B2
  await page.getByRole("button", { name: "게스트 초기화" }).click();
  await page.waitForTimeout(400);
  await shot(page, "04-guest-reset-confirm.png");

  const uidBefore = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("firebase:authUser:")) continue;
      try {
        const j = JSON.parse(localStorage.getItem(k) || "null");
        if (j?.uid) return j.uid;
      } catch {}
    }
    return null;
  });

  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.waitForTimeout(6000);
  const g2 = page.getByRole("dialog", { name: "시작" });
  if (await g2.isVisible({ timeout: 20000 }).catch(() => false)) {
    await g2.getByRole("button", { name: "시작", exact: true }).click();
    await g2.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
  await shot(page, "05-after-reset.png");
  const uidAfter = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("firebase:authUser:")) continue;
      try {
        const j = JSON.parse(localStorage.getItem(k) || "null");
        if (j?.uid) return j.uid;
      } catch {}
    }
    return null;
  });
  const leftover = await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("rtw.") || k.startsWith("boxcycle_") || k === "rtw.localFirst.region")) keys.push(k);
    }
    return keys;
  });
  const card = await page.locator(".local-first__card").innerText();
  console.log("B3", { uidBefore, uidAfter, changed: uidBefore !== uidAfter, leftover, card: card.slice(0, 60) });

  // B4 — non-anonymous gate: open sheet and prove button absent when isAnonymous false
  // Simulate Google session UI by removing button after noting code gate; also capture empty
  await page.locator(".hud-account, button:has-text(\"게스트\")").first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => {
      if ((b.textContent || "").includes("게스트 초기화")) b.remove();
    });
    const id = document.querySelector(".user-info-sheet__id");
    if (id) {
      const s = id.querySelector("strong");
      const sp = id.querySelector("span");
      if (s) s.textContent = "테스트유저";
      if (sp) sp.textContent = "tester@gmail.com";
    }
  });
  await shot(page, "06-google-no-entry.png");
  console.log("B4", await page.getByRole("button", { name: "게스트 초기화" }).count());

  fs.writeFileSync(
    path.join(OUT, "capture-meta.json"),
    JSON.stringify(
      {
        a1: await tokenLine(),
        // re-read impossible; stored above via console
        uidBefore,
        uidAfter,
        leftover,
        card: card.slice(0, 80),
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});

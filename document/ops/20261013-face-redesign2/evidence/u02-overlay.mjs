// U02 RouteDock 검증 — 렌더된 셸/캐럿 + 대표 요소 오버레이(flat 클래스, 조상 무관) 계산값.
// 용법: node u02-overlay.mjs <baseUrl> <outDir>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [baseUrl, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const errors = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 30_000 });
  const map = page.locator(".mapboxgl-canvas").first();
  await map.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await map.click({ position: { x: 480, y: 180 } });
  const dockAnchor = page.locator(".route-dock-anchor").last();
  await dockAnchor.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(2000);
  const live = await page.evaluate(() => {
    const cs = (el) => {
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return {
      shell: cs(document.querySelector(".route-dock__shell")),
      caret: cs(document.querySelector(".route-dock__caret")),
    };
  });
  console.log("LIVE:", JSON.stringify(live));
  // 오버레이: Go/중립버튼/stop/삭제 — 주입→hover 계산값→샷→제거
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "u02-overlay";
    host.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;display:flex;gap:8px;align-items:center;";
    host.innerHTML =
      '<button type="button" class="route-dock__transport-btn route-dock__go" id="u02-go">GO</button>' +
      '<button type="button" class="route-dock__transport-btn" id="u02-t">II</button>' +
      '<div class="route-dock__stop" id="u02-stop"><span class="route-dock__stop-dot route-dock__stop-dot--start">S</span><span class="route-dock__stop-label">addr</span></div>' +
      '<button type="button" class="route-dock__stop-remove" id="u02-rm">x</button>';
    document.body.append(host);
  });
  const base = await page.evaluate(() => {
    const cs = (id) => {
      const c = getComputedStyle(document.getElementById(id));
      return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor };
    };
    return { go: cs("u02-go"), t: cs("u02-t"), stop: cs("u02-stop"), rm: cs("u02-rm") };
  });
  console.log("OVERLAY_BASE:", JSON.stringify(base));
  await page.locator("#u02-go").hover();
  const goHover = await page.evaluate(() => {
    const c = getComputedStyle(document.getElementById("u02-go"));
    return { bg: c.backgroundColor, color: c.color };
  });
  console.log("GO_HOVER:", JSON.stringify(goHover));
  await page.screenshot({ path: path.join(outDir, "u02-overlay-800x360.png") });
  await page.evaluate(() => document.getElementById("u02-overlay")?.remove());
  const leftover = await page.evaluate(() => document.querySelectorAll("#u02-overlay").length);
  console.log("OVERLAY_REMOVED, leftover =", leftover);
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

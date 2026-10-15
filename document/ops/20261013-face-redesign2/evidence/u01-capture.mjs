// U01 센서칩 검증 — 실앱(5014) headless: 칩 계산스타일 + 800x360 1장.
// 용법: node u01-capture.mjs <baseUrl> <outDir>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [baseUrl, outDir] = process.argv.slice(2);
if (!baseUrl || !outDir) {
  console.error("usage: node u01-capture.mjs <baseUrl> <outDir>");
  process.exit(2);
}
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

  const chipInfo = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".hud-cadence")) {
      const cs = getComputedStyle(el);
      const led = el.querySelector(".hud-cadence__led");
      const lcs = led ? getComputedStyle(led) : null;
      out.push({
        cls: el.className.toString(),
        bg: cs.backgroundColor,
        color: cs.color,
        borderColor: cs.borderTopColor,
        led: lcs ? { bg: lcs.backgroundColor, shadow: lcs.boxShadow } : null,
      });
    }
    return out;
  });
  console.log("CHIP:", JSON.stringify(chipInfo, null, 1));
  await page.screenshot({ path: path.join(outDir, "u01-800x360.png") });
  console.log("SHOT: u01-800x360.png");
} finally {
  await browser.close();
}
console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

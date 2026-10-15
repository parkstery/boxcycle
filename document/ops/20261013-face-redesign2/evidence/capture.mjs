/* Route-creation popup capture — 20261013-face-redesign2 task 01.
 * Real app on dev server. Usage:
 *   node capture.mjs <baseUrl> <outDir> <tag>
 * Captures .map-view__pick states at 800x360 and 667x300:
 *   before-pin / after-pin(start) / distance-mode-on / profile-selected
 * Records bounding boxes + scroll sizes for rect comparison.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [baseUrl, outDir, tag] = process.argv.slice(2);
if (!baseUrl || !outDir || !tag) {
  console.error("usage: node capture.mjs <baseUrl> <outDir> <tag>");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { name: "800x360", width: 800, height: 360 },
  { name: "667x300", width: 667, height: 300 },
];

const result = { tag, baseUrl, viewports: {}, consoleErrors: [] };

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on("console", (m) => {
      if (m.type() === "error") result.consoleErrors.push(`[${vp.name}] ${m.text().slice(0, 200)}`);
    });
    page.on("pageerror", (e) => result.consoleErrors.push(`[${vp.name}] pageerror: ${String(e).slice(0, 200)}`));
    const vpRec = { viewport: vp, shots: {}, rects: {}, failed: null };
    result.viewports[vp.name] = vpRec;
    try {
      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
      // Guest gate
      const gate = page.getByRole("dialog", { name: "시작" });
      await gate.waitFor({ state: "visible", timeout: 30_000 });
      await gate.getByRole("button", { name: "시작", exact: true }).click();
      await gate.waitFor({ state: "hidden", timeout: 30_000 });

      const map = page.locator(".mapboxgl-canvas").first();
      await map.waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(1500);
      await map.click({ position: { x: Math.round(vp.width * 0.6), y: Math.round(vp.height / 2) } });

      const pick = page.locator(".map-view__pick").last();
      await pick.waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(2500); // reverse-geocode settle

      const shot = async (name) => {
        const p = path.join(outDir, `${tag}-${vp.name}-${name}.png`);
        await pick.screenshot({ path: p });
        vpRec.shots[name] = p;
      };
      const measure = () =>
        pick.evaluate((el) => {
          const r = (n) => Math.round(n * 100) / 100;
          const box = (e) => {
            const b = e.getBoundingClientRect();
            return { x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height) };
          };
          const kids = {};
          for (const c of el.children) {
            const key = c.className?.toString().split(" ")[0] || c.tagName;
            kids[key] = { box: box(c), scrollW: c.scrollWidth, scrollH: c.scrollHeight };
          }
          const cs = getComputedStyle(el);
          return {
            panel: box(el),
            scrollW: el.scrollWidth,
            scrollH: el.scrollHeight,
            bg: cs.backgroundColor,
            color: cs.color,
            children: kids,
          };
        });

      await shot("01-before-pin");
      vpRec.rects["before-pin"] = await measure();

      // After pin: click Start
      await pick.getByRole("button", { name: "Set start" }).click();
      await page.waitForTimeout(2000);
      await shot("02-after-pin");
      vpRec.rects["after-pin"] = await measure();

      // Distance auto-route mode ON (checkbox)
      const mode = pick.locator(".map-view__pick-distance-mode-checkbox");
      if (await mode.count()) {
        await mode.check({ force: true });
        await page.waitForTimeout(1500);
        await shot("03-distance-on");
        vpRec.rects["distance-on"] = await measure();
      }

      // Profile select (cycling) — is-active state
      const cycling = pick.getByRole("button", { name: "자전거 경로" });
      if (await cycling.count()) {
        await cycling.click({ force: true });
        await page.waitForTimeout(800);
        await shot("04-profile-cycling");
        vpRec.rects["profile-cycling"] = await measure();
        vpRec.profileActive = await pick.evaluate((el) => {
          const b = el.querySelector(".map-view__pick-btn--profile.is-active");
          const cs = b ? getComputedStyle(b) : null;
          return b
            ? { cls: b.className, bg: cs.backgroundColor, color: cs.color, border: cs.borderColor }
            : null;
        });
      }
    } catch (e) {
      vpRec.failed = String(e).slice(0, 500);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(outDir, `${tag}-measurements.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ done: tag, viewports: Object.keys(result.viewports) }));
for (const [k, v] of Object.entries(result.viewports)) {
  console.log(k, v.failed ? `FAILED: ${v.failed}` : `shots: ${Object.keys(v.shots).join(",")}`);
}
console.log(`consoleErrors: ${result.consoleErrors.length}`);
for (const e of result.consoleErrors.slice(0, 10)) console.log("  " + e);

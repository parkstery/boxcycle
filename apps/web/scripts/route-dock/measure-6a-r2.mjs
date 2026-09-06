import { chromium } from "playwright";
import { writeFileSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const OUT = resolve(HERE, "6a-r2-measure");
mkdirSync(OUT, { recursive: true });

const baselineCss = resolve(HERE, "_baseline-RouteDock.css");
const afterCss = resolve(WEB, "src/components/route-dock/RouteDock.css");
const template = readFileSync(resolve(HERE, "measure-dock.html"), "utf8");

function htmlFor(cssAbs) {
  return template.replace("ROUTE_DOCK_CSS", pathToFileURL(cssAbs).href);
}

async function measure(page, key, html, mode) {
  const tmp = resolve(OUT, `${key}.html`);
  writeFileSync(tmp, html, "utf8");
  await page.goto(pathToFileURL(tmp).href + `?mode=${mode}`);
  await page.waitForSelector("#dock");
  const box = await page.locator("#dock").boundingBox();
  const shell = await page.locator(".route-dock__shell").boundingBox();
  const shot = resolve(OUT, `${key}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  return {
    key,
    mode,
    dock_w: box ? Math.round(box.width) : null,
    dock_h: box ? Math.round(box.height) : null,
    shell_w: shell ? Math.round(shell.width) : null,
    shell_h: shell ? Math.round(shell.height) : null,
    shot,
  };
}

const browser = await chromium.launch();
const page = await (await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 1,
})).newPage();

const beforeHtml = htmlFor(baselineCss);
const afterHtml = htmlFor(afterCss);

const results = [
  await measure(page, "before-collapsed", beforeHtml, "before-collapsed"),
  await measure(page, "before-expanded", beforeHtml, "before-expanded"),
  await measure(page, "after-collapsed", afterHtml, "after-collapsed"),
  await measure(page, "after-expanded", afterHtml, "after-expanded"),
];

copyFileSync(resolve(OUT, "after-collapsed.png"), resolve(OUT, "idle-collapsed.png"));
copyFileSync(resolve(OUT, "after-expanded.png"), resolve(OUT, "ready-expanded.png"));
copyFileSync(resolve(OUT, "after-collapsed.png"), resolve(OUT, "riding-collapsed.png"));

await page.setContent(`<!doctype html><html><body style="margin:0;background:#1e293b;width:844px;height:390px;position:relative;font-family:system-ui">
  <div style="position:absolute;top:12px;right:12px;display:flex;gap:8px;align-items:center">
    <div style="min-width:96px;height:36px;border-radius:999px;background:rgba(15,23,42,.55);border:1px solid rgba(248,250,252,.18);color:#fff;display:flex;align-items:center;justify-content:center;font:650 12px system-ui;padding:0 12px">계정</div>
  </div>
  <div style="position:absolute;top:56px;right:12px;width:44px;height:44px;border-radius:12px;background:rgba(15,23,42,.55);border:1px solid rgba(248,250,252,.18);color:#fff;display:flex;align-items:center;justify-content:center;font:700 12px system-ui">맵</div>
  <div style="position:absolute;top:8px;right:120px;width:120px;height:44px;border:2px dashed #22c55e;border-radius:10px;color:#86efac;font:600 11px system-ui;display:flex;align-items:center;justify-content:center">chip gone</div>
</body></html>`);
await page.screenshot({ path: resolve(OUT, "top-right-empty.png"), fullPage: true });

const report = { viewport: { width: 844, height: 390 }, results };
writeFileSync(resolve(OUT, "metrics.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
await browser.close();

// 시안 그림. 실행: (apps/web) node ../../document/ops/20261101-interval-cycle-donut/capture.mjs [mockup|mockup-c]
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire(new URL("../../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const name = process.argv[2] ?? "mockup";
const html = fileURLToPath(new URL(`./${name}.html`, import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(html).href);
await page.screenshot({ path: fileURLToPath(new URL(`./${name}.png`, import.meta.url)), fullPage: true });
await browser.close();

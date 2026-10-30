// 구현 캡처: 우상단 구름 도구·RouteDock 톱니(접힘)·접기 캐럿(펼침). 실행: (apps/web) node ../../document/ops/20261030-gear-cloud-mockup/capture.mjs
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.CAPTURE_BASE ?? "http://localhost:5018";
const out = new URL("./evidence/", import.meta.url);
const sizes = [{ width: 800, height: 360 }, { width: 699, height: 273 }];
const browser = await chromium.launch();
for (const size of sizes) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 3 });
  await page.goto(`${base}/scripts/ui-800x360/preview.html?state=ready`);
  await page.waitForSelector(".route-dock__head");
  const fold = page.getByRole("button", { name: "경로 패널 접기", exact: true });
  if (!(await fold.count())) await page.getByRole("button", { name: "경로 패널 펼치기", exact: true }).click();
  await page.screenshot({ path: new URL(`open-${size.width}x${size.height}.png`, out).pathname.slice(1) });
  await page.getByRole("button", { name: "경로 패널 접기", exact: true }).click();
  await page.screenshot({ path: new URL(`closed-${size.width}x${size.height}.png`, out).pathname.slice(1) });
  await page.close();
}
await browser.close();

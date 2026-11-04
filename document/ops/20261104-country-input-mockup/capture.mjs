// 시안 캡처: 폰 가로 800×360·699×273. 실행(apps/web): node ../../document/ops/20261104-country-input-mockup/capture.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const page0 = new URL("./mockup.html", import.meta.url).href;
const launch = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await chromium.launch(launch);
for (const size of [{ width: 800, height: 360 }, { width: 699, height: 273 }]) {
  for (const frame of ["a0", "a", "a2", "b", "c"]) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
    await page.goto(`${page0}#${frame}`);
    await page.waitForTimeout(400);
    const out = fileURLToPath(new URL(`./${frame}-${size.width}x${size.height}.png`, import.meta.url));
    await page.screenshot({ path: out });
    const fit = await page.evaluate(() => {
      const card = document.querySelector(".frame.on .auth-gate__card, .frame.on .ride-settings-sheet__panel");
      return card ? { scroll: card.scrollHeight - card.clientHeight, h: card.clientHeight } : null;
    });
    console.log(frame, size.width, JSON.stringify(fit));
    await page.close();
  }
}
await browser.close();

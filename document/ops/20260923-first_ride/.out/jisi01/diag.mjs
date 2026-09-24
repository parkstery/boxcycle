import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "apps/web/.out/first-ride-jisi01";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://127.0.0.1:5000/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);

const gate = page.getByRole("dialog", { name: "시작" });
console.log("gate", await gate.isVisible().catch(() => false));
if (await gate.isVisible().catch(() => false)) {
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 45000 });
}
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/diag-after-guest.png` });

const info = await page.evaluate(() => {
  return {
    localFirst: document.querySelectorAll(".local-first__card").length,
    firstRide: document.querySelectorAll(".first-ride__card").length,
    nextRide: document.querySelectorAll(".next-ride__card").length,
    body: document.body?.innerText?.slice(0, 1200) ?? "",
    classes: [...document.querySelectorAll("[class*='ride'],[class*='local'],[class*='guest']")]
      .slice(0, 30)
      .map((el) => el.className),
  };
});
console.log(JSON.stringify({ errors, info }, null, 2));
await browser.close();

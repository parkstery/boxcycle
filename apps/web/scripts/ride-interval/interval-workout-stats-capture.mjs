import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Ego's screenshot timed out twice; this isolated headless capture uses only the fixture server.
const output = resolve("../../tmp/interval-workout-stats");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
  await page.goto("http://127.0.0.1:5197/scripts/ride-interval/interval-workout-stats-fixture.html");
  await page.locator(".interval-workout-stats__summary").waitFor();
  await page.screenshot({ path: resolve(output, "800x360.png") });
  await page.setViewportSize({ width: 640, height: 320 });
  await page.screenshot({ path: resolve(output, "640x320.png") });
  await page.locator(".interval-workout-stats__body").evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await page.screenshot({ path: resolve(output, "640x320-list.png") });
  console.log({ captured: ["800x360.png", "640x320.png", "640x320-list.png"], output });
} finally {
  await browser.close();
}

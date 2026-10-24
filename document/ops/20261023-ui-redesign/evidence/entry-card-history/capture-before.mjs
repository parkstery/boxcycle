/**
 * 지시 24 — 변경 전 캡처(앱 소스 수정 없음). harness 5020 + ui-800x360 프리뷰.
 * 실행: RTW_DEV_PORT=5020 으로 dev:localhost --mode harness 를 띄운 뒤
 *   node document/ops/20261023-ui-redesign/evidence/entry-card-history/capture-before.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:5020";
const preview = `${base}/scripts/ui-800x360/preview.html`;

async function shotAccountInline(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${preview}?state=account`);
  const account = page.getByRole("dialog", { name: "사용자 정보", exact: true });
  await account.waitFor({ state: "visible" });
  await account.getByRole("button", { name: /마지막 주행/ }).click();
  await page.locator("#user-info-sheet-history-list").waitFor({ state: "visible" });
  const out = path.join(__dirname, `before-account-inline-${w}x${h}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log("wrote", out);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const { w, h } of [{ w: 667, h: 300 }, { w: 800, h: 360 }]) {
    await shotAccountInline(page, w, h);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

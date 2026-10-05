/**
 * 실제 RideSettingsSheet를 Vite로 마운트한 뒤 740×300 캡처·입력·줄넘침 검증.
 * 손코딩 HTML 위장 금지 — 컴포넌트+CSS import. 프로덕션 저장·로그인 불필요.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../..");
const outDir = path.resolve(
  webRoot,
  "../../document/ops/20261006-calories-resume/fixtures",
);
const outEmpty = path.join(outDir, "calorie-settings-empty-740x300.png");
const outFilled = path.join(outDir, "calorie-settings-filled-740x300.png");
const outNarrow = path.join(outDir, "calorie-settings-narrow-740x300.png");

function overflowReport(box, label) {
  if (!box) return `${label}: missing`;
  const overflowX = box.scrollWidth > box.clientWidth + 1;
  const overflowY = box.scrollHeight > box.clientHeight + 1;
  return `${label}: ${box.clientWidth}x${box.clientHeight} scroll=${box.scrollWidth}x${box.scrollHeight} overflowX=${overflowX} overflowY=${overflowY}`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  // configFile 의 react 플러그인만 사용 — 중복 plugin 은 RefreshRuntime 이중선언
  const server = await createServer({
    configFile: path.join(webRoot, "vite.config.ts"),
    root: webRoot,
    server: {
      host: "127.0.0.1",
      port: 5198,
      strictPort: true,
    },
    publicDir: false,
  });

  await server.listen();
  const addr = server.resolvedUrls?.local?.[0];
  if (!addr) {
    await server.close();
    throw new Error("vite listen failed — no local URL");
  }
  const url = new URL("/scripts/ride-calories/calorie-settings-ui-fixture.html", addr).href;
  console.log("fixture url", url);

  const browser = await chromium.launch({ headless: true });
  const limits = [];
  try {
    const page = await browser.newPage({ viewport: { width: 740, height: 300 } });
    page.on("pageerror", (err) => console.error("pageerror", err));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("console", msg.text());
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("dialog", { name: "주행 설정" }).waitFor({ state: "visible", timeout: 45_000 });
    await page.getByLabel("추정 칼로리").waitFor({ state: "visible" });

    // 무입력 상태 캡처
    await page.screenshot({ path: outEmpty, fullPage: false });
    console.log("captured", outEmpty);

    // 체중·강도 입력
    const weight = page.locator(".ride-settings-sheet__weight input");
    await weight.fill("72");
    await page.getByRole("button", { name: "보통" }).click();
    await page.waitForTimeout(150);
    const weightValue = await weight.inputValue();
    if (weightValue !== "72") throw new Error(`weight draft expected 72, got ${weightValue}`);
    const pressed = await page.getByRole("button", { name: "보통" }).getAttribute("aria-pressed");
    if (pressed !== "true") throw new Error("intensity moderate not pressed");

    await page.screenshot({ path: outFilled, fullPage: false });
    console.log("captured", outFilled);

    const panel = page.locator(".ride-settings-sheet__panel");
    const calorieRow = page.locator(".ride-settings-sheet__calorie-row");
    const panelBox = await panel.evaluate((el) => ({
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
    }));
    const rowBox = await calorieRow.evaluate((el) => ({
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
    }));
    limits.push(overflowReport(panelBox, "panel@740"));
    limits.push(overflowReport(rowBox, "calorie-row@740"));

    // 좁은 가로(폰 가로에 가깝게) 줄넘침
    await page.setViewportSize({ width: 640, height: 300 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: outNarrow, fullPage: false });
    console.log("captured", outNarrow);
    const rowNarrow = await calorieRow.evaluate((el) => ({
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
    }));
    limits.push(overflowReport(rowNarrow, "calorie-row@640"));

    for (const line of limits) console.log("limit", line);

    // 가로 스크롤로 지도/패널이 깨지면 실패 — wrap 허용(scrollWidth≈clientWidth)
    if (panelBox.scrollWidth > panelBox.clientWidth + 2) {
      throw new Error(`panel horizontal overflow: ${panelBox.scrollWidth}>${panelBox.clientWidth}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

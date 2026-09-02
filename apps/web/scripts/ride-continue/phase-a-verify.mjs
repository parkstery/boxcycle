/**
 * R1 단계 A — 일회성 실동작 확인 (commit 하지 않음).
 * 전제: npm run dev (기본 5001 if 5000 busy)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, ".out", "phase-a");
const BASE_URL = process.env.RIDE_CONTINUE_PHASE_A_BASE_URL ?? "http://127.0.0.1:5001";
const RUN_ID = process.env.RIDE_CONTINUE_RUN_ID ?? Date.now().toString(36);

async function enterAsGuest(page) {
  await page.goto(BASE_URL);
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 60_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function prepareManualRideInput(page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await sheet.waitFor({ state: "visible", timeout: 15_000 });
  await sheet.getByRole("button", { name: "체험 속도로 준비" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 10_000 });
}

async function clickMap(page, offsetX, offsetY) {
  const canvas = page.locator("canvas.mapboxgl-canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(600);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas missing");
  await page.mouse.click(box.x + offsetX, box.y + offsetY);
  await page.waitForTimeout(500);
}

function pickSurface(page) {
  return page.locator(".map-view__pick-dock-panel, .map-view__pick-popup").last();
}

async function dismissPickPopup(page) {
  const dockClose = page.locator(".map-view__pick-dock-close").first();
  if (await dockClose.isVisible().catch(() => false)) {
    await dockClose.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(600);
}

async function createAutoRoute(page, targetKm = 5) {
  await clickMap(page, 420, 320);
  const popup = pickSurface(page);
  await popup.waitFor({ state: "visible", timeout: 30_000 });
  await popup.getByRole("button", { name: "Set start" }).evaluate((n) => n.click());
  await page.waitForTimeout(600);
  await popup.getByTestId("route-token-holding").waitFor({ state: "visible", timeout: 30_000 });

  const drivingBtn = popup.getByRole("button", { name: "자동차 경로" });
  if (await drivingBtn.isVisible().catch(() => false)) {
    await drivingBtn.click();
    await page.waitForTimeout(300);
  }

  const modeCheckbox = popup.getByRole("checkbox", { name: "거리와 방향으로 Route 찾기" });
  await modeCheckbox.check();
  await popup
    .locator('.map-view__pick-auto-route-status[data-phase="direction"]')
    .waitFor({ state: "visible", timeout: 10_000 });

  const numberInput = popup.locator(".map-view__pick-distance-number");
  await numberInput.fill(String(targetKm));
  await numberInput.dispatchEvent("change");
  await page.waitForTimeout(800);

  const autoRoutePromise = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("getDistanceAutoRoute") && r.ok(),
    { timeout: 120_000 },
  );
  await clickMap(page, 1100, 400);
  const resp = await autoRoutePromise;
  const body = await resp.json();
  const result = body?.result ?? body;
  await popup
    .locator(".map-view__pick-auto-route-status--found")
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
  await page.waitForTimeout(600);
  await dismissPickPopup(page);
  return result;
}

async function readRouteDockStops(page) {
  const stops = page.locator(".route-dock__stop");
  const count = await stops.count();
  const texts = [];
  for (let i = 0; i < count; i += 1) {
    texts.push((await stops.nth(i).innerText()).trim());
  }
  return texts;
}

async function screenshot(page, name, report) {
  const p = path.join(OUT_DIR, `${RUN_ID}-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  report.artifacts.push(p);
  return p;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    runId: RUN_ID,
    baseUrl: BASE_URL,
    checks: {},
    autoRoute: null,
    savedRoute: null,
    afterEnd: null,
    artifacts: [],
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  try {
    await enterAsGuest(page);
    await prepareManualRideInput(page);

    const autoResult = await createAutoRoute(page, 5);
    report.autoRoute = {
      distanceMeters: autoResult?.distanceMeters ?? autoResult?.distance,
      durationSec: autoResult?.durationSec ?? autoResult?.duration,
      geometryPointCount: autoResult?.geometry?.coordinates?.length ?? 0,
      start: autoResult?.start,
      end: autoResult?.end,
      outcome: autoResult?.outcome,
    };
    await screenshot(page, "01-auto-route-applied", report);

    // Check 2: save
    const saveName = `r1-phase-a-${RUN_ID}`;
    await page.getByRole("button", { name: "내 경로로 저장" }).click();
    await page.locator(".route-dock__save-input").fill(saveName);
    await page.getByRole("button", { name: "저장" }).click();
    await page.waitForTimeout(3000);
    await screenshot(page, "02-saved-before-ride", report);

    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await page.getByRole("tab", { name: /내 경로/ }).click();
    await page.waitForTimeout(1500);
    const savedRow = page.locator(".saved-routes__item").filter({ hasText: saveName }).first();
    report.checks.saveVisibleInList = await savedRow.isVisible().catch(() => false);
    const savedSub = report.checks.saveVisibleInList
      ? (await savedRow.locator(".saved-routes__item-sub").innerText().catch(() => ""))
      : "";
    report.savedRoute = { name: saveName, listSubtext: savedSub.trim() };
    await screenshot(page, "03-saved-list", report);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Check 1: Go → running
    const go = page.getByRole("button", { name: "주행 시작" });
    report.checks.goEnabled = await go.isEnabled();
    await go.click();
    await page.waitForTimeout(2000);
    report.checks.rideRunning =
      (await page.getByRole("group", { name: "주행 지표" }).isVisible().catch(() => false)) &&
      (await page.getByRole("button", { name: "주행 종료" }).isVisible().catch(() => false));
    await screenshot(page, "04-running", report);

    // End ride
    await page.getByRole("button", { name: "주행 종료" }).click();
    await page.waitForTimeout(4000);

    const summaryOpen = await page.getByRole("region", { name: "주행 결과" }).isVisible().catch(() => false);
    report.checks.rideSummaryOpen = summaryOpen;
    report.checks.nextRideCardExists = (await page.getByText("다음 주행").count()) > 0;
    const dockStops = await readRouteDockStops(page);
    const summaryActions = [];
    if (summaryOpen) {
      if (await page.getByRole("button", { name: "내 경로로 저장" }).isVisible().catch(() => false)) {
        summaryActions.push("내 경로로 저장");
      }
      if (await page.getByText("저장 안 함").isVisible().catch(() => false)) {
        summaryActions.push("저장 안 함");
      }
      if (await page.getByRole("button", { name: "닫기" }).isVisible().catch(() => false)) {
        summaryActions.push("닫기");
      }
    }
    report.afterEnd = {
      routeDockStops: dockStops,
      summaryOpen,
      summaryActions,
      hasNextRideUi: report.checks.nextRideCardExists,
    };
    await screenshot(page, "05-after-end-saved-route", report);

    // Check 3: ad-hoc 주행 종료 — 결과 시트·startLngLat (저장 없이)
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    const gateAgain = page.getByRole("dialog", { name: "시작" });
    if (await gateAgain.isVisible().catch(() => false)) {
      await gateAgain.getByRole("button", { name: "시작", exact: true }).click();
      await gateAgain.waitFor({ state: "hidden", timeout: 30_000 });
    }
    await prepareManualRideInput(page);
    await createAutoRoute(page, 3);
    await screenshot(page, "06-adhoc-route-ready", report);

    const go2 = page.getByRole("button", { name: "주행 시작" });
    await go2.click();
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "주행 종료" }).click();
    await page.waitForTimeout(5000);

    const summaryOpenAdhoc = await page.getByRole("region", { name: "주행 결과" }).isVisible().catch(() => false);
    const summaryActionsAdhoc = [];
    if (summaryOpenAdhoc) {
      for (const label of ["내 경로로 저장", "저장 안 함", "닫기"]) {
        if (await page.getByRole("button", { name: label }).isVisible().catch(() => false)) {
          summaryActionsAdhoc.push(label);
        }
      }
    }
    const dockStopsAdhoc = await readRouteDockStops(page);
    report.afterEndAdhoc = {
      routeDockStops: dockStopsAdhoc,
      summaryOpen: summaryOpenAdhoc,
      summaryActions: summaryActionsAdhoc,
      hasNextRideUi: (await page.getByText("다음 주행").count()) > 0,
    };
    report.checks.rideSummaryOpenAdhoc = summaryOpenAdhoc;
    report.checks.nextRideCardExistsAdhoc = report.afterEndAdhoc.hasNextRideUi;
    await screenshot(page, "07-after-end-adhoc", report);

    const reportPath = path.join(OUT_DIR, `${RUN_ID}-report.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`[phase-a] report: ${reportPath}`);
  } finally {
    await browser.close();
  }
}

await main();

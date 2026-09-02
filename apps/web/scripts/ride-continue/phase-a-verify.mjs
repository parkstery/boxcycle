/**
 * R1 단계 A — 일회성 실동작 확인.
 * 전제: emulator + `npm run dev:emulator` (기본 5002, `RIDE_CONTINUE_PHASE_A_BASE_URL` 로 덮어쓰기)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, ".out", "phase-a");
const BASE_URL = process.env.RIDE_CONTINUE_PHASE_A_BASE_URL ?? "http://127.0.0.1:5001";
const RUN_ID = process.env.RIDE_CONTINUE_RUN_ID ?? Date.now().toString(36);

function writeReportJson(reportPath, report) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

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
  await modeCheckbox.waitFor({ state: "visible", timeout: 10_000 });
  await modeCheckbox.check();

  const numberInput = popup.locator(".map-view__pick-distance-number");
  await numberInput.waitFor({ state: "visible", timeout: 10_000 });
  await numberInput.fill(String(targetKm));
  await numberInput.dispatchEvent("change");
  await page.waitForTimeout(300);

  await popup
    .getByText("도착하고 싶은 도로 위 지점을 클릭하세요")
    .waitFor({ state: "visible", timeout: 30_000 });
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

function parseRouteDockStartLabel(stops) {
  const start = stops.find((s) => s.startsWith("S\n") || s.startsWith("S\r\n") || s === "S");
  if (!start) return null;
  return start.replace(/^S[\r\n]+/, "").trim();
}

async function collectSummaryActions(page) {
  const region = page.getByRole("region", { name: "주행 결과" });
  const summaryOpen = await region.isVisible().catch(() => false);
  const summaryActions = [];
  if (!summaryOpen) {
    return { summaryOpen, summaryActions };
  }
  for (const label of ["내 경로로 저장", "저장 안 함"]) {
    const btn = region.getByRole("button", { name: label });
    if (await btn.isVisible().catch(() => false)) {
      summaryActions.push(label);
    }
  }
  if (await region.locator(".ride-summary__close").isVisible().catch(() => false)) {
    summaryActions.push("닫기");
  }
  for (const label of ["지금 새 경로 연결", "끝점에서 새 경로"]) {
    const btn = region.getByRole("button", { name: label });
    if (await btn.isVisible().catch(() => false)) {
      summaryActions.push(label);
    }
  }
  return { summaryOpen, summaryActions };
}

async function collectIdleAfterRideUi(page) {
  const nextRideCardExists =
    (await page.getByRole("region", { name: "다음 주행" }).isVisible().catch(() => false)) ||
    (await page.locator(".next-ride-anchor").isVisible().catch(() => false));
  const routeDockStops = await readRouteDockStops(page);
  return {
    nextRideCardExists,
    routeDockStops,
    routeDockStartLabel: parseRouteDockStartLabel(routeDockStops),
    hasNextRideUi: nextRideCardExists,
  };
}

async function closeRideSummarySheet(page) {
  const region = page.getByRole("region", { name: "주행 결과" });
  if (!(await region.isVisible().catch(() => false))) return false;

  const closeBtn = region.locator(".ride-summary__close");
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  } else {
    await region.locator(".ride-summary__scrim").click({ force: true });
  }
  await page.waitForTimeout(1500);

  return !(await region.isVisible().catch(() => true));
}

async function measureAfterRideEnd(page, labelPrefix) {
  await page.waitForTimeout(4000);

  const whileOpen = await collectSummaryActions(page);
  const idleWhileOpen = await collectIdleAfterRideUi(page);

  const afterEndWhileSheetOpen = {
    rideSummaryOpen: whileOpen.summaryOpen,
    summaryActions: whileOpen.summaryActions,
    routeDockStops: idleWhileOpen.routeDockStops,
    routeDockStartLabel: idleWhileOpen.routeDockStartLabel,
    nextRideCardExists: idleWhileOpen.nextRideCardExists,
    hasNextRideUi: idleWhileOpen.hasNextRideUi,
  };

  const closed = await closeRideSummarySheet(page);
  await page.waitForTimeout(1500);

  const idleAfterClose = await collectIdleAfterRideUi(page);
  const afterEndAfterSheetClosed = {
    summaryClosed: closed,
    routeDockStops: idleAfterClose.routeDockStops,
    routeDockStartLabel: idleAfterClose.routeDockStartLabel,
    nextRideCardExists: idleAfterClose.nextRideCardExists,
    hasNextRideUi: idleAfterClose.hasNextRideUi,
  };

  return { afterEndWhileSheetOpen, afterEndAfterSheetClosed, labelPrefix };
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
    savedRouteEnd: null,
    adhocEnd: null,
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

    const go = page.getByRole("button", { name: "주행 시작" });
    report.checks.goEnabled = await go.isEnabled();
    await go.click();
    await page.waitForTimeout(80_000);
    report.checks.rideRunning =
      (await page.getByRole("group", { name: "주행 지표" }).isVisible().catch(() => false)) &&
      (await page.getByRole("button", { name: "주행 종료" }).isVisible().catch(() => false));
    await screenshot(page, "04-running", report);

    await page.getByRole("button", { name: "주행 종료" }).click();
    const savedEnd = await measureAfterRideEnd(page, "saved");
    report.savedRouteEnd = {
      afterEndWhileSheetOpen: savedEnd.afterEndWhileSheetOpen,
      afterEndAfterSheetClosed: savedEnd.afterEndAfterSheetClosed,
    };
    report.checks.rideSummaryOpen = savedEnd.afterEndWhileSheetOpen.rideSummaryOpen;
    report.checks.nextRideCardExistsWhileSheetOpen =
      savedEnd.afterEndWhileSheetOpen.nextRideCardExists;
    report.checks.nextRideCardExistsAfterSheetClosed =
      savedEnd.afterEndAfterSheetClosed.nextRideCardExists;
    await screenshot(page, "05-after-end-saved-while-open", report);
    await screenshot(page, "05b-after-end-saved-closed", report);

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
    await page.waitForTimeout(80_000);
    await page.getByRole("button", { name: "주행 종료" }).click();
    const adhocEnd = await measureAfterRideEnd(page, "adhoc");
    report.adhocEnd = {
      afterEndWhileSheetOpen: adhocEnd.afterEndWhileSheetOpen,
      afterEndAfterSheetClosed: adhocEnd.afterEndAfterSheetClosed,
    };
    report.checks.rideSummaryOpenAdhoc = adhocEnd.afterEndWhileSheetOpen.rideSummaryOpen;
    report.checks.nextRideCardExistsAdhocWhileSheetOpen =
      adhocEnd.afterEndWhileSheetOpen.nextRideCardExists;
    report.checks.nextRideCardExistsAdhocAfterSheetClosed =
      adhocEnd.afterEndAfterSheetClosed.nextRideCardExists;
    await screenshot(page, "07-after-end-adhoc-while-open", report);
    await screenshot(page, "07b-after-end-adhoc-closed", report);

    const reportPath = path.join(OUT_DIR, `${RUN_ID}-report.json`);
    writeReportJson(reportPath, report);
    console.log(JSON.stringify(report, null, 2));
    console.log(`[phase-a] report: ${reportPath}`);
  } finally {
    await browser.close();
  }
}

await main();

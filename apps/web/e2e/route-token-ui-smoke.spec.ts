import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { harnessControl, pollInspectUser } from "../scripts/route-token/harness-control.mjs";
import { HARNESS_TEST_ECONOMY } from "../scripts/route-token/harness-test-economy.mjs";

const LIVE = process.env.ROUTE_TOKEN_UI_LIVE === "1";
const FORCE_FAIL = process.env.ROUTE_TOKEN_UI_FORCE_FAIL === "1";
const RUN_ID = process.env.ROUTE_TOKEN_RUN_ID ?? "unknown-run";
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/route-token/.out");
const directionsV5Hits: string[] = [];

function routePickSurface(page: import("@playwright/test").Page) {
  return page.locator(".map-view__pick-dock-panel, .map-view__pick-popup").last();
}

function routePickContent(page: import("@playwright/test").Page) {
  return page.locator(".map-view__pick").last();
}

type RouteResult = {
  routeTokenBalance: number;
  geometry: unknown;
  distance: number;
  duration: number;
};

function clearEvidenceDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of fs.readdirSync(OUT_DIR)) {
    if (name.startsWith("ui-smoke-") && (name.endsWith(".png") || name.endsWith(".json"))) {
      fs.unlinkSync(path.join(OUT_DIR, name));
    }
  }
}

async function enterAsGuest(page: import("@playwright/test").Page, options: { gateTimeoutMs?: number } = {}) {
  const gateTimeoutMs = options.gateTimeoutMs ?? 60_000;
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: gateTimeoutMs });
  const uidPromise = page.waitForResponse(
    (r) =>
      r.url().includes("identitytoolkit.googleapis.com") &&
      (r.url().includes("signUp") || r.url().includes("signIn")) &&
      r.ok(),
    { timeout: 60_000 },
  );
  const onboardingPromise = page
    .waitForResponse(
      (r) => r.url().includes("ensureRouteTokenOnboardingHttp") && r.ok(),
      { timeout: 60_000 },
    )
    .catch(() => null);
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden();
  const authJson = (await (await uidPromise).json()) as { localId?: string };
  if (!authJson.localId) throw new Error("Guest uid 를 auth 응답에서 찾을 수 없습니다");
  await onboardingPromise;
  await page.waitForTimeout(1000);
  return authJson.localId;
}

async function dismissMapPopup(page: import("@playwright/test").Page) {
  const dockClose = page.locator(".map-view__pick-dock-close").first();
  if (await dockClose.isVisible().catch(() => false)) {
    await dockClose.click();
    await page.waitForTimeout(250);
    return;
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

async function clickMap(page: import("@playwright/test").Page, offsetX: number, offsetY: number) {
  const canvas = page.locator("canvas.mapboxgl-canvas").first();
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas bounding box missing");
  await page.mouse.click(box.x + offsetX, box.y + offsetY);
  await page.waitForTimeout(400);
}

async function clickMapFraction(
  page: import("@playwright/test").Page,
  xRatio: number,
  yRatio: number,
) {
  const canvas = page.locator("canvas.mapboxgl-canvas").first();
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(400);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas bounding box missing");
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  await page.waitForTimeout(400);
}

async function waitForDirectionsPost(
  page: import("@playwright/test").Page,
  action: () => Promise<void>,
): Promise<RouteResult> {
  const responsePromise = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().includes("getMapboxDirections") &&
      r.status() === 200,
    { timeout: 90_000 },
  );
  await action();
  const response = await responsePromise;
  const json = (await response.json()) as {
    result?: {
      routeTokenBalance?: unknown;
      geometry?: unknown;
      distance?: unknown;
      duration?: unknown;
    };
  };
  const result = json.result;
  expect(result, "getMapboxDirections result").toBeTruthy();
  const balance = result?.routeTokenBalance;
  expect(typeof balance, "routeTokenBalance type").toBe("number");
  expect(result?.geometry, "geometry").toBeTruthy();
  expect(typeof result?.distance, "distance").toBe("number");
  expect(typeof result?.duration, "duration").toBe("number");
  return {
    routeTokenBalance: balance as number,
    geometry: result?.geometry,
    distance: result?.distance as number,
    duration: result?.duration as number,
  };
}

async function assertNoGlobalTokenSurface(page: import("@playwright/test").Page) {
  await expect(page.locator(".route-token-map-feedback")).toHaveCount(0);
}

async function assertMapTokenUi(
  page: import("@playwright/test").Page,
  holding: number,
  spendMessage?: string,
) {
  const popup = routePickSurface(page);
  await expect(popup).toBeVisible();
  await assertNoGlobalTokenSurface(page);

  const feedback = popup.getByTestId("route-token-popup-feedback");
  await expect(feedback).toBeVisible();
  const holdingLine = feedback.getByTestId("route-token-holding");

  if (spendMessage) {
    await expect(holdingLine).toHaveText(`경로 생성 잔여 토큰 ${holding}개 · ${spendMessage}`);
    await expect(holdingLine).toHaveAttribute("data-token-variant", "spend");
  } else if (holding > 0) {
    await expect(holdingLine).toHaveText(`경로 생성 잔여 토큰 ${holding}개`);
    await expect(holdingLine).toHaveAttribute("data-token-variant", "cost");
  } else {
    await expect(holdingLine).toHaveText("경로 생성 잔여 토큰 0개 · 경로 토큰 부족");
    await expect(holdingLine).toHaveAttribute("data-token-variant", "insufficient");
  }
}

async function openRoutePopupWithPins(
  page: import("@playwright/test").Page,
  offset: number,
) {
  await dismissMapPopup(page);
  const panelClear = page.getByRole("button", { name: "경로 전체 삭제" }).first();
  if (await panelClear.isVisible().catch(() => false)) {
    await panelClear.click();
    await page.waitForTimeout(300);
  }

  await clickMap(page, 180 + offset, 180);
  const popup = routePickContent(page);
  await popup.getByRole("button", { name: "Set start" }).click();
  await expect(routePickSurface(page)).toBeVisible({ timeout: 30_000 });
  // 좌측 도킹 panel과 겹치지 않는 우측 영역을 클릭해 End 지점을 연다.
  await clickMapFraction(page, 0.8, 0.45);
  const endPopup = routePickContent(page);
  const endBtn = endPopup.locator(".map-view__pick-btn--end");
  await expect(endBtn).toBeVisible({ timeout: 30_000 });
  await endBtn.click();
  await expect(routePickSurface(page)).toBeVisible({ timeout: 30_000 });
}

async function planOneRoute(
  page: import("@playwright/test").Page,
  offset: number,
  expectedBalance: number,
  options: { screenshotLabel?: string; clearAfter?: boolean } = {},
) {
  const { screenshotLabel, clearAfter = true } = options;
  const expectedSpendMessage = `Route Token -1 · 잔여 ${expectedBalance}개`;
  const expectedHoldingBefore = expectedBalance + 1;

  await openRoutePopupWithPins(page, offset);

  const cycling = page.getByRole("button", { name: "자전거 경로" });
  await expect(cycling).toBeEnabled({ timeout: 30_000 });
  await expect(routePickSurface(page).getByTestId("route-token-holding")).toHaveText(
    `경로 생성 잔여 토큰 ${expectedHoldingBefore}개`,
    { timeout: 30_000 },
  );
  await assertMapTokenUi(page, expectedHoldingBefore);

  const routeResult = await waitForDirectionsPost(page, async () => {
    await cycling.click();
  });
  expect(routeResult.routeTokenBalance).toBe(expectedBalance);

  await assertMapTokenUi(page, expectedBalance, expectedSpendMessage);
  await expect(routePickSurface(page)).toBeVisible();

  if (screenshotLabel) {
    await page.screenshot({
      path: path.join(OUT_DIR, `ui-smoke-${RUN_ID}-${screenshotLabel}.png`),
      fullPage: true,
    });
  }

  if (clearAfter) {
    await dismissMapPopup(page);
    const clear = page.getByRole("button", { name: "경로 전체 삭제" }).first();
    if (await clear.isVisible().catch(() => false)) {
      await clear.click();
      await page.waitForTimeout(300);
    }
  }

  return routeResult;
}

test.describe("Route Token UI smoke", () => {
  test.skip(!LIVE || FORCE_FAIL, "ROUTE_TOKEN_UI_LIVE=1 + Emulator 필요");

  test.setTimeout(600_000);

  test.beforeAll(async () => {
    clearEvidenceDir();
    await harnessControl("reset");
    await harnessControl("seedEconomy", { economy: HARNESS_TEST_ECONOMY });
  });

  test.beforeEach(async ({ page }) => {
    directionsV5Hits.length = 0;
    page.on("request", (req) => {
      if (req.url().includes("/directions/v5/")) directionsV5Hits.push(req.url());
    });
  });

  test.afterEach(() => {
    expect(
      directionsV5Hits,
      `Mapbox Directions 직접 호출: ${directionsV5Hits.join(", ")}`,
    ).toEqual([]);
  });

  test("메뉴 닫힘 기본 지도: 보유량·차감·4번째 차단·계정 격리·적립 재개", async ({ page }) => {
    const evidence: Record<string, unknown> = { runId: RUN_ID, directionsV5Hits: [] };

    const guestA = await enterAsGuest(page);
    evidence.guestA = guestA;

    await expect(page.getByRole("button", { name: "Trail 메뉴" })).toBeVisible();
    await assertNoGlobalTokenSurface(page);
    await openRoutePopupWithPins(page, 0);
    await assertMapTokenUi(page, 3);
    await page.screenshot({
      path: path.join(OUT_DIR, `ui-smoke-${RUN_ID}-01-pre-route-balance-3.png`),
      fullPage: true,
    });

    const routeEvidence: Array<{ step: number; balance: number; distance: number; duration: number }> =
      [];
    const screenshotLabels = ["02-route-1-balance-2", "03-route-2-balance-1", "04-route-3-balance-0"];

    for (let i = 0; i < 3; i += 1) {
      const expectedBalance = 2 - i;
      const result = await planOneRoute(page, i * 12, expectedBalance, {
        screenshotLabel: screenshotLabels[i],
        clearAfter: i < 2,
      });
      routeEvidence.push({
        step: i + 1,
        balance: result.routeTokenBalance,
        distance: result.distance,
        duration: result.duration,
      });
    }
    evidence.routeEvidence = routeEvidence;

    const afterThree = await pollInspectUser(guestA, {
      balance: 0,
      routeGenerateSpend: 3,
      providerCallCount: 3,
    });
    evidence.afterThree = afterThree;

    await openRoutePopupWithPins(page, 300);
    await assertMapTokenUi(page, 0);
    const cycling = page.getByRole("button", { name: "자전거 경로" });
    await expect(cycling).toBeDisabled();
    await page.screenshot({
      path: path.join(OUT_DIR, `ui-smoke-${RUN_ID}-05-fourth-blocked.png`),
      fullPage: true,
    });

    const afterFourth = await pollInspectUser(guestA, {
      balance: 0,
      routeGenerateSpend: 3,
      providerCallCount: 3,
    });
    evidence.afterFourth = afterFourth;

    await harnessControl("setBalance", { uid: guestA, balance: 1 });
    await pollInspectUser(guestA, { balance: 1, routeGenerateSpend: 3, providerCallCount: 3 });
    await dismissMapPopup(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Trail 메뉴" })).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);

    const earned = await planOneRoute(page, 48, 0, {
      screenshotLabel: "06-earned-route-balance-0",
      clearAfter: false,
    });
    evidence.earnedRoute = earned;

    const browser = page.context().browser();
    if (!browser) throw new Error("browser missing");
    const guestBContext = await browser.newContext();
    const guestBPage = await guestBContext.newPage();
    guestBPage.on("request", (req) => {
      if (req.url().includes("/directions/v5/")) directionsV5Hits.push(req.url());
    });
    const guestB = await enterAsGuest(guestBPage, { gateTimeoutMs: 90_000 });
    evidence.guestB = guestB;
    expect(guestB).not.toBe(guestA);
    await openRoutePopupWithPins(guestBPage, 60);
    await assertMapTokenUi(guestBPage, 3);
    await expect(guestBPage.getByTestId("route-token-spend-toast")).toHaveCount(0);

    const guestBFirst = await planOneRoute(guestBPage, 60, 2, {
      screenshotLabel: "07-guest-b-first-route-balance-2",
      clearAfter: false,
    });
    evidence.guestBFirst = guestBFirst;
    await guestBContext.close();

    evidence.directionsV5Hits = [...directionsV5Hits];
    fs.writeFileSync(
      path.join(OUT_DIR, `ui-smoke-${RUN_ID}-evidence.json`),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
  });
});

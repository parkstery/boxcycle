import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pollInspectUser } from "../scripts/route-token/harness-control.mjs";

const LIVE = process.env.ROUTE_TOKEN_UI_LIVE === "1";
const FORCE_FAIL = process.env.ROUTE_TOKEN_UI_FORCE_FAIL === "1";
const RUN_ID = process.env.ROUTE_TOKEN_RUN_ID ?? "unknown-run";
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/route-token/.out");
const directionsV5Hits: string[] = [];

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

async function enterAsGuest(page: import("@playwright/test").Page) {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible();
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

async function openTrailMenu(page: import("@playwright/test").Page) {
  const menuBtn = page.getByRole("button", { name: "Trail 메뉴" });
  await expect(menuBtn).toBeVisible({ timeout: 30_000 });
  await menuBtn.click();
  await page.waitForTimeout(400);
}

async function planOneRoute(
  page: import("@playwright/test").Page,
  offset: number,
  expectedBalance: number,
) {
  const expectedSpendMessage = `Route Token -1 · 잔여 ${expectedBalance}개`;
  await dismissMapPopup(page);
  const panelClear = page.getByRole("button", { name: "경로 전체 삭제" }).first();
  if (await panelClear.isVisible().catch(() => false)) {
    await panelClear.click();
    await page.waitForTimeout(300);
  }

  await clickMap(page, 180 + offset, 180);
  await page.getByRole("button", { name: "Set start" }).click({ timeout: 30_000 });
  await clickMap(page, 260 + offset, 240);
  await page.getByRole("button", { name: "Set end" }).click();

  const cycling = page.getByRole("button", { name: "자전거 경로" });
  await expect(cycling).toBeEnabled({ timeout: 30_000 });

  const routeResult = await waitForDirectionsPost(page, async () => {
    await cycling.click();
  });
  expect(routeResult.routeTokenBalance).toBe(expectedBalance);
  await expect(page.getByText(expectedSpendMessage)).toBeVisible({ timeout: 15_000 });

  await dismissMapPopup(page);
  const clear = page.getByRole("button", { name: "경로 전체 삭제" }).first();
  if (await clear.isVisible().catch(() => false)) {
    await clear.click();
    await page.waitForTimeout(300);
  }

  return routeResult;
}

test.describe("Route Token UI smoke", () => {
  test.skip(!LIVE || FORCE_FAIL, "ROUTE_TOKEN_UI_LIVE=1 + Emulator 필요");

  test.setTimeout(180_000);

  test.beforeAll(() => {
    clearEvidenceDir();
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

  test("Guest 3회 Route 응답 2·1·0 → backend 0/3/3 → 4번째 UI 차단", async ({ page }) => {
    const routeEvidence: Array<{ step: number; balance: number; distance: number; duration: number }> =
      [];

    const guestUid = await enterAsGuest(page);
    await openTrailMenu(page);

    for (let i = 0; i < 3; i += 1) {
      const expectedBalance = 2 - i;
      const result = await planOneRoute(page, i * 12, expectedBalance);
      routeEvidence.push({
        step: i + 1,
        balance: result.routeTokenBalance,
        distance: result.distance,
        duration: result.duration,
      });
      if (i === 0 || i === 2) {
        await page.screenshot({
          path: path.join(
            OUT_DIR,
            `ui-smoke-${RUN_ID}-route-${i + 1}-balance-${expectedBalance}.png`,
          ),
          fullPage: true,
        });
      }
    }

    fs.writeFileSync(
      path.join(OUT_DIR, `ui-smoke-${RUN_ID}-routes.json`),
      `${JSON.stringify({ runId: RUN_ID, guestUid, routeEvidence }, null, 2)}\n`,
      "utf8",
    );

    await page.screenshot({
      path: path.join(OUT_DIR, `ui-smoke-${RUN_ID}-after-3-routes.png`),
      fullPage: true,
    });

    const afterThree = await pollInspectUser(guestUid, {
      balance: 0,
      routeGenerateSpend: 3,
      providerCallCount: 3,
    });
    expect(afterThree.balance).toBe(0);
    expect(afterThree.routeGenerateSpend).toBe(3);
    expect(afterThree.providerCallCount).toBe(3);

    await dismissMapPopup(page);
    await clickMap(page, 300, 200);
    await page.getByRole("button", { name: "Set start" }).click({ timeout: 30_000 });
    await clickMap(page, 360, 260);
    await page.getByRole("button", { name: "Set end" }).click();

    await expect(page.getByText("경로 토큰 부족")).toBeVisible({ timeout: 15_000 });
    const cycling = page.getByRole("button", { name: "자전거 경로" });
    await expect(cycling).toBeDisabled();

    await page.screenshot({
      path: path.join(OUT_DIR, `ui-smoke-${RUN_ID}-token-exhausted.png`),
      fullPage: true,
    });

    const afterFourth = await pollInspectUser(guestUid, {
      balance: 0,
      routeGenerateSpend: 3,
      providerCallCount: 3,
    });
    expect(afterFourth.providerCallCount).toBe(3);
    expect(afterFourth.routeGenerateSpend).toBe(3);
  });
});

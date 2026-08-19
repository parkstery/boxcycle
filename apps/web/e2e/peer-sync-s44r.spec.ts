import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * S4-4R — Chief 조건 재현. S44-jitter-* 는 읽기만 하고 덮지 않는다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const SHOT_DIR = path.join(OUT_DIR, "S44R-shots");
const CONDITION_ID = "C1-left-5kmh-abreast";

type JitterDump = {
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  recording: boolean;
  conditionId: string | null;
  events: unknown[];
  judgment: {
    dominantSignal: string;
    startGapDistM: number | null;
    startGapScreenPx: number | null;
    displayFrames: number;
    ingestEvents: number;
    alongReverseCount: number;
    maxAlongReversePx: number;
    distBacktrackCount: number;
    maxDistBacktrackM: number;
    hasLocalScreen: boolean;
    reason: string;
  };
};

async function guestStart(page: import("@playwright/test").Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function loadIntroCourse(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문" }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  const items = modal.locator("button.oc-modal__item");
  await expect(items.first()).toBeVisible();
  const n = await items.count();
  await items.nth(Math.max(0, n - 1)).click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function dismissRideSummaryIfAny(page: import("@playwright/test").Page) {
  const summary = page.getByRole("dialog", { name: "주행 결과" });
  if (!(await summary.isVisible().catch(() => false))) return;
  const skip = summary.getByRole("button", { name: "저장 안 함" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  else await summary.getByRole("button", { name: "닫기" }).first().click();
  await expect(summary).toBeHidden({ timeout: 10_000 });
}

async function ensureRiding(page: import("@playwright/test").Page) {
  await dismissRideSummaryIfAny(page);
  if (await page.getByRole("button", { name: "주행 종료" }).isVisible().catch(() => false)) return;
  if (await page.getByRole("button", { name: "재개" }).first().isVisible().catch(() => false)) return;
  const start = page.getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
}

async function ensureDockExpanded(page: import("@playwright/test").Page) {
  await ensureRiding(page);
  const fold = page.getByRole("button", { name: "경로 패널 접기" });
  if (!(await fold.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "경로 패널 펼치기" }).click();
  }
  await expect(page.getByRole("slider", { name: "세션 속도 km/h" })).toBeVisible({
    timeout: 10_000,
  });
}

async function setSpeedKmh(page: import("@playwright/test").Page, kmh: number) {
  await ensureDockExpanded(page);
  await page.getByRole("slider", { name: "세션 속도 km/h" }).fill(String(kmh));
}

async function openMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (await sheet.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: "맵 뷰 설정" }).click();
  await expect(sheet).toBeVisible({ timeout: 10_000 });
}

async function closeMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (!(await sheet.isVisible().catch(() => false))) return;
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function setFollowLeft(page: import("@playwright/test").Page) {
  await openMapSheet(page);
  await page
    .getByRole("dialog", { name: "맵 뷰" })
    .getByRole("button", { name: "좌측", exact: true })
    .click({ force: true });
  await closeMapSheet(page);
}

async function peerGapM(page: import("@playwright/test").Page): Promise<number | null> {
  return page.evaluate(() => {
    const rows = (window as Window & { __RTW_PEER_STEP_DIAG__?: Array<{ gap: number }> })
      .__RTW_PEER_STEP_DIAG__;
    if (!rows || rows.length === 0) return null;
    return rows[0]!.gap;
  });
}

test.describe("S4-4R Chief condition capture", () => {
  test.setTimeout(180_000);

  test("C1 좌측 5km/h 나란히", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.setViewportSize({ width: 1280, height: 900 });
    await pageB.setViewportSize({ width: 1280, height: 900 });

    await pageA.goto("/?peerSyncLogMs=200");
    await guestStart(pageA);
    await loadIntroCourse(pageA);
    await ensureRiding(pageA);
    await setSpeedKmh(pageA, 5);
    await setFollowLeft(pageA);

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 })
      .not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`);
    await guestStart(pageB);
    await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
    await ensureRiding(pageB);
    await setSpeedKmh(pageB, 5);
    await setFollowLeft(pageB);

    await expect
      .poll(async () => peerGapM(pageB), { timeout: 30_000 })
      .not.toBeNull();

    const alignDeadline = Date.now() + 45_000;
    while (Date.now() < alignDeadline) {
      const gap = await peerGapM(pageB);
      if (gap != null && Math.abs(gap) <= 5) break;
      if (gap != null && gap > 5) {
        await setSpeedKmh(pageA, 0);
        await setSpeedKmh(pageB, 12);
      } else if (gap != null && gap < -5) {
        await setSpeedKmh(pageA, 12);
        await setSpeedKmh(pageB, 0);
      }
      await pageA.waitForTimeout(800);
    }

    await setSpeedKmh(pageA, 5);
    await setSpeedKmh(pageB, 5);
    await pageA.waitForTimeout(1_000);

    const gapBefore = await peerGapM(pageB);
    await pageB.evaluate((id) => {
      (
        window as Window & { __rtwPeerJitterApi: { begin: (c?: string) => void } }
      ).__rtwPeerJitterApi.begin(id);
    }, CONDITION_ID);

    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await pageA.waitForTimeout(6_000);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "C1-00.png"), fullPage: false });
    await pageA.waitForTimeout(6_000);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "C1-01.png"), fullPage: false });
    await pageA.waitForTimeout(6_000);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "C1-02.png"), fullPage: false });
    await pageA.waitForTimeout(4_000);

    const dump = (await pageB.evaluate(() => {
      return (
        window as Window & { __rtwPeerJitterApi: { end: () => JitterDump } }
      ).__rtwPeerJitterApi.end();
    })) as JitterDump;

    const out = {
      instruction: "S4-4R",
      conditionId: CONDITION_ID,
      trailId,
      camera: "leftFlat",
      speedKmh: [5, 5],
      tabState: "both visible",
      alignGapM: gapBefore,
      startGapDistM: dump.judgment.startGapDistM,
      startGapScreenPx: dump.judgment.startGapScreenPx,
      judgment: dump.judgment,
      windowStartedAt: dump.windowStartedAt,
      windowEndedAt: dump.windowEndedAt,
      eventCount: dump.events.length,
      events: dump.events,
    };

    fs.writeFileSync(path.join(OUT_DIR, "S44R-C1-left-5kmh.json"), JSON.stringify(out, null, 2), "utf8");
    fs.writeFileSync(
      path.join(OUT_DIR, "S44R-C1-summary.json"),
      JSON.stringify(
        {
          instruction: "S4-4R",
          conditionId: CONDITION_ID,
          trailId,
          camera: "leftFlat",
          speedKmh: [5, 5],
          tabState: "both visible",
          alignGapM: gapBefore,
          startGapDistM: dump.judgment.startGapDistM,
          startGapScreenPx: dump.judgment.startGapScreenPx,
          judgment: dump.judgment,
          eventCount: dump.events.length,
        },
        null,
        2,
      ),
      "utf8",
    );

    expect(dump.conditionId).toBe(CONDITION_ID);
    expect(dump.judgment.displayFrames).toBeGreaterThan(10);
    expect(dump.judgment.ingestEvents).toBeGreaterThan(0);
  });
});

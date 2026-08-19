import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * S4-4R2 — S44 조건(C-A 25/25 근접, C-B 32/10 추월)을 로컬 좌표 켠 채로 다시 찍는다.
 * S44-jitter-* · S44R-rejudge.json · S44R-C1-* · S44R-shots 는 읽기만 하고 덮지 않는다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const SHOT_DIR = path.join(OUT_DIR, "S44R2-shots");

type CameraSplit = {
  hasLocalScreen: boolean;
  k1Pass: boolean;
  k1MaxAbsResidualPx: number;
  k1FrameCount: number;
  s44ClassReproduced: boolean;
  verdict: string | null;
  verdictReason: string;
  peerAlong: { reverseCount: number; maxReversePx: number; peakToPeakPx: number; negativeCount: number };
  localAlong: { reverseCount: number; maxReversePx: number; peakToPeakPx: number; negativeCount: number };
  relativeAlong: { reverseCount: number; maxReversePx: number; peakToPeakPx: number; negativeCount: number };
  samples?: unknown[];
};

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
    cameraSplit: CameraSplit;
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

function stripSamples(split: CameraSplit): CameraSplit {
  const { samples: _samples, ...rest } = split;
  return rest;
}

function writeCapture(opts: {
  fileStem: string;
  conditionId: string;
  trailId: string;
  speedKmh: [number, number];
  note: string;
  dump: JitterDump;
}) {
  const judgment = {
    ...opts.dump.judgment,
    cameraSplit: stripSamples(opts.dump.judgment.cameraSplit),
  };
  const full = {
    instruction: "S4-4R2",
    conditionId: opts.conditionId,
    trailId: opts.trailId,
    camera: "leftFlat",
    speedKmh: opts.speedKmh,
    tabState: "both visible",
    note: opts.note,
    startGapDistM: opts.dump.judgment.startGapDistM,
    startGapScreenPx: opts.dump.judgment.startGapScreenPx,
    judgment: {
      ...opts.dump.judgment,
      cameraSplit: {
        ...stripSamples(opts.dump.judgment.cameraSplit),
        reverseSamples: (opts.dump.judgment.cameraSplit.samples ?? []).filter(
          (s) =>
            typeof s === "object" &&
            s != null &&
            ((s as { peerReversed?: boolean }).peerReversed ||
              (s as { localReversed?: boolean }).localReversed ||
              (s as { relReversed?: boolean }).relReversed),
        ),
      },
    },
    windowStartedAt: opts.dump.windowStartedAt,
    windowEndedAt: opts.dump.windowEndedAt,
    eventCount: opts.dump.events.length,
    events: opts.dump.events,
  };
  fs.writeFileSync(path.join(OUT_DIR, `${opts.fileStem}.json`), JSON.stringify(full, null, 2), "utf8");
  fs.writeFileSync(
    path.join(OUT_DIR, `${opts.fileStem}-summary.json`),
    JSON.stringify(
      {
        instruction: "S4-4R2",
        conditionId: opts.conditionId,
        trailId: opts.trailId,
        camera: "leftFlat",
        speedKmh: opts.speedKmh,
        tabState: "both visible",
        note: opts.note,
        startGapDistM: opts.dump.judgment.startGapDistM,
        startGapScreenPx: opts.dump.judgment.startGapScreenPx,
        judgment,
        eventCount: opts.dump.events.length,
        fullEvents: `${opts.fileStem}.json`,
      },
      null,
      2,
    ),
    "utf8",
  );
}

test.describe("S4-4R2 camera vs peer split", () => {
  test.setTimeout(180_000);

  test("C-A 25/25 근접 후 C-B 32/10 추월", async ({ browser }) => {
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
    await setFollowLeft(pageA);

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 })
      .not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`);
    await guestStart(pageB);
    await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
    await ensureRiding(pageB);
    await setFollowLeft(pageB);

    await expect
      .poll(async () => peerGapM(pageB), { timeout: 30_000 })
      .not.toBeNull();
    await expect
      .poll(
        async () =>
          pageB.evaluate(() => Boolean((window as Window & { __rtwPeerJitterApi?: unknown }).__rtwPeerJitterApi)),
        { timeout: 20_000 },
      )
      .toBe(true);

    fs.mkdirSync(SHOT_DIR, { recursive: true });

    // C-A — S44 close-00..02. 같은 속도. 나란히 정렬하지 않음. startGap 만 기록.
    await setSpeedKmh(pageA, 25);
    await setSpeedKmh(pageB, 25);
    await pageB.evaluate((id) => {
      (window as Window & { __rtwPeerJitterApi: { begin: (c?: string) => void } }).__rtwPeerJitterApi.begin(id);
    }, "C-A-25-25-close");
    await pageA.waitForTimeout(4_000);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "A-00.png"), fullPage: false });
    await pageA.waitForTimeout(180);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "A-01.png"), fullPage: false });
    await pageA.waitForTimeout(180);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "A-02.png"), fullPage: false });
    await pageA.waitForTimeout(3_000);

    const dumpA = (await pageB.evaluate(() => {
      return (window as Window & { __rtwPeerJitterApi: { end: () => JitterDump } }).__rtwPeerJitterApi.end();
    })) as JitterDump;

    writeCapture({
      fileStem: "S44R2-A-25-25",
      conditionId: "C-A-25-25-close",
      trailId,
      speedKmh: [25, 25],
      note: "S44 close-00..02 와 같음. 같은 속도라서 근접이라고 단정하지 않음.",
      dump: dumpA,
    });

    expect(dumpA.conditionId).toBe("C-A-25-25-close");
    expect(dumpA.judgment.hasLocalScreen).toBe(true);
    expect(dumpA.judgment.cameraSplit.hasLocalScreen).toBe(true);
    expect(dumpA.judgment.displayFrames).toBeGreaterThan(10);
    expect(dumpA.judgment.ingestEvents).toBeGreaterThan(0);

    // C-B — S44 far-00. 속도차 추월. 별도 begin/end · 별도 JSON.
    await setSpeedKmh(pageA, 32);
    await setSpeedKmh(pageB, 10);
    await pageB.evaluate((id) => {
      (window as Window & { __rtwPeerJitterApi: { begin: (c?: string) => void } }).__rtwPeerJitterApi.begin(id);
    }, "C-B-32-10-overtake");
    await pageA.waitForTimeout(8_000);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "B-00.png"), fullPage: false });

    const dumpB = (await pageB.evaluate(() => {
      return (window as Window & { __rtwPeerJitterApi: { end: () => JitterDump } }).__rtwPeerJitterApi.end();
    })) as JitterDump;

    writeCapture({
      fileStem: "S44R2-B-32-10",
      conditionId: "C-B-32-10-overtake",
      trailId,
      speedKmh: [32, 10],
      note: "S44 far-00 과 같음. 속도차 추월.",
      dump: dumpB,
    });

    expect(dumpB.conditionId).toBe("C-B-32-10-overtake");
    expect(dumpB.judgment.hasLocalScreen).toBe(true);
    expect(dumpB.judgment.cameraSplit.hasLocalScreen).toBe(true);
    expect(dumpB.judgment.displayFrames).toBeGreaterThan(10);
    expect(dumpB.judgment.ingestEvents).toBeGreaterThan(0);
  });
});

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * S4-4R3 — 단독 주행 대조군. C-A/C-B 는 읽기만 하고 다시 찍지 않는다.
 * S44* · S44R* · S44R2* 산출물은 덮지 않는다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const SHOT_DIR = path.join(OUT_DIR, "S44R3-shots");
const CAMERA_DISTANCE_M = 40;

type Along = {
  reverseCount: number;
  maxReversePx: number;
  peakToPeakPx: number;
  negativeCount: number;
};

type Survival = {
  displayFrames: number;
  hasLocalScreen: boolean;
  uhatFromLocalDist: boolean;
  uhatFrameCount: number;
  uhatSource: string;
  localScreenTravelPx: number;
  pass: boolean;
  failReasons: string[];
};

type JitterDump = {
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  recording: boolean;
  conditionId: string | null;
  routeLenM: number | null;
  events: Array<{ kind?: string; atMs?: number }>;
  judgment: {
    displayFrames: number;
    hasLocalScreen: boolean;
    peerUids: string[];
    reason: string;
    cameraSplit: { localAlong: Along };
    survival: Survival;
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

function medianFrameDtMs(events: Array<{ kind?: string; atMs?: number }>): number | null {
  const disp = events.filter((e) => e.kind === "display" && typeof e.atMs === "number");
  const dts: number[] = [];
  for (let i = 1; i < disp.length; i += 1) {
    dts.push(disp[i]!.atMs! - disp[i - 1]!.atMs!);
  }
  if (dts.length === 0) return null;
  dts.sort((a, b) => a - b);
  const mid = Math.floor(dts.length / 2);
  return dts.length % 2 === 1 ? dts[mid]! : (dts[mid - 1]! + dts[mid]!) / 2;
}

function readDuoAlong(summaryFile: string): Along {
  const j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, summaryFile), "utf8")) as {
    judgment: { cameraSplit: { localAlong: Along } };
  };
  return j.judgment.cameraSplit.localAlong;
}

function ratio(solo: number, duo: number): number | null {
  if (duo === 0) return solo === 0 ? 1 : null;
  return solo / duo;
}

test.describe("S4-4R3 solo local control", () => {
  test.setTimeout(180_000);

  test("S-A 혼자 25km/h 후 S-B 혼자 32km/h", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto("/?peerSyncLogMs=200");
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await setFollowLeft(page);

    await expect
      .poll(async () => new URL(page.url()).searchParams.get("trail"), { timeout: 20_000 })
      .not.toBeNull();
    const trailId = new URL(page.url()).searchParams.get("trail")!;

    await expect
      .poll(
        async () =>
          page.evaluate(() => Boolean((window as Window & { __rtwPeerJitterApi?: unknown }).__rtwPeerJitterApi)),
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => (window as Window & { __RTW_PEER_SYNC_SELF_DIST_M?: number }).__RTW_PEER_SYNC_SELF_DIST_M ?? 0,
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0.5);

    fs.mkdirSync(SHOT_DIR, { recursive: true });

    await setSpeedKmh(page, 25);
    await page.evaluate((id) => {
      (window as Window & { __rtwPeerJitterApi: { begin: (c?: string) => void } }).__rtwPeerJitterApi.begin(id);
    }, "S-A-solo-25");
    await page.waitForTimeout(4_000);
    await page.screenshot({ path: path.join(SHOT_DIR, "A-00.png"), fullPage: false });
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(SHOT_DIR, "A-01.png"), fullPage: false });
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(SHOT_DIR, "A-02.png"), fullPage: false });
    await page.waitForTimeout(3_000);

    const dumpA = (await page.evaluate(() => {
      return (window as Window & { __rtwPeerJitterApi: { end: () => JitterDump } }).__rtwPeerJitterApi.end();
    })) as JitterDump;

    expect(dumpA.judgment.survival.pass, dumpA.judgment.survival.failReasons.join(" | ")).toBe(true);
    expect(dumpA.judgment.survival.displayFrames).toBeGreaterThan(10);
    expect(dumpA.judgment.survival.hasLocalScreen).toBe(true);
    expect(dumpA.judgment.survival.uhatFromLocalDist).toBe(true);
    expect(dumpA.judgment.survival.localScreenTravelPx).toBeGreaterThan(0);
    expect(dumpA.judgment.peerUids.every((u) => u === "__local__")).toBe(true);

    await setSpeedKmh(page, 32);
    await page.evaluate((id) => {
      (window as Window & { __rtwPeerJitterApi: { begin: (c?: string) => void } }).__rtwPeerJitterApi.begin(id);
    }, "S-B-solo-32");
    await page.waitForTimeout(8_000);
    await page.screenshot({ path: path.join(SHOT_DIR, "B-00.png"), fullPage: false });

    const dumpB = (await page.evaluate(() => {
      return (window as Window & { __rtwPeerJitterApi: { end: () => JitterDump } }).__rtwPeerJitterApi.end();
    })) as JitterDump;

    expect(dumpB.judgment.survival.pass, dumpB.judgment.survival.failReasons.join(" | ")).toBe(true);
    expect(dumpB.judgment.survival.displayFrames).toBeGreaterThan(10);
    expect(dumpB.judgment.survival.uhatFromLocalDist).toBe(true);
    expect(dumpB.judgment.peerUids.every((u) => u === "__local__")).toBe(true);

    const duoA = readDuoAlong("S44R2-A-25-25-summary.json");
    const duoB = readDuoAlong("S44R2-B-32-10-summary.json");
    const soloA = dumpA.judgment.cameraSplit.localAlong;
    const soloB = dumpB.judgment.cameraSplit.localAlong;

    const condA = {
      instruction: "S4-4R3",
      conditionId: "S-A-solo-25",
      trailId,
      riders: 1,
      speedKmh: [25],
      camera: "leftFlat",
      cameraDistanceM: CAMERA_DISTANCE_M,
      routeLenM: dumpA.routeLenM,
      windowMs:
        dumpA.windowEndedAt != null && dumpA.windowStartedAt != null
          ? dumpA.windowEndedAt - dumpA.windowStartedAt
          : null,
      displayFrames: dumpA.judgment.displayFrames,
      medianFrameDtMs: medianFrameDtMs(dumpA.events),
      survival: dumpA.judgment.survival,
      localAlong: soloA,
      duoCitation: {
        file: "S44R2-A-25-25-summary.json",
        windowMs: 10066,
        displayFrames: 71,
        medianFrameDtMs: 137.5,
        camera: "leftFlat",
        cameraDistanceM: CAMERA_DISTANCE_M,
        localAlong: duoA,
      },
    };
    const condB = {
      instruction: "S4-4R3",
      conditionId: "S-B-solo-32",
      trailId,
      riders: 1,
      speedKmh: [32],
      camera: "leftFlat",
      cameraDistanceM: CAMERA_DISTANCE_M,
      routeLenM: dumpB.routeLenM,
      windowMs:
        dumpB.windowEndedAt != null && dumpB.windowStartedAt != null
          ? dumpB.windowEndedAt - dumpB.windowStartedAt
          : null,
      displayFrames: dumpB.judgment.displayFrames,
      medianFrameDtMs: medianFrameDtMs(dumpB.events),
      survival: dumpB.judgment.survival,
      localAlong: soloB,
      duoCitation: {
        file: "S44R2-B-32-10-summary.json",
        windowMs: 8713,
        displayFrames: 73,
        medianFrameDtMs: 118.5,
        camera: "leftFlat",
        cameraDistanceM: CAMERA_DISTANCE_M,
        localAlong: duoB,
      },
    };

    function writePair(
      stem: string,
      cond: typeof condA,
      dump: JitterDump,
    ) {
      fs.writeFileSync(
        path.join(OUT_DIR, `${stem}.json`),
        JSON.stringify({ ...cond, events: dump.events, judgment: dump.judgment }, null, 2),
        "utf8",
      );
      fs.writeFileSync(path.join(OUT_DIR, `${stem}-summary.json`), JSON.stringify(cond, null, 2), "utf8");
    }
    writePair("S44R3-S-A-solo-25", condA, dumpA);
    writePair("S44R3-S-B-solo-32", condB, dumpB);

    fs.writeFileSync(
      path.join(OUT_DIR, "S44R3-comparison.json"),
      JSON.stringify(
        {
          instruction: "S4-4R3",
          note: "2인 ② 는 S44R2 산출물 인용. 다시 찍지 않음. 판정은 계열 비교. 프레임 투표 없음.",
          camera: "leftFlat",
          cameraDistanceM: CAMERA_DISTANCE_M,
          table: {
            "② reverseCount": { "C-A": duoA.reverseCount, "S-A": soloA.reverseCount, "C-B": duoB.reverseCount, "S-B": soloB.reverseCount },
            "② maxReversePx": { "C-A": duoA.maxReversePx, "S-A": soloA.maxReversePx, "C-B": duoB.maxReversePx, "S-B": soloB.maxReversePx },
            "② peakToPeakPx": { "C-A": duoA.peakToPeakPx, "S-A": soloA.peakToPeakPx, "C-B": duoB.peakToPeakPx, "S-B": soloB.peakToPeakPx },
            "② negativeCount": { "C-A": duoA.negativeCount, "S-A": soloA.negativeCount, "C-B": duoB.negativeCount, "S-B": soloB.negativeCount },
          },
          ratioSoloOverDuo: {
            A: {
              reverseCount: ratio(soloA.reverseCount, duoA.reverseCount),
              maxReversePx: ratio(soloA.maxReversePx, duoA.maxReversePx),
              peakToPeakPx: ratio(soloA.peakToPeakPx, duoA.peakToPeakPx),
            },
            B: {
              reverseCount: ratio(soloB.reverseCount, duoB.reverseCount),
              maxReversePx: ratio(soloB.maxReversePx, duoB.maxReversePx),
              peakToPeakPx: ratio(soloB.peakToPeakPx, duoB.peakToPeakPx),
            },
          },
          conditionMatch: {
            A: { soloWindowMs: condA.windowMs, duoWindowMs: 10066, soloMedianDtMs: condA.medianFrameDtMs, duoMedianDtMs: 137.5, soloFrames: condA.displayFrames, duoFrames: 71 },
            B: { soloWindowMs: condB.windowMs, duoWindowMs: 8713, soloMedianDtMs: condB.medianFrameDtMs, duoMedianDtMs: 118.5, soloFrames: condB.displayFrames, duoFrames: 73 },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
  });
});

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildShotManifest,
  medianShotIntervalMs,
  peakShotSeparationMs,
} from "../scripts/s44/shot-manifest.ts";

/**
 * S4-5 — R7 과 같은 조건·픽셀 추출. 산출은 S45-after-* · S45-shots. R7 산출물을 덮지 않는다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const SHOT_DIR = path.join(OUT_DIR, "S45-shots");
const CONDITION_ID = "chief-left-5kmh-abreast";
const ALIGN_MS = 9 * 60 * 1000;
const SHOT_WINDOW_MS = 4000;
const SCOUT_MS = 5000;

type Along = {
  reverseCount: number;
  maxReversePx: number;
  peakToPeakPx: number;
  negativeCount: number;
};

type RelSample = { atMs: number; relSPx: number; localSPx: number; peerSPx: number };

type JitterDump = {
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  recording: boolean;
  conditionId: string | null;
  routeLenM: number | null;
  events: Array<{
    kind?: string;
    atMs?: number;
    gapDistM?: number | null;
    screenX?: number | null;
    localScreenX?: number | null;
  }>;
  judgment: {
    displayFrames: number;
    hasLocalScreen: boolean;
    startGapDistM: number | null;
    startGapScreenPx: number | null;
    reason: string;
    cameraSplit: {
      relativeAlong: Along;
      localAlong: Along;
      peerAlong: Along;
      samples: RelSample[];
    };
    gapWindow: {
      frameCount: number;
      minGapDistM: number | null;
      maxGapDistM: number | null;
      minAbsGapDistM: number | null;
      maxAbsGapDistM: number | null;
      medianAbsGapDistM: number | null;
      allAbsLe5m: boolean;
    };
    relativeReverses: Array<{
      atMs: number;
      magPx: number;
      relSPx: number;
      gapDistM: number | null;
      displayIndex: number;
    }>;
    timing: { windowMs: number | null; displayFrames: number; medianFrameDtMs: number | null };
  };
};

type JitterApi = {
  begin: (c?: string) => void;
  end: () => JitterDump;
  lastGap: () => { gapDistM: number | null; gapScreenPx: number | null; atMs: number | null };
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

async function foldDock(page: import("@playwright/test").Page) {
  const fold = page.getByRole("button", { name: "경로 패널 접기" });
  if (await fold.isVisible().catch(() => false)) await fold.click();
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

async function peerDisplayGapM(page: import("@playwright/test").Page): Promise<number | null> {
  return page.evaluate(() => {
    const api = (window as Window & { __rtwPeerJitterApi?: JitterApi }).__rtwPeerJitterApi;
    if (!api?.lastGap) return null;
    return api.lastGap().gapDistM;
  });
}

test.describe("S4-5 PNG pixel capture", () => {
  test.setTimeout(1_200_000);

  test("같은 조건 · PNG 무손실 · 네임태그 포함 샷", async ({ browser }) => {
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

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 })
      .not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    const setupA = (async () => {
      await setFollowLeft(pageA);
      await setSpeedKmh(pageA, 5);
    })();
    const setupB = (async () => {
      await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`);
      await guestStart(pageB);
      await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
      await ensureRiding(pageB);
      await setFollowLeft(pageB);
      await setSpeedKmh(pageB, 5);
    })();
    await Promise.all([setupA, setupB]);

    await expect
      .poll(
        async () =>
          pageB.evaluate(() => Boolean((window as Window & { __rtwPeerJitterApi?: unknown }).__rtwPeerJitterApi)),
        { timeout: 20_000 },
      )
      .toBe(true);

    await pageB.evaluate(() => {
      (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.begin("align-preview");
    });
    await expect.poll(async () => peerDisplayGapM(pageB), { timeout: 30_000 }).not.toBeNull();

    const alignLog: Array<{ t: number; gap: number | null; speedA: number; speedB: number }> = [];
    const deadline = Date.now() + ALIGN_MS;
    let holdStart: number | null = null;
    let aligned = false;
    let speedA = 5;
    let speedB = 5;

    while (Date.now() < deadline) {
      const gap = await peerDisplayGapM(pageB);
      alignLog.push({ t: Date.now(), gap, speedA, speedB });
      if (gap == null) {
        holdStart = null;
        await pageA.waitForTimeout(350);
        continue;
      }
      const abs = Math.abs(gap);
      if (abs <= 4) {
        if (speedA !== 5) {
          await setSpeedKmh(pageA, 5);
          speedA = 5;
        }
        if (speedB !== 5) {
          await setSpeedKmh(pageB, 5);
          speedB = 5;
        }
        if (holdStart == null) holdStart = Date.now();
        if (Date.now() - holdStart >= 2000) {
          aligned = true;
          break;
        }
      } else {
        holdStart = null;
        let nextA: number;
        let nextB: number;
        if (abs <= 6) {
          nextA = 5;
          nextB = 5;
        } else if (abs <= 15) {
          if (gap > 0) {
            nextA = 5;
            nextB = 10;
          } else {
            nextA = 10;
            nextB = 5;
          }
        } else if (gap > 0) {
          nextA = 5;
          nextB = 18;
        } else {
          nextA = 18;
          nextB = 5;
        }
        if (nextA !== speedA) {
          await setSpeedKmh(pageA, nextA);
          speedA = nextA;
        }
        if (nextB !== speedB) {
          await setSpeedKmh(pageB, nextB);
          speedB = nextB;
        }
      }
      await pageA.waitForTimeout(350);
    }

    await setSpeedKmh(pageA, 5);
    await setSpeedKmh(pageB, 5);
    const gapAtOpen = await peerDisplayGapM(pageB);
    console.log(`[s45] aligned=${aligned} gapAtOpen=${gapAtOpen}`);

    fs.mkdirSync(SHOT_DIR, { recursive: true });

    if (!aligned || gapAtOpen == null || Math.abs(gapAtOpen) > 5) {
      fs.writeFileSync(
        path.join(OUT_DIR, "S45-after-summary.json"),
        JSON.stringify(
          {
            instruction: "S4-5",
            conditionId: CONDITION_ID,
            trailId,
            camera: "leftFlat",
            speedKmh: [5, 5],
            tabState: "both visible",
            aligned: false,
            gapAtOpen,
            alignLog,
            note: "창을 열 조건 |gap|≤5 m 를 못 맞췄다. 판정하지 않음.",
          },
          null,
          2,
        ),
        "utf8",
      );
      return;
    }

    await foldDock(pageA);
    await foldDock(pageB);

    await pageB.evaluate(() => {
      (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.begin("s44r5-scout");
    });
    await pageA.waitForTimeout(SCOUT_MS);
    const scout = (await pageB.evaluate(() => {
      return (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.end();
    })) as JitterDump;
    const scoutPeak = [...scout.judgment.relativeReverses].sort((a, b) => b.magPx - a.magPx)[0] ?? null;
    const scoutOffsetMs =
      scoutPeak != null && scout.windowStartedAt != null ? scoutPeak.atMs - scout.windowStartedAt : 2000;
    const waitToAimMs = Math.max(0, Math.min(8_000, scoutOffsetMs - SHOT_WINDOW_MS / 2));
    await pageA.waitForTimeout(waitToAimMs);

    await pageB.evaluate((id) => {
      (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.begin(id);
    }, CONDITION_ID);

    for (const leftover of fs.readdirSync(SHOT_DIR)) {
      if (/^F\d{3}\.(png|jpg)$/i.test(leftover) || leftover === "clip.json") {
        fs.unlinkSync(path.join(SHOT_DIR, leftover));
      }
    }

    const cdp = await pageB.context().newCDPSession(pageB);
    const raw: Array<{ atMs: number; data: string }> = [];
    cdp.on("Page.screencastFrame", (evt: { data: string; sessionId: number }) => {
      raw.push({ atMs: Date.now(), data: evt.data });
      void cdp.send("Page.screencastFrameAck", { sessionId: evt.sessionId });
    });
    await cdp.send("Page.startScreencast", {
      format: "png",
      everyNthFrame: 1,
      maxWidth: 1280,
      maxHeight: 900,
    });
    await pageB.waitForTimeout(SHOT_WINDOW_MS);
    await cdp.send("Page.stopScreencast");

    const shots: Array<{ i: number; atMs: number; file: string }> = [];
    for (let si = 0; si < raw.length; si += 1) {
      const buf = Buffer.from(raw[si]!.data, "base64");
      const png = buf[0] === 0x89 && buf[1] === 0x50;
      const file = `F${String(si).padStart(3, "0")}.${png ? "png" : "jpg"}`;
      fs.writeFileSync(path.join(SHOT_DIR, file), buf);
      shots.push({ i: si, atMs: raw[si]!.atMs, file });
    }
    console.log(`[s45] pngShots=${shots.length} windowMs=${SHOT_WINDOW_MS} first=${shots[0]?.file ?? null}`);

    const dump = (await pageB.evaluate(() => {
      return (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.end();
    })) as JitterDump;

    const display = dump.events.filter((e) => e.kind === "display" && e.atMs != null);
    const manifest = buildShotManifest(
      shots,
      display.map((e) => ({
        atMs: e.atMs!,
        gapDistM: e.gapDistM ?? null,
        screenX: e.screenX ?? null,
        localScreenX: e.localScreenX ?? null,
      })),
      dump.judgment.cameraSplit.samples,
    );
    const shotMedianDt = medianShotIntervalMs(shots);
    const frameMedianDt = dump.judgment.timing.medianFrameDtMs;
    const peak = [...dump.judgment.relativeReverses].sort((a, b) => b.magPx - a.magPx)[0] ?? null;
    const peakSepMs = peakShotSeparationMs(peak?.atMs, shots);
    const n0 = dump.judgment.gapWindow.allAbsLe5m === true;
    const p1 = shotMedianDt != null && frameMedianDt != null && shotMedianDt <= frameMedianDt;
    const p2 = peakSepMs != null && frameMedianDt != null && peakSepMs <= frameMedianDt;

    const summary = {
      instruction: "S4-5",
      conditionId: CONDITION_ID,
      trailId,
      camera: "leftFlat",
      cameraDistanceM: 40,
      speedKmh: [5, 5],
      tabState: "both visible",
      aligned: true,
      gapAtOpen,
      n0,
      p1,
      p2,
      gapWindow: dump.judgment.gapWindow,
      timing: dump.judgment.timing,
      shotMedianDtMs: shotMedianDt,
      frameMedianDtMs: frameMedianDt,
      shotCount: shots.length,
      peak,
      peakShotSeparationMs: peakSepMs,
      scoutOffsetMs,
      waitToAimMs,
      relativeAlong: dump.judgment.cameraSplit.relativeAlong,
      peerAlong: dump.judgment.cameraSplit.peerAlong,
      localAlong: dump.judgment.cameraSplit.localAlong,
      startGapDistM: dump.judgment.startGapDistM,
      startGapScreenPx: dump.judgment.startGapScreenPx,
      displayFrames: dump.judgment.displayFrames,
      hasLocalScreen: dump.judgment.hasLocalScreen,
      alignHeldMs: 2000,
      shotFormat: "png",
      note: "조건은 R5 와 같다. PNG 무손실·네임태그 포함 페이지만 바꿨다.",
    };

    fs.writeFileSync(
      path.join(OUT_DIR, "S45-after-manifest.json"),
      JSON.stringify(
        {
          instruction: "S4-5",
          shotMedianDtMs: shotMedianDt,
          frameMedianDtMs: frameMedianDt,
          peakShotSeparationMs: peakSepMs,
          shots: manifest,
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(OUT_DIR, "S45-after-capture.json"),
      JSON.stringify({ ...summary, alignLog, scoutPeak, judgment: dump.judgment, events: dump.events }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(OUT_DIR, "S45-after-capture-summary.json"), JSON.stringify(summary, null, 2), "utf8");

    expect(dump.conditionId).toBe(CONDITION_ID);
    expect(dump.judgment.displayFrames).toBeGreaterThan(10);
    expect(dump.judgment.hasLocalScreen).toBe(true);
    expect(shots.length).toBeGreaterThan(8);
    console.log(
      `[s45] p1=${p1} p2=${p2} shotMedianDtMs=${shotMedianDt} frameMedianDtMs=${frameMedianDt} peakSepMs=${peakSepMs}`,
    );
  });
});

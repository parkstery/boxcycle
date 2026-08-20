import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * S4-8 — 2인 캡처 하네스로 peer 슬라이더(정지는 일시정지)를 §1-1 프로파일로 움직인다.
 * 제품 코드·S4-7 실험 코드는 고치지 않는다. S47 산출물을 덮지 않는다.
 *
 * 슬라이더 최솟값은 5 km/h 이라 5→0 은 일시정지로 발행 속도 0 을 만든다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const CONDITION_ID = "s48-realjerk-left-16m";
const ALIGN_MS = 9 * 60 * 1000;
const PROFILE_MS = 40_000;

type JitterApi = {
  begin: (c?: string) => void;
  end: () => {
    windowStartedAt: number | null;
    windowEndedAt: number | null;
    conditionId: string | null;
    events: unknown[];
    judgment: {
      displayFrames: number;
      hasLocalScreen: boolean;
      startGapDistM: number | null;
      gapWindow: {
        minAbsGapDistM: number | null;
        maxAbsGapDistM: number | null;
        allAbsLe5m: boolean;
      };
    };
  };
  lastGap: () => { gapDistM: number | null };
};

test.describe("S4-8 real-jerk capture", () => {
  test.setTimeout(1_200_000);

  test("leftFlat · 16m · peer 프로파일 40s", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.setViewportSize({ width: 1280, height: 900 });
    await pageB.setViewportSize({ width: 1280, height: 900 });

    await pageA.goto("/?rideCam=16&peerSyncLogMs=200");
    await guestStart(pageA);
    await loadIntroCourse(pageA);
    await ensureRiding(pageA);

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 })
      .not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    await Promise.all([
      (async () => {
        await setFollowLeft(pageA);
        await setRideDistanceM(pageA, 16);
        await setSpeedKmh(pageA, 5);
      })(),
      (async () => {
        await pageB.goto(
          `/?trail=${encodeURIComponent(trailId)}&rideCam=16&peerSyncLogMs=200`,
        );
        await guestStart(pageB);
        await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({
          timeout: 45_000,
        });
        await ensureRiding(pageB);
        await setFollowLeft(pageB);
        await setRideDistanceM(pageB, 16);
        await setSpeedKmh(pageB, 5);
      })(),
    ]);

    await expect
      .poll(
        async () =>
          pageB.evaluate(() =>
            Boolean((window as Window & { __rtwPeerJitterApi?: unknown }).__rtwPeerJitterApi),
          ),
        { timeout: 20_000 },
      )
      .toBe(true);

    await pageB.evaluate(() => {
      (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.begin("s48-align");
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

    fs.mkdirSync(OUT_DIR, { recursive: true });
    if (!aligned || gapAtOpen == null || Math.abs(gapAtOpen) > 5) {
      fs.writeFileSync(
        path.join(OUT_DIR, "S48-realjerk-summary.json"),
        JSON.stringify(
          {
            instruction: "S4-8",
            aligned: false,
            gapAtOpen,
            alignLog,
            note: "시작 간격 |gap|≤5 m 를 못 맞췄다. 프로파일 미수행.",
          },
          null,
          2,
        ),
      );
      expect(aligned, "시작 간격 ≤ 5 m").toBe(true);
      return;
    }

    await foldDock(pageA);
    await foldDock(pageB);

    await pageB.evaluate((id) => {
      (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.begin(id);
    }, CONDITION_ID);

    const t0 = Date.now();
    const marks: Array<{ atMs: number; offsetMs: number; action: string }> = [];
    const mark = (action: string) => {
      marks.push({ atMs: Date.now(), offsetMs: Date.now() - t0, action });
    };

    const waitOffset = async (ms: number) => {
      const remain = t0 + ms - Date.now();
      if (remain > 0) await pageA.waitForTimeout(remain);
    };

    mark("profile-start both 5km/h");
    await waitOffset(10_000);

    await pageA.getByRole("button", { name: "일시정지" }).click();
    mark("peer-pause 5→0");
    await waitOffset(13_000);

    await pageA.getByRole("region", { name: "일시정지" }).getByRole("button", { name: "재개" }).click();
    mark("peer-resume 0→5");
    await waitOffset(20_000);

    await setSpeedKmh(pageA, 12);
    await foldDock(pageA);
    mark("peer-slider 5→12");
    await waitOffset(28_000);

    await setSpeedKmh(pageA, 5);
    await foldDock(pageA);
    mark("peer-slider 12→5");
    await waitOffset(PROFILE_MS);
    mark("profile-end");

    const dump = (await pageB.evaluate(() => {
      return (window as Window & { __rtwPeerJitterApi: JitterApi }).__rtwPeerJitterApi.end();
    })) as ReturnType<JitterApi["end"]>;

    const summary = {
      instruction: "S4-8",
      conditionId: CONDITION_ID,
      trailId,
      camera: "leftFlat",
      cameraDistanceM: 16,
      tabState: "both visible",
      aligned: true,
      gapAtOpen,
      localSpeedKmh: 5,
      peerProfile:
        "0-10s 5km/h / 10s pause(5→0) / 10-13s stopped / 13s resume(0→5) / 20s 5→12 / 28s 12→5 / 28-40s 5km/h",
      stopVia: "일시정지 — 슬라이더 최솟값 5 km/h 이라 0 을 넣을 수 없음",
      marks,
      profileElapsedMs: Date.now() - t0,
      startGapDistM: dump.judgment.startGapDistM,
      displayFrames: dump.judgment.displayFrames,
      hasLocalScreen: dump.judgment.hasLocalScreen,
      gapWindow: dump.judgment.gapWindow,
    };

    fs.writeFileSync(
      path.join(OUT_DIR, "S48-realjerk-capture.json"),
      JSON.stringify({ ...summary, alignLog, judgment: dump.judgment, events: dump.events }, null, 2),
    );
    fs.writeFileSync(path.join(OUT_DIR, "S48-realjerk-summary.json"), JSON.stringify(summary, null, 2));

    expect(dump.conditionId).toBe(CONDITION_ID);
    expect(dump.judgment.displayFrames).toBeGreaterThan(100);
    expect(dump.judgment.hasLocalScreen).toBe(true);
    console.log(
      `[s48] gapAtOpen=${gapAtOpen} frames=${dump.judgment.displayFrames} elapsed=${Date.now() - t0}`,
    );
  });
});

async function peerDisplayGapM(page: import("@playwright/test").Page): Promise<number | null> {
  return page.evaluate(() => {
    const api = (window as Window & { __rtwPeerJitterApi?: JitterApi }).__rtwPeerJitterApi;
    if (!api?.lastGap) return null;
    return api.lastGap().gapDistM;
  });
}

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

async function setRideDistanceM(page: import("@playwright/test").Page, m: number) {
  await openMapSheet(page);
  const slider = page.getByRole("slider", { name: /거리 / });
  await slider.fill(String(m));
  await closeMapSheet(page);
}

import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const PHASE = process.env.S42_PHASE === "after" ? "after" : "baseline";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const SHOT_DIR = path.join(OUT_DIR, "S42-shots");

type ReadSnap = {
  atMs?: number;
  totalsAreCumulative?: boolean;
  compareStatesUsing?: string;
  underlying?: {
    rtdbOnValue?: { open: number; openTotal: number; closeTotal: number };
    trailOnSnapshot?: { open: number; openTotal: number; closeTotal: number };
    collectionGroup?: { open: number; openTotal: number; closeTotal: number };
  };
  motionHub?: {
    unsubCallTotal?: number;
    slotCount?: number;
    injectedFanoutHits?: number;
    errorFanoutHits?: number;
  };
  ridesHub?: {
    unsubCallTotal?: number;
    slotCount?: number;
    injectedFanoutHits?: number;
    errorFanoutHits?: number;
  };
  activeLiveRideTrailIdsHub?: {
    unsubCallTotal?: number;
    refCount?: number;
    underlyingOpen?: boolean;
    injectedFanoutHits?: number;
    errorFanoutHits?: number;
  };
  crossCheck?: { ok?: boolean; [k: string]: unknown };
};

async function readSubs(page: Page): Promise<ReadSnap | { unmeasurable: string }> {
  return page.evaluate(() => {
    const w = window as Window & { __rtwReadSubs?: () => ReadSnap };
    if (typeof w.__rtwReadSubs !== "function") {
      return { unmeasurable: "__rtwReadSubs missing" };
    }
    return w.__rtwReadSubs();
  });
}

async function guestStart(page: Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function waitMeters(page: Page) {
  await page.waitForFunction(
    () => typeof (window as Window & { __rtwReadSubs?: unknown }).__rtwReadSubs === "function",
    null,
    { timeout: 20_000 },
  );
}

function pickUnderlying(snap: ReadSnap | { unmeasurable: string }) {
  if ("unmeasurable" in snap) return null;
  return {
    rtdbOnValue: snap.underlying?.rtdbOnValue ?? null,
    trailOnSnapshot: snap.underlying?.trailOnSnapshot ?? null,
    collectionGroup: snap.underlying?.collectionGroup ?? null,
    motionHub: snap.motionHub ?? null,
    ridesHub: snap.ridesHub ?? null,
    activeLiveRideTrailIdsHub: snap.activeLiveRideTrailIdsHub ?? null,
    crossCheck: snap.crossCheck ?? null,
    totalsAreCumulative: snap.totalsAreCumulative ?? true,
    compareStatesUsing: snap.compareStatesUsing ?? "open",
  };
}

test.describe("S4-2 읽기 구독 계측", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행");

  test(`A~F snapshot (${PHASE})`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await guestStart(page);
    await waitMeters(page);
    await page.waitForTimeout(2_000);

    const states: Record<string, unknown> = {};
    const notes: string[] = [];

    states.A = pickUnderlying(await readSubs(page));

    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await expect(page.getByRole("button", { name: "입문" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    states.B = pickUnderlying(await readSubs(page));

    fs.mkdirSync(SHOT_DIR, { recursive: true });
    if (PHASE === "after") {
      await page.screenshot({ path: path.join(SHOT_DIR, "menu-trails.png"), fullPage: false });
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    const globe = page.locator('button[title="지구 전체 보기"], button[aria-label="지구 전체 보기"]');
    if (await globe.count()) {
      await globe.first().click();
      await page.waitForTimeout(2_000);
    } else {
      notes.push("globe control not found — world map via zoom-out skipped");
    }
    states.E = pickUnderlying(await readSubs(page));
    if (PHASE === "after") {
      await page.screenshot({ path: path.join(SHOT_DIR, "world-map.png"), fullPage: false });
    }

    const joinBtn = page.getByRole("button", { name: /합류/ });
    if (await joinBtn.count()) {
      await page.getByRole("button", { name: "Trail 메뉴" }).click();
      await joinBtn.first().click();
      await page.waitForTimeout(2_000);
      notes.push("D: joined a live trail from menu");
    } else {
      notes.push("D: no join button — trailhead spectator overlay only");
    }
    states.D = pickUnderlying(await readSubs(page));
    if (PHASE === "after") {
      await page.screenshot({ path: path.join(SHOT_DIR, "spectator.png"), fullPage: false });
    }

    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await page.getByRole("button", { name: "입문" }).click();
    const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.locator("button.oc-modal__item").first().click();
    const start = page.getByRole("button", { name: "주행 시작" });
    await expect(start).toBeVisible({ timeout: 20_000 });
    await start.click();
    await expect(page.getByRole("group", { name: "주행 지표" })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2_000);
    states.C = pickUnderlying(await readSubs(page));

    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.setWebLifecycleState", { state: "hidden" });
    await page.waitForTimeout(1_500);
    const hidden = pickUnderlying(await readSubs(page));
    await cdp.send("Page.setWebLifecycleState", { state: "visible" });
    await page.waitForTimeout(1_500);
    states.F = {
      hidden,
      visible: pickUnderlying(await readSubs(page)),
    };

    const aCg = (states.A as { collectionGroup?: { open?: number } } | null)?.collectionGroup?.open;
    const cRtdb = (states.C as { rtdbOnValue?: { open?: number } } | null)?.rtdbOnValue?.open;
    const instrumentationAlive = {
      collectionGroupOpenAtA: aCg ?? null,
      rtdbOnValueOpenAtC: cRtdb ?? null,
      metersLive: typeof aCg === "number" && aCg >= 1 && typeof cRtdb === "number" && cRtdb >= 1,
    };

    const payload = {
      instruction: "S4-2",
      mode: PHASE === "after" ? "after-fix" : "baseline-pre-fix",
      capturedAt: new Date().toISOString(),
      totalsAreCumulative: true,
      compareStatesUsing: "open",
      note: "*Total 은 페이지 로드 이후 누적. 상태 비교는 open 게이지.",
      instrumentationAlive,
      notes,
      states,
    };

    const outName = PHASE === "after" ? "S42-read-after.json" : "S42-read-baseline.json";
    fs.writeFileSync(path.join(OUT_DIR, outName), JSON.stringify(payload, null, 2) + "\n");

    expect(instrumentationAlive.collectionGroupOpenAtA, "계측 생존: A에서 collectionGroup.open>=1").toBeGreaterThanOrEqual(1);
    if (PHASE === "baseline") {
      expect(aCg, "section 0-1 duplicate: collectionGroup.open=2").toBe(2);
    } else {
      expect(aCg, "after fix collectionGroup.open=1").toBe(1);
    }
  });
});

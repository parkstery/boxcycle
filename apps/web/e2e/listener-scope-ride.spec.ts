import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dismissRideSummaryIfAny,
  ensureRiding,
  guestStart,
  loadIntroCourse,
} from "./rideEntryHelpers";

/**
 * Task 06/07/15/17 — Emulator proof that listener gates release/reacquire underlying subs,
 * and that DEFAULT_TRAIL residual peer subscriptions are gone after ride end.
 * Meters: window.__rtwReadSubs() → underlying.* + motionHub / ridesHub / activeLiveRideTrailIdsHub.
 *
 * Post-ride contract (Task 17): within 12s, rtdbOnValue.open→0; motionHub/ridesHub have no
 * `default` slot. Non-default trailOnSnapshot may remain (intentional Trailhead world spectator).
 *
 * Hard guard: FIRESTORE_EMULATOR_HOST must be set (firebase emulators:exec).
 * Refuses live Firebase even if RIDE_VERIFY_LIVE=1 is set alone.
 *
 * Run: npm run test:e2e:listener-scope  (set RTW_DEV_PORT=5015)
 */

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
const UNDER_EMULATOR = Boolean(EMULATOR_HOST);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/firebase-traffic");
/** Bounded wait for post-ride default-Trail residual cleanup (task: 10–15s). */
const POST_RIDE_PEER_CLOSE_TIMEOUT_MS = 12_000;
const DEFAULT_TRAIL_ID = "default";

type UnderlyingMeter = { open: number; openTotal: number; closeTotal: number };
type HubSlot = {
  trailId?: string;
  refCount?: number;
  underlyingOpen?: boolean;
  consumers?: number;
};
type HubSnap = {
  unsubCallTotal?: number;
  slotCount?: number;
  slots?: HubSlot[];
  refCount?: number;
  underlyingOpen?: boolean;
  injectedFanoutHits?: number;
  errorFanoutHits?: number;
};
type ReadSnap = {
  atMs?: number;
  underlying?: {
    rtdbOnValue?: UnderlyingMeter;
    trailOnSnapshot?: UnderlyingMeter;
    collectionGroup?: UnderlyingMeter;
  };
  motionHub?: HubSnap;
  ridesHub?: HubSnap;
  activeLiveRideTrailIdsHub?: HubSnap;
  crossCheck?: { ok?: boolean; [k: string]: unknown };
};

type StateMeter = {
  collectionGroupOpen: number | null;
  trailOnSnapshotOpen: number | null;
  rtdbOnValueOpen: number | null;
  atMs: number | null;
  motionHub?: HubSnap | null;
  ridesHub?: HubSnap | null;
  activeLiveRideTrailIdsHub?: HubSnap | null;
  underlyingDetail?: {
    rtdbOnValue?: UnderlyingMeter | null;
    trailOnSnapshot?: UnderlyingMeter | null;
    collectionGroup?: UnderlyingMeter | null;
  };
};

function assertEmulatorHostOnly(): void {
  if (!EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST missing — refuse live Firebase. Use firebase emulators:exec.",
    );
  }
  const host = EMULATOR_HOST.toLowerCase();
  const local =
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost") ||
    host.startsWith("[::1]");
  if (!local) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST=${EMULATOR_HOST} is not a local emulator — abort.`,
    );
  }
}

async function waitMeters(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as Window & { __rtwReadSubs?: unknown }).__rtwReadSubs === "function",
    null,
    { timeout: 30_000 },
  );
}

async function readSubs(page: Page): Promise<ReadSnap | { unmeasurable: string }> {
  return page.evaluate(() => {
    const w = window as Window & { __rtwReadSubs?: () => ReadSnap };
    if (typeof w.__rtwReadSubs !== "function") {
      return { unmeasurable: "__rtwReadSubs missing" };
    }
    return w.__rtwReadSubs();
  });
}

async function readStateMeter(page: Page): Promise<StateMeter> {
  const snap = await readSubs(page);
  if ("unmeasurable" in snap) {
    return {
      collectionGroupOpen: null,
      trailOnSnapshotOpen: null,
      rtdbOnValueOpen: null,
      atMs: null,
      motionHub: null,
      ridesHub: null,
      activeLiveRideTrailIdsHub: null,
      underlyingDetail: undefined,
    };
  }
  return {
    collectionGroupOpen: snap.underlying?.collectionGroup?.open ?? null,
    trailOnSnapshotOpen: snap.underlying?.trailOnSnapshot?.open ?? null,
    rtdbOnValueOpen: snap.underlying?.rtdbOnValue?.open ?? null,
    atMs: snap.atMs ?? null,
    motionHub: snap.motionHub ?? null,
    ridesHub: snap.ridesHub ?? null,
    activeLiveRideTrailIdsHub: snap.activeLiveRideTrailIdsHub ?? null,
    underlyingDetail: {
      rtdbOnValue: snap.underlying?.rtdbOnValue ?? null,
      trailOnSnapshot: snap.underlying?.trailOnSnapshot ?? null,
      collectionGroup: snap.underlying?.collectionGroup ?? null,
    },
  };
}

async function pollCgOpen(page: Page, expected: number, label: string): Promise<StateMeter> {
  let last: StateMeter = {
    collectionGroupOpen: null,
    trailOnSnapshotOpen: null,
    rtdbOnValueOpen: null,
    atMs: null,
  };
  await expect
    .poll(
      async () => {
        last = await readStateMeter(page);
        return last.collectionGroupOpen;
      },
      { timeout: 45_000, message: `${label}: collectionGroup.open → ${expected}` },
    )
    .toBe(expected);
  return last;
}

function hubHasTrailSlot(hub: HubSnap | null | undefined, trailId: string): boolean {
  return (hub?.slots ?? []).some((s) => s.trailId === trailId);
}

/**
 * Poll until DEFAULT_TRAIL residual peer subs are gone:
 * rtdbOnValue.open→0, motionHub/ridesHub have no `default` slot.
 * trailOnSnapshot total is recorded but not required to be 0 (world spectator ok).
 */
async function pollDefaultTrailPeerSubsCleared(
  page: Page,
  label: string,
): Promise<{ settled: StateMeter; cleared: boolean }> {
  let last = await readStateMeter(page);
  try {
    await expect
      .poll(
        async () => {
          last = await readStateMeter(page);
          return {
            rtdb: last.rtdbOnValueOpen,
            motionHasDefault: hubHasTrailSlot(last.motionHub, DEFAULT_TRAIL_ID),
            ridesHasDefault: hubHasTrailSlot(last.ridesHub, DEFAULT_TRAIL_ID),
          };
        },
        {
          timeout: POST_RIDE_PEER_CLOSE_TIMEOUT_MS,
          message: `${label}: rtdbOnValue.open→0 and no default hub slots within ${POST_RIDE_PEER_CLOSE_TIMEOUT_MS}ms`,
        },
      )
      .toEqual({ rtdb: 0, motionHasDefault: false, ridesHasDefault: false });
    return { settled: last, cleared: true };
  } catch {
    return { settled: last, cleared: false };
  }
}

async function endRide(page: Page): Promise<void> {
  const end = page.getByRole("button", { name: "주행 종료" });
  await expect(end).toBeVisible({ timeout: 15_000 });
  await end.click();
  await dismissRideSummaryIfAny(page);
}

/** Menu uses transform off-screen — Playwright isVisible stays true when closed. */
function menuOpenRoot(page: Page) {
  return page.locator(".menu-panel-root.is-open");
}

async function openTrailMenu(page: Page): Promise<void> {
  if ((await menuOpenRoot(page).count()) === 0) {
    await page.getByRole("button", { name: "Trail 메뉴" }).click();
  }
  await expect(menuOpenRoot(page)).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "입문" })).toBeVisible({ timeout: 15_000 });
}

async function closeTrailMenu(page: Page): Promise<void> {
  if ((await menuOpenRoot(page).count()) === 0) return;
  await page.getByRole("button", { name: "메뉴 닫기" }).first().click();
  await expect(menuOpenRoot(page)).toHaveCount(0, { timeout: 10_000 });
}

test.describe("listener-scope ride release/reacquire (emulator)", () => {
  test.skip(!UNDER_EMULATOR, "Firebase emulator required — npm run test:e2e:listener-scope");

  test("CG release mid-ride, reacquire on menu, restore on end", async ({ page }) => {
    assertEmulatorHostOnly();
    test.setTimeout(180_000);

    const consoleWarnings: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        consoleWarnings.push(`[${msg.type()}] ${msg.text().slice(0, 240)}`);
      }
    });

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const states: Record<string, StateMeter & { note?: string }> = {};
    const notes: string[] = [];

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await guestStart(page);
    await waitMeters(page);

    // 1) Trailhead idle — discovery CG open
    states.trailheadIdle = await pollCgOpen(page, 1, "trailheadIdle");
    notes.push(`emulatorHost=${EMULATOR_HOST}`);

    // 2) Intro ride, menu closed → CG released; current-Trail peer hub remains
    await loadIntroCourse(page, { pick: "first" });
    await ensureRiding(page);
    await closeTrailMenu(page);

    states.rideMenuClosed = await pollCgOpen(page, 0, "rideMenuClosed");
    expect(
      states.rideMenuClosed.trailOnSnapshotOpen,
      "current-Trail peer listener (trailOnSnapshot) should remain open",
    ).toBeGreaterThanOrEqual(1);
    if (
      states.rideMenuClosed.rtdbOnValueOpen != null &&
      states.rideMenuClosed.rtdbOnValueOpen >= 1
    ) {
      notes.push(`rtdbOnValue.open=${states.rideMenuClosed.rtdbOnValueOpen} (available)`);
    } else {
      notes.push("rtdbOnValue open not asserted (solo / unavailable)");
    }

    // 3) Mid-ride menu open → CG reacquire + menu UI
    await openTrailMenu(page);
    states.rideMenuOpen = await pollCgOpen(page, 1, "rideMenuOpen");
    await expect(menuOpenRoot(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "입문" })).toBeVisible();

    // 4) Close menu → CG release again
    await closeTrailMenu(page);
    states.rideMenuClosedAgain = await pollCgOpen(page, 0, "rideMenuClosedAgain");

    // 5) End ride → idle discovery CG; DEFAULT_TRAIL residual peer subs must clear
    await endRide(page);
    const afterEndImmediate = await readStateMeter(page);
    states.afterEndRideImmediate = {
      ...afterEndImmediate,
      note: "sample right after endRide click + summary dismiss (no poll)",
    };

    let endStepApplicable = true;
    try {
      states.afterEndRide = await pollCgOpen(page, 1, "afterEndRide");
    } catch (err) {
      endStepApplicable = false;
      states.afterEndRide = {
        ...(await readStateMeter(page)),
        note: `last step not applicable: ${err instanceof Error ? err.message : String(err)}`,
      };
      notes.push(
        "afterEndRide CG.open=1 not observed — report first four states; Trailhead may have left idle discovery",
      );
    }

    const peerClear = await pollDefaultTrailPeerSubsCleared(page, "afterEndRideDefaultTrailClear");
    const settledMotionSlots = (peerClear.settled.motionHub?.slots ?? []).map((s) => s.trailId);
    const settledRidesSlots = (peerClear.settled.ridesHub?.slots ?? []).map((s) => s.trailId);
    states.afterEndRideSettled = {
      ...peerClear.settled,
      note: peerClear.cleared
        ? `default-Trail residual cleared within ${POST_RIDE_PEER_CLOSE_TIMEOUT_MS}ms (trailOnSnapshot.open=${peerClear.settled.trailOnSnapshotOpen} may remain for world spectator)`
        : `DEFAULT_TRAIL_RESIDUAL_STILL_OPEN after ${POST_RIDE_PEER_CLOSE_TIMEOUT_MS}ms`,
    };
    notes.push(
      `afterEndImmediate trail=${afterEndImmediate.trailOnSnapshotOpen} rtdb=${afterEndImmediate.rtdbOnValueOpen}`,
    );
    notes.push(
      `afterEndSettled trail=${peerClear.settled.trailOnSnapshotOpen} rtdb=${peerClear.settled.rtdbOnValueOpen} cleared=${peerClear.cleared} motionSlots=[${settledMotionSlots.join(",")}] ridesSlots=[${settledRidesSlots.join(",")}]`,
    );

    const payload = {
      instruction: "17-task-default-trail-subscription",
      capturedAt: new Date().toISOString(),
      emulatorHost: EMULATOR_HOST,
      compareStatesUsing: "open",
      postRidePeerCloseTimeoutMs: POST_RIDE_PEER_CLOSE_TIMEOUT_MS,
      endStepApplicable,
      defaultTrailResidualCleared: peerClear.cleared,
      peerListenersSettledClosed: peerClear.cleared,
      notes,
      states,
      consoleWarningsSample: consoleWarnings.slice(0, 20),
      consoleWarningCount: consoleWarnings.length,
    };
    const outPath = path.join(OUT_DIR, "listener-scope-ride.json");
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");

    // First four states are required regardless of end-step applicability
    expect(states.trailheadIdle.collectionGroupOpen).toBe(1);
    expect(states.rideMenuClosed.collectionGroupOpen).toBe(0);
    expect(states.rideMenuOpen.collectionGroupOpen).toBe(1);
    expect(states.rideMenuClosedAgain.collectionGroupOpen).toBe(0);
    if (endStepApplicable) {
      expect(states.afterEndRide.collectionGroupOpen).toBe(1);
    }

    // Task 17 contract: RTDB closed + no default hub slots; trailOnSnapshot may remain non-zero.
    expect(
      peerClear.cleared,
      [
        "post-ride DEFAULT_TRAIL residual peer subs did not clear within timeout.",
        `immediate trailOnSnapshot.open=${afterEndImmediate.trailOnSnapshotOpen} rtdbOnValue.open=${afterEndImmediate.rtdbOnValueOpen}`,
        `settled trailOnSnapshot.open=${peerClear.settled.trailOnSnapshotOpen} rtdbOnValue.open=${peerClear.settled.rtdbOnValueOpen}`,
        `motionHub.slots=[${settledMotionSlots.join(",")}]`,
        `ridesHub.slots=[${settledRidesSlots.join(",")}]`,
        "See apps/web/.out/firebase-traffic/listener-scope-ride.json",
      ].join(" "),
    ).toBe(true);
    expect(peerClear.settled.rtdbOnValueOpen).toBe(0);
    expect(hubHasTrailSlot(peerClear.settled.motionHub, DEFAULT_TRAIL_ID)).toBe(false);
    expect(hubHasTrailSlot(peerClear.settled.ridesHub, DEFAULT_TRAIL_ID)).toBe(false);
  });
});

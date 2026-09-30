import { test, expect, type Page, type Browser } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureRiding, guestStart, loadIntroCourse, setSpeedKmh } from "./rideEntryHelpers";
import { hostFor } from "../../../scripts/emulatorPorts.mjs";
import {
  computePairedCapturePlan,
  evaluatePairedCaptureTiming,
  type PairedCapturePlan,
  type PairedCaptureState,
  type PairedCaptureTimingTolerances,
} from "../src/lib/debug/trafficPairedCapture";

/**
 * TASK-28C / TASK-31B-R — controlled 1-rider vs 2-rider traffic meters (emulator only).
 *
 * Protocol:
 *  - Quiet setup + short settle, then arm in-page paired meter captures at a shared
 *    absolute start/end deadline (resetAtStart → generation ticket at start snap).
 *  - Retrieve armed snapshots AFTER the end deadline so CDP latency cannot extend
 *    or contaminate the metric window.
 *  - Enforce per-page duration ≈ MEASURE_MS (± tight tol) and dual cross-page align.
 *  - Timer skew beyond tol → FAIL (diagnose load), do not loosen slack.
 *  - Solo Stop → assert liveRide cleared → close context before dual.
 *  - Max 2 guests. No product cadence changes.
 *
 * Hard guard: local Auth / Firestore / RTDB / Functions emulators required.
 */

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
const AUTH_EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim() ?? "";
const RTDB_EMU =
  process.env.FIREBASE_DATABASE_EMULATOR_HOST?.trim() ??
  process.env.FIREBASE_RTDB_EMULATOR_HOST?.trim() ??
  "";
const FUNCTIONS_EMU =
  process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST?.trim() ||
  (process.env.RTW_E2E_WITH_FUNCTIONS === "1" && EMULATOR_HOST ? hostFor("functions") : "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/firebase-traffic");
const PHASE_JSONL = path.join(OUT_DIR, "public-trail-traffic-1-2-phases.jsonl");
const RESULT_JSON = path.join(OUT_DIR, "public-trail-traffic-1-2.json");
/** Bounded ride integral — keep short so dual+solo finish under deadline. */
const MEASURE_MS = Number(process.env.RTW_TRAFFIC_MEASURE_MS ?? 45_000);
/** Short quiet after setup so join/create bursts drain before arm. */
const SETTLE_MS = Number(process.env.RTW_TRAFFIC_SETTLE_MS ?? 3_000);
/** Lead so CDP arm on both pages finishes before shared start deadline. */
const ARM_LEAD_MS = Number(process.env.RTW_TRAFFIC_ARM_LEAD_MS ?? 800);
/** Tight: actual capture duration vs MEASURE_MS. */
const DURATION_TOL_MS = Number(process.env.RTW_TRAFFIC_DURATION_TOL_MS ?? 300);
/** Tight: in-page timer skew vs scheduled absolute deadline. */
const SKEW_TOL_MS = Number(process.env.RTW_TRAFFIC_SKEW_TOL_MS ?? 250);
/** Tight: cross-page capture alignment. */
const ALIGN_TOL_MS = Number(process.env.RTW_TRAFFIC_ALIGN_TOL_MS ?? 250);
/** Wait past end before CDP retrieve (does not affect metric window). */
const RETRIEVE_BUFFER_MS = Number(process.env.RTW_TRAFFIC_RETRIEVE_BUFFER_MS ?? 150);
const ROUTE_PICK = "longest" as const;
const WALL_MS = 10 * 60_000;

const TIMING_TOL: PairedCaptureTimingTolerances = {
  durationTolMs: DURATION_TOL_MS,
  skewTolMs: SKEW_TOL_MS,
  alignTolMs: ALIGN_TOL_MS,
};

type TrafficSnap = {
  source: string;
  atMs: number;
  livePublicationRideWriteAttempts: number;
  livePublicationRideWrites: number;
  livePublicationRideWriteErrors: number;
  rtdbMotionWriteAttempts: number;
  rtdbMotionWrites: number;
  rtdbMotionWriteErrors: number;
  rtdbMotionWriteBytesApprox: number;
  /** Hub onSnapshot callbacks — NOT billed Firestore reads. */
  fsLiveRideUnderlyingDeliveries: number;
  /** Sum of snap.docChanges().length — NOT billed document reads. */
  fsLiveRideUnderlyingDocChanges: number;
  /** Hub onValue callbacks — NOT billed RTDB downloads. */
  rtdbMotionUnderlyingDeliveries: number;
};

type ReadSubsSnap = Record<string, unknown>;

function isLocalHost(raw: string): boolean {
  const host = raw.toLowerCase();
  return (
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost") ||
    host.startsWith("[::1]")
  );
}

function assertEmulatorHostOnly(): void {
  if (!EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST missing — refuse live Firebase. Use firebase emulators:exec.",
    );
  }
  if (!isLocalHost(EMULATOR_HOST)) {
    throw new Error(`FIRESTORE_EMULATOR_HOST=${EMULATOR_HOST} is not a local emulator — abort.`);
  }
  if (!AUTH_EMU || !isLocalHost(AUTH_EMU)) {
    throw new Error(
      `FIREBASE_AUTH_EMULATOR_HOST missing/non-local (${AUTH_EMU || "unset"}) — refuse live Auth.`,
    );
  }
  if (!RTDB_EMU || !isLocalHost(RTDB_EMU)) {
    throw new Error(
      `FIREBASE_DATABASE_EMULATOR_HOST missing/non-local (${RTDB_EMU || "unset"}) — refuse live RTDB.`,
    );
  }
  if (!FUNCTIONS_EMU || !isLocalHost(FUNCTIONS_EMU)) {
    throw new Error(
      `FIREBASE_FUNCTIONS_EMULATOR_HOST missing/non-local (${FUNCTIONS_EMU || "unset"}) — refuse live Functions.`,
    );
  }
}

type PhaseEvent = "start" | "ok" | "fail" | "mark";

function appendPhaseRow(row: Record<string, unknown>): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(PHASE_JSONL, `${JSON.stringify(row)}\n`, "utf8");
}

function createPhaseLogger(sessionId: string) {
  return (phase: string, event: PhaseEvent, extra?: Record<string, unknown>) => {
    const row = {
      task: "TASK-31B-R",
      sessionId,
      phase,
      event,
      atMs: Date.now(),
      iso: new Date().toISOString(),
      ...extra,
    };
    console.log(`[TASK-31B-R] ${event.toUpperCase()} ${phase}${extra?.detail ? ` — ${extra.detail}` : ""}`);
    appendPhaseRow(row);
  };
}

async function waitTrafficApi(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            typeof (window as Window & { __rtwTrafficMeters?: unknown }).__rtwTrafficMeters ===
              "function" &&
            typeof (
              window as Window & {
                __rtwTrafficMetersApi?: { armPairedCapture?: unknown; getPairedCapture?: unknown };
              }
            ).__rtwTrafficMetersApi?.armPairedCapture === "function" &&
            typeof (
              window as Window & {
                __rtwTrafficMetersApi?: { getPairedCapture?: unknown };
              }
            ).__rtwTrafficMetersApi?.getPairedCapture === "function",
        ),
      { timeout: 30_000, message: "__rtwTrafficMetersApi.armPairedCapture missing (DEV install?)" },
    )
    .toBe(true);
}

async function pageNowMs(page: Page): Promise<number> {
  return page.evaluate(() => Date.now());
}

async function armPairedCaptureOnPage(page: Page, plan: PairedCapturePlan): Promise<void> {
  await waitTrafficApi(page);
  const armedBeforeStart = await page.evaluate((p) => {
    const api = (
      window as Window & {
        __rtwTrafficMetersApi?: {
          armPairedCapture: (plan: PairedCapturePlan) => unknown;
        };
      }
    ).__rtwTrafficMetersApi;
    if (!api?.armPairedCapture) throw new Error("__rtwTrafficMetersApi.armPairedCapture missing");
    const now = Date.now();
    if (now >= p.startAtMs) {
      return { ok: false as const, now, startAtMs: p.startAtMs };
    }
    api.armPairedCapture(p);
    return { ok: true as const, now, startAtMs: p.startAtMs };
  }, plan);
  if (!armedBeforeStart.ok) {
    throw new Error(
      `armPairedCapture missed start deadline (now=${armedBeforeStart.now} >= start=${armedBeforeStart.startAtMs}); increase ARM_LEAD_MS`,
    );
  }
}

async function getPairedCaptureFromPage(page: Page): Promise<PairedCaptureState | null> {
  await waitTrafficApi(page);
  return page.evaluate(() => {
    const api = (
      window as Window & {
        __rtwTrafficMetersApi?: { getPairedCapture: () => PairedCaptureState | null };
      }
    ).__rtwTrafficMetersApi;
    if (!api?.getPairedCapture) throw new Error("__rtwTrafficMetersApi.getPairedCapture missing");
    return api.getPairedCapture();
  });
}

/** Wait until after shared end deadline (wall), then CDP-retrieve armed snaps. */
async function waitPastCaptureEnd(page: Page, plan: PairedCapturePlan): Promise<void> {
  const waitMs = Math.max(0, plan.endAtMs - Date.now()) + RETRIEVE_BUFFER_MS;
  await page.waitForTimeout(waitMs);
}

async function retrievePairedCapture(page: Page, label: string): Promise<PairedCaptureState> {
  await expect
    .poll(
      async () => {
        const state = await getPairedCaptureFromPage(page);
        return state?.status === "complete" && Boolean(state.start) && Boolean(state.end);
      },
      {
        timeout: 10_000,
        message: `${label}: in-page paired capture did not complete after end deadline (timer miss / page load?)`,
      },
    )
    .toBe(true);
  const state = await getPairedCaptureFromPage(page);
  if (!state || state.status !== "complete" || !state.start || !state.end) {
    throw new Error(`${label}: paired capture incomplete after poll`);
  }
  return state;
}

function assertPairedTiming(
  state: PairedCaptureState,
  label: string,
  peer?: PairedCaptureState | null,
): number {
  const verdict = evaluatePairedCaptureTiming(state, TIMING_TOL, peer);
  if (!verdict.ok) {
    const diag = verdict.reasons.join("; ");
    throw new Error(
      `${label}: paired capture timing FAIL — ${diag}. ` +
        `Do not loosen slack; diagnose page load / main-thread starvation.`,
    );
  }
  expect(verdict.actualDurationMs).not.toBeNull();
  return verdict.actualDurationMs!;
}

async function readSubs(page: Page): Promise<ReadSubsSnap | { unmeasurable: string }> {
  const ready = await page.evaluate(
    () => typeof (window as Window & { __rtwReadSubs?: unknown }).__rtwReadSubs === "function",
  );
  if (!ready) return { unmeasurable: "__rtwReadSubs missing" };
  return page.evaluate(() => {
    const fn = (window as Window & { __rtwReadSubs?: () => ReadSubsSnap }).__rtwReadSubs!;
    return fn();
  });
}

async function waitLiveRideProbe(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => typeof (window as Window & { __rtwLiveRideExists?: unknown }).__rtwLiveRideExists === "function",
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
}

async function liveRideExists(page: Page, trailId: string, uid: string): Promise<boolean> {
  await waitLiveRideProbe(page);
  return page.evaluate(
    async ({ tid, id }) => {
      const fn = (window as Window & { __rtwLiveRideExists?: (t: string, u: string) => Promise<boolean> })
        .__rtwLiveRideExists;
      if (!fn) throw new Error("__rtwLiveRideExists missing");
      return fn(tid, id);
    },
    { tid: trailId, id: uid },
  );
}

async function resolveUid(page: Page): Promise<string> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as Window & { __rtwLastRouteUid?: string | null }).__rtwLastRouteUid ?? null),
      { timeout: 30_000, message: "__rtwLastRouteUid not set" },
    )
    .not.toBeNull();
  return page.evaluate(() => (window as Window & { __rtwLastRouteUid?: string }).__rtwLastRouteUid!);
}

async function expandRouteDockIfNeeded(page: Page): Promise<void> {
  const expand = page.getByRole("button", { name: /^경로 패널 펼치기/ });
  if (await expand.isVisible().catch(() => false)) {
    await expand.click({ timeout: 10_000 });
  }
}

/**
 * Click Stop only. Summary-sheet close is NOT required to prove live-ride cleanup.
 */
async function clickStopRide(page: Page): Promise<void> {
  await expandRouteDockIfNeeded(page);
  const end = page.getByRole("button", { name: "주행 종료" });
  await expect(end).toBeEnabled({ timeout: 15_000 });
  await end.click();
}

async function assertLiveRideCleared(
  page: Page,
  trailId: string,
  uid: string,
  label: string,
): Promise<void> {
  await expect
    .poll(async () => liveRideExists(page, trailId, uid), {
      timeout: 45_000,
      message: `${label}: livePublicationRides doc must clear after Stop`,
    })
    .toBe(false);
}

async function bootSoloRiding(page: Page): Promise<{
  trailId: string;
  uid: string;
  selectedKm: number | null;
  routePick: typeof ROUTE_PICK;
}> {
  await page.goto("/?peerSyncLogMs=200");
  await guestStart(page);
  const { selectedKm } = await loadIntroCourse(page, { pick: ROUTE_PICK });
  await ensureRiding(page);
  await setSpeedKmh(page, 12);
  const trailId = new URL(page.url()).searchParams.get("trail");
  if (!trailId) throw new Error("solo missing ?trail=");
  const uid = await resolveUid(page);
  await expect
    .poll(async () => liveRideExists(page, trailId, uid), {
      timeout: 45_000,
      message: "solo livePublicationRides missing",
    })
    .toBe(true);
  return { trailId, uid, selectedKm, routePick: ROUTE_PICK };
}

async function bootDualRiding(
  browser: Browser,
): Promise<{
  pageA: Page;
  pageB: Page;
  trailId: string;
  uidA: string;
  uidB: string;
  selectedKm: number | null;
  routePick: typeof ROUTE_PICK;
}> {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/?peerSyncLogMs=200");
  await guestStart(pageA);
  const { selectedKm } = await loadIntroCourse(pageA, { pick: ROUTE_PICK });
  await ensureRiding(pageA);
  await setSpeedKmh(pageA, 12);
  await expect
    .poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 })
    .not.toBeNull();
  const trailId = new URL(pageA.url()).searchParams.get("trail")!;
  const uidA = await resolveUid(pageA);

  await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`);
  await guestStart(pageB);
  await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
  await ensureRiding(pageB);
  await setSpeedKmh(pageB, 12);
  const uidB = await resolveUid(pageB);

  await expect
    .poll(async () => liveRideExists(pageA, trailId, uidA), { timeout: 45_000 })
    .toBe(true);
  await expect
    .poll(async () => liveRideExists(pageB, trailId, uidB), { timeout: 45_000 })
    .toBe(true);
  await expect
    .poll(async () => liveRideExists(pageA, trailId, uidB), {
      timeout: 60_000,
      message: "A must see B live-ride (companion FS visible)",
    })
    .toBe(true);

  return { pageA, pageB, trailId, uidA, uidB, selectedKm, routePick: ROUTE_PICK };
}

function deltaTraffic(start: TrafficSnap, end: TrafficSnap): Record<string, number> {
  return {
    livePublicationRideWriteAttempts:
      end.livePublicationRideWriteAttempts - start.livePublicationRideWriteAttempts,
    livePublicationRideWrites: end.livePublicationRideWrites - start.livePublicationRideWrites,
    livePublicationRideWriteErrors:
      end.livePublicationRideWriteErrors - start.livePublicationRideWriteErrors,
    rtdbMotionWriteAttempts: end.rtdbMotionWriteAttempts - start.rtdbMotionWriteAttempts,
    rtdbMotionWrites: end.rtdbMotionWrites - start.rtdbMotionWrites,
    rtdbMotionWriteErrors: end.rtdbMotionWriteErrors - start.rtdbMotionWriteErrors,
    rtdbMotionWriteBytesApprox: end.rtdbMotionWriteBytesApprox - start.rtdbMotionWriteBytesApprox,
    fsLiveRideUnderlyingDeliveries:
      end.fsLiveRideUnderlyingDeliveries - start.fsLiveRideUnderlyingDeliveries,
    fsLiveRideUnderlyingDocChanges:
      end.fsLiveRideUnderlyingDocChanges - start.fsLiveRideUnderlyingDocChanges,
    rtdbMotionUnderlyingDeliveries:
      end.rtdbMotionUnderlyingDeliveries - start.rtdbMotionUnderlyingDeliveries,
  };
}

function sumClientDeltas(parts: Array<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of parts) {
    for (const [k, v] of Object.entries(part)) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

function measureMetaFromCapture(state: PairedCaptureState, durationMs: number) {
  const startCap = state.start!;
  const endCap = state.end!;
  return {
    startIso: new Date(startCap.capturedAtMs).toISOString(),
    endIso: new Date(endCap.capturedAtMs).toISOString(),
    startMs: startCap.capturedAtMs,
    endMs: endCap.capturedAtMs,
    durationMs,
    requestedMs: MEASURE_MS,
    scheduledStartAtMs: state.plan.startAtMs,
    scheduledEndAtMs: state.plan.endAtMs,
    startTimerSkewMs: startCap.timerSkewMs,
    endTimerSkewMs: endCap.timerSkewMs,
    captureMode: "in_page_paired_absolute_deadline",
    durationTolMs: DURATION_TOL_MS,
    skewTolMs: SKEW_TOL_MS,
    alignTolMs: ALIGN_TOL_MS,
    durationOk: Math.abs(durationMs - MEASURE_MS) <= DURATION_TOL_MS,
    resetAtStart: state.plan.resetAtStart,
  };
}

test.describe("public-trail traffic 1 vs 2 (emulator meters)", () => {
  test.skip(!EMULATOR_HOST, "Firebase emulator required");
  test.setTimeout(WALL_MS);

  test("solo then dual same-duration measure window", async ({ browser }, testInfo) => {
    assertEmulatorHostOnly();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    if (fs.existsSync(PHASE_JSONL)) fs.unlinkSync(PHASE_JSONL);

    const suiteStartedAtMs = Date.now();
    const sessionId = `t31br-${suiteStartedAtMs.toString(36)}`;
    const log = createPhaseLogger(sessionId);
    const payload: Record<string, unknown> = {
      task: "TASK-31B-R",
      sessionId,
      measureMs: MEASURE_MS,
      settleMs: SETTLE_MS,
      armLeadMs: ARM_LEAD_MS,
      durationTolMs: DURATION_TOL_MS,
      skewTolMs: SKEW_TOL_MS,
      alignTolMs: ALIGN_TOL_MS,
      routePick: ROUTE_PICK,
      suiteStartedAtMs,
      suiteStartedIso: new Date(suiteStartedAtMs).toISOString(),
      captureProtocol:
        "in-page armPairedCapture at shared absolute start/end; resetAtStart; CDP retrieve after end",
      emulator: {
        firestore: EMULATOR_HOST,
        auth: AUTH_EMU,
        rtdb: RTDB_EMU,
        functions: FUNCTIONS_EMU,
      },
      caveats: [
        "Emulator counts ≠ billed production Firestore reads/writes or Functions invocations.",
        "rtdbMotionWriteBytesApprox = UTF-8 JSON of client payload only (no RTDB wire framing).",
        "fsLiveRideUnderlyingDeliveries / rtdbMotionUnderlyingDeliveries = hub callbacks, NOT billed reads/downloads.",
        "fsLiveRideUnderlyingDocChanges = sum of snap.docChanges().length, NOT billed document reads.",
        "Write attempts/success are client-side setDoc/set call meters, NOT billed writes.",
        "Functions invocations (if present) are whole emulators:exec run only — see top-level functionsInvocationsWholeRun; not solo/dual window-attributed.",
        "Metric window = in-page capture timestamps; post-window CDP reads must not extend counters.",
      ],
      peerStaleMs: 15_000,
      fsRole:
        "livePublicationRides is companion interpolation fallback when RTDB motion fails; PEER_LIVE_RIDE_STALE_MS=15s",
      meterFieldNotes: {
        livePublicationRideWriteAttempts: "setDoc call starts (client)",
        livePublicationRideWrites: "setDoc successes (client)",
        fsLiveRideUnderlyingDeliveries: "hub onSnapshot callbacks ≠ billed reads",
        fsLiveRideUnderlyingDocChanges: "docChanges lengths ≠ billed reads",
        rtdbMotionUnderlyingDeliveries: "hub onValue callbacks ≠ billed downloads",
      },
    };

    const writePartial = () => {
      fs.writeFileSync(RESULT_JSON, JSON.stringify(payload, null, 2), "utf8");
    };

    log("suite", "start", {
      detail: `measureMs=${MEASURE_MS} settleMs=${SETTLE_MS} durationTol=${DURATION_TOL_MS} skewTol=${SKEW_TOL_MS}`,
    });

    // --- SOLO ---
    const soloCtx = await browser.newContext();
    const soloPage = await soloCtx.newPage();
    let soloClientDelta: Record<string, number> | undefined;
    try {
      log("solo_setup", "start");
      const soloBoot = await bootSoloRiding(soloPage);
      log("solo_setup", "ok", {
        trailId: soloBoot.trailId,
        uidPrefix: soloBoot.uid.slice(0, 6),
        selectedKm: soloBoot.selectedKm,
        routePick: soloBoot.routePick,
      });

      log("solo_settle", "start", { detail: `wait ${SETTLE_MS}ms before arm` });
      await soloPage.waitForTimeout(SETTLE_MS);
      log("solo_settle", "ok");
      log("solo_setup_end", "mark", { detail: "quiet setup+settle complete — arm paired capture next" });

      const soloNow = await pageNowMs(soloPage);
      const soloPlan = computePairedCapturePlan(soloNow, MEASURE_MS, ARM_LEAD_MS, true);
      await armPairedCaptureOnPage(soloPage, soloPlan);
      log("solo_measure_arm", "mark", {
        plan: soloPlan,
        pageNowMs: soloNow,
      });

      await waitPastCaptureEnd(soloPage, soloPlan);
      const soloCapture = await retrievePairedCapture(soloPage, "solo");
      const soloDurationMs = assertPairedTiming(soloCapture, "solo");
      const soloTrafficStart = soloCapture.start!.snap as TrafficSnap;
      const soloTrafficEnd = soloCapture.end!.snap as TrafficSnap;
      // Listener scope after window — CDP latency must not affect meter snaps.
      const soloSubsMid = await readSubs(soloPage);
      log("solo_measure_end", "mark", {
        durationMs: soloDurationMs,
        capture: {
          startCapturedAtMs: soloCapture.start!.capturedAtMs,
          endCapturedAtMs: soloCapture.end!.capturedAtMs,
          startSkewMs: soloCapture.start!.timerSkewMs,
          endSkewMs: soloCapture.end!.timerSkewMs,
        },
        traffic: soloTrafficEnd,
        listenerScope: soloSubsMid,
      });

      soloClientDelta = deltaTraffic(soloTrafficStart, soloTrafficEnd);
      payload.solo = {
        trailId: soloBoot.trailId,
        uidPrefix: soloBoot.uid.slice(0, 6),
        selectedKm: soloBoot.selectedKm,
        routePick: soloBoot.routePick,
        setupSeparated: true,
        settleMs: SETTLE_MS,
        measure: measureMetaFromCapture(soloCapture, soloDurationMs),
        clientMeters: {
          start: soloTrafficStart,
          end: soloTrafficEnd,
          delta: soloClientDelta,
        },
        listenerScopeMidRide: soloSubsMid,
        cleanup: { status: "pending" },
      };

      log("solo_cleanup", "start", { detail: "Stop + assert liveRide cleared (no summary-close gate)" });
      try {
        await clickStopRide(soloPage);
        await assertLiveRideCleared(soloPage, soloBoot.trailId, soloBoot.uid, "solo");
        (payload.solo as Record<string, unknown>).cleanup = {
          status: "ok",
          stopClicked: true,
          liveRideCleared: true,
          summarySheetCloseRequired: false,
        };
        log("solo_cleanup", "ok", { liveRideCleared: true });
      } catch (cleanupErr) {
        const detail = String(cleanupErr);
        (payload.solo as Record<string, unknown>).cleanup = {
          status: "fail",
          stopClicked: true,
          liveRideCleared: false,
          summarySheetCloseRequired: false,
          error: detail,
        };
        payload.pass = false;
        payload.blocker = "solo_cleanup_failed_abort_before_dual";
        writePartial();
        log("solo_cleanup", "fail", { detail });
        throw new Error(`solo cleanup failed — abort before dual to avoid contamination: ${detail}`, {
          cause: cleanupErr,
        });
      }

      log("solo_measure", "ok", { delta: soloClientDelta, durationMs: soloDurationMs });
    } finally {
      await soloCtx.close().catch(() => undefined);
    }

    // --- DUAL ---
    log("dual_setup", "start");
    const dual = await bootDualRiding(browser);
    try {
      log("dual_setup", "ok", {
        trailId: dual.trailId,
        uidAPrefix: dual.uidA.slice(0, 6),
        uidBPrefix: dual.uidB.slice(0, 6),
        selectedKm: dual.selectedKm,
        routePick: dual.routePick,
      });

      const soloSelectedKm = (payload.solo as { selectedKm?: number | null } | undefined)?.selectedKm;
      expect(
        dual.selectedKm,
        "dual host route pick must match solo selectedKm (same ROUTE_PICK)",
      ).toBe(soloSelectedKm);

      log("dual_settle", "start", { detail: `wait ${SETTLE_MS}ms before arm` });
      await dual.pageA.waitForTimeout(SETTLE_MS);
      log("dual_settle", "ok");
      log("dual_setup_end", "mark", { detail: "quiet setup+settle complete — arm shared paired capture next" });

      const [nowA, nowB] = await Promise.all([pageNowMs(dual.pageA), pageNowMs(dual.pageB)]);
      const dualNow = Math.max(nowA, nowB);
      const dualPlan = computePairedCapturePlan(dualNow, MEASURE_MS, ARM_LEAD_MS, true);
      await Promise.all([
        armPairedCaptureOnPage(dual.pageA, dualPlan),
        armPairedCaptureOnPage(dual.pageB, dualPlan),
      ]);
      log("dual_measure_arm", "mark", {
        plan: dualPlan,
        pageNowA: nowA,
        pageNowB: nowB,
      });

      // Shared wall wait past end, then CDP-retrieve both (latency outside metric window).
      await waitPastCaptureEnd(dual.pageA, dualPlan);
      const [dualA, dualB] = await Promise.all([
        retrievePairedCapture(dual.pageA, "dualA"),
        retrievePairedCapture(dual.pageB, "dualB"),
      ]);

      const dualDurationA = assertPairedTiming(dualA, "dualA", dualB);
      const dualDurationB = assertPairedTiming(dualB, "dualB", dualA);
      const dualDurationMs = Math.round((dualDurationA + dualDurationB) / 2);

      const dualStartA = dualA.start.snap as TrafficSnap;
      const dualEndA = dualA.end.snap as TrafficSnap;
      const dualStartB = dualB.start.snap as TrafficSnap;
      const dualEndB = dualB.end.snap as TrafficSnap;

      const [dualSubsA, dualSubsB] = await Promise.all([
        readSubs(dual.pageA),
        readSubs(dual.pageB),
      ]);
      log("dual_measure_end", "mark", {
        durationMs: dualDurationMs,
        durationA: dualDurationA,
        durationB: dualDurationB,
        captureA: {
          startCapturedAtMs: dualA.start.capturedAtMs,
          endCapturedAtMs: dualA.end.capturedAtMs,
          startSkewMs: dualA.start.timerSkewMs,
          endSkewMs: dualA.end.timerSkewMs,
        },
        captureB: {
          startCapturedAtMs: dualB.start.capturedAtMs,
          endCapturedAtMs: dualB.end.capturedAtMs,
          startSkewMs: dualB.start.timerSkewMs,
          endSkewMs: dualB.end.timerSkewMs,
        },
        trafficA: dualEndA,
        trafficB: dualEndB,
        listenerScopeA: dualSubsA,
        listenerScopeB: dualSubsB,
      });

      const dualDeltaA = deltaTraffic(dualStartA, dualEndA);
      const dualDeltaB = deltaTraffic(dualStartB, dualEndB);
      const dualClientSum = sumClientDeltas([dualDeltaA, dualDeltaB]);

      payload.dual = {
        trailId: dual.trailId,
        uidAPrefix: dual.uidA.slice(0, 6),
        uidBPrefix: dual.uidB.slice(0, 6),
        selectedKm: dual.selectedKm,
        routePick: dual.routePick,
        setupSeparated: true,
        settleMs: SETTLE_MS,
        measure: {
          ...measureMetaFromCapture(dualA, dualDurationA),
          pageB: measureMetaFromCapture(dualB, dualDurationB),
          sharedPlan: dualPlan,
          reportedDurationMs: dualDurationMs,
        },
        clientMeters: {
          pageA: { start: dualStartA, end: dualEndA, delta: dualDeltaA },
          pageB: { start: dualStartB, end: dualEndB, delta: dualDeltaB },
          sumDeltaAcrossClients: dualClientSum,
        },
        listenerScopeMidRide: { pageA: dualSubsA, pageB: dualSubsB },
      };

      log("dual_cleanup", "start");
      try {
        await clickStopRide(dual.pageA);
        await assertLiveRideCleared(dual.pageA, dual.trailId, dual.uidA, "dualA");
        await clickStopRide(dual.pageB);
        await assertLiveRideCleared(dual.pageB, dual.trailId, dual.uidB, "dualB");
        (payload.dual as Record<string, unknown>).cleanup = {
          status: "ok",
          liveRideClearedA: true,
          liveRideClearedB: true,
          summarySheetCloseRequired: false,
        };
        log("dual_cleanup", "ok");
      } catch (e) {
        (payload.dual as Record<string, unknown>).cleanup = {
          status: "fail",
          error: String(e),
          summarySheetCloseRequired: false,
        };
        log("dual_cleanup", "fail", { detail: String(e) });
      }

      if (!soloClientDelta) throw new Error("soloClientDelta missing after solo phase");

      payload.comparison = {
        scope: "1 vs 2 riders only",
        measureMs: MEASURE_MS,
        settleMs: SETTLE_MS,
        routePick: ROUTE_PICK,
        selectedKmMatched: soloSelectedKm === dual.selectedKm,
        captureProtocol: "in_page_paired_absolute_deadline",
        livePublicationRideWriteAttempts: {
          soloClient: soloClientDelta.livePublicationRideWriteAttempts,
          dualClientSum: dualClientSum.livePublicationRideWriteAttempts,
          ratioDualOverSolo:
            soloClientDelta.livePublicationRideWriteAttempts > 0
              ? dualClientSum.livePublicationRideWriteAttempts /
                soloClientDelta.livePublicationRideWriteAttempts
              : null,
        },
        livePublicationRideWrites: {
          soloClient: soloClientDelta.livePublicationRideWrites,
          dualClientSum: dualClientSum.livePublicationRideWrites,
          ratioDualOverSolo:
            soloClientDelta.livePublicationRideWrites > 0
              ? dualClientSum.livePublicationRideWrites / soloClientDelta.livePublicationRideWrites
              : null,
        },
        rtdbMotionWriteAttempts: {
          soloClient: soloClientDelta.rtdbMotionWriteAttempts,
          dualClientSum: dualClientSum.rtdbMotionWriteAttempts,
          ratioDualOverSolo:
            soloClientDelta.rtdbMotionWriteAttempts > 0
              ? dualClientSum.rtdbMotionWriteAttempts / soloClientDelta.rtdbMotionWriteAttempts
              : null,
        },
        rtdbMotionWrites: {
          soloClient: soloClientDelta.rtdbMotionWrites,
          dualClientSum: dualClientSum.rtdbMotionWrites,
          ratioDualOverSolo:
            soloClientDelta.rtdbMotionWrites > 0
              ? dualClientSum.rtdbMotionWrites / soloClientDelta.rtdbMotionWrites
              : null,
        },
        rtdbMotionWriteBytesApprox: {
          soloClient: soloClientDelta.rtdbMotionWriteBytesApprox,
          dualClientSum: dualClientSum.rtdbMotionWriteBytesApprox,
        },
        fsLiveRideUnderlyingDeliveries: {
          soloClient: soloClientDelta.fsLiveRideUnderlyingDeliveries,
          dualClientSum: dualClientSum.fsLiveRideUnderlyingDeliveries,
          note: "Hub callback counts ≠ billed reads. Sum across clients; each client has its own hub.",
        },
        fsLiveRideUnderlyingDocChanges: {
          soloClient: soloClientDelta.fsLiveRideUnderlyingDocChanges,
          dualClientSum: dualClientSum.fsLiveRideUnderlyingDocChanges,
          note: "docChanges lengths ≠ billed document reads.",
        },
        rtdbMotionUnderlyingDeliveries: {
          soloClient: soloClientDelta.rtdbMotionUnderlyingDeliveries,
          dualClientSum: dualClientSum.rtdbMotionUnderlyingDeliveries,
          note: "Hub onValue callbacks ≠ billed downloads.",
        },
      };
      payload.pass = true;
      payload.workerIndex = testInfo.workerIndex;
      payload.elapsedMin = Number(((Date.now() - suiteStartedAtMs) / 60_000).toFixed(2));

      writePartial();
      log("dual_measure", "ok", { sumDelta: dualClientSum, durationMs: dualDurationMs });
      log("suite", "ok", { out: RESULT_JSON });
      expect(payload.pass).toBe(true);
    } finally {
      await dual.pageA.context().close().catch(() => undefined);
      await dual.pageB.context().close().catch(() => undefined);
    }
  });
});

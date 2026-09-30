/**
 * TASK-31B-R — same-duration paired meter capture (DEV harness).
 *
 * In-page timers snapshot meters at shared absolute start/end deadlines so CDP
 * read latency after the window cannot extend or contaminate the metric window.
 * Product cadence / payloads are unchanged.
 */

import {
  resetTrafficPublishMeters,
  snapshotTrafficPublishMeters,
  type TrafficPublishMetersSnapshot,
} from "./trafficPublishMeters";

export type PairedCapturePlan = {
  startAtMs: number;
  endAtMs: number;
  requestedDurationMs: number;
  resetAtStart: boolean;
};

export type PairedCaptureSlot = {
  kind: "start" | "end";
  scheduledAtMs: number;
  capturedAtMs: number;
  /** capturedAtMs − scheduledAtMs (positive = late timer). */
  timerSkewMs: number;
  snap: TrafficPublishMetersSnapshot;
};

export type PairedCaptureState = {
  plan: PairedCapturePlan;
  start: PairedCaptureSlot | null;
  end: PairedCaptureSlot | null;
  status: "armed" | "complete";
};

export type PairedCaptureTimingTolerances = {
  /** |actualDuration − requested| must be ≤ this. */
  durationTolMs: number;
  /** |timerSkew| per slot must be ≤ this; else diagnose load. */
  skewTolMs: number;
  /** Cross-page |capturedAt| alignment for matching slots. */
  alignTolMs: number;
};

export type PairedCaptureTimingVerdict = {
  ok: boolean;
  actualDurationMs: number | null;
  reasons: string[];
};

/** Pure: shared absolute deadlines from a page-clock "now". */
export function computePairedCapturePlan(
  nowMs: number,
  measureMs: number,
  armLeadMs: number,
  resetAtStart = true,
): PairedCapturePlan {
  if (!Number.isFinite(nowMs) || !Number.isFinite(measureMs) || !Number.isFinite(armLeadMs)) {
    throw new Error("computePairedCapturePlan: non-finite inputs");
  }
  if (measureMs <= 0) throw new Error("computePairedCapturePlan: measureMs must be > 0");
  if (armLeadMs < 0) throw new Error("computePairedCapturePlan: armLeadMs must be ≥ 0");
  const startAtMs = nowMs + armLeadMs;
  const endAtMs = startAtMs + measureMs;
  return {
    startAtMs,
    endAtMs,
    requestedDurationMs: measureMs,
    resetAtStart,
  };
}

/** Pure: duration / skew / optional cross-page alignment checks. */
export function evaluatePairedCaptureTiming(
  state: PairedCaptureState,
  tol: PairedCaptureTimingTolerances,
  peer?: PairedCaptureState | null,
): PairedCaptureTimingVerdict {
  const reasons: string[] = [];
  if (state.status !== "complete" || !state.start || !state.end) {
    return { ok: false, actualDurationMs: null, reasons: ["capture incomplete"] };
  }
  const actualDurationMs = state.end.capturedAtMs - state.start.capturedAtMs;
  const { requestedDurationMs } = state.plan;
  if (Math.abs(actualDurationMs - requestedDurationMs) > tol.durationTolMs) {
    reasons.push(
      `duration ${actualDurationMs}ms outside requested ${requestedDurationMs}±${tol.durationTolMs}`,
    );
  }
  if (Math.abs(state.start.timerSkewMs) > tol.skewTolMs) {
    reasons.push(
      `start timer skew ${state.start.timerSkewMs}ms > ±${tol.skewTolMs} (page load / timer starvation)`,
    );
  }
  if (Math.abs(state.end.timerSkewMs) > tol.skewTolMs) {
    reasons.push(
      `end timer skew ${state.end.timerSkewMs}ms > ±${tol.skewTolMs} (page load / timer starvation)`,
    );
  }
  if (peer) {
    if (peer.status !== "complete" || !peer.start || !peer.end) {
      reasons.push("peer capture incomplete");
    } else {
      const startAlign = Math.abs(state.start.capturedAtMs - peer.start.capturedAtMs);
      const endAlign = Math.abs(state.end.capturedAtMs - peer.end.capturedAtMs);
      if (startAlign > tol.alignTolMs) {
        reasons.push(`cross-page start align ${startAlign}ms > ±${tol.alignTolMs}`);
      }
      if (endAlign > tol.alignTolMs) {
        reasons.push(`cross-page end align ${endAlign}ms > ±${tol.alignTolMs}`);
      }
      const peerDur = peer.end.capturedAtMs - peer.start.capturedAtMs;
      if (Math.abs(actualDurationMs - peerDur) > tol.durationTolMs) {
        reasons.push(
          `cross-page duration delta ${Math.abs(actualDurationMs - peerDur)}ms > ±${tol.durationTolMs}`,
        );
      }
    }
  }
  return { ok: reasons.length === 0, actualDurationMs, reasons };
}

type TimerHandle = ReturnType<typeof setTimeout>;

let armed: PairedCaptureState | null = null;
let timers: TimerHandle[] = [];

function clearTimers(): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

/** Cancel any armed capture (does not reset counters). */
export function clearPairedCapture(): void {
  clearTimers();
  armed = null;
}

function captureSlot(kind: "start" | "end", scheduledAtMs: number): PairedCaptureSlot {
  const capturedAtMs = Date.now();
  return {
    kind,
    scheduledAtMs,
    capturedAtMs,
    timerSkewMs: capturedAtMs - scheduledAtMs,
    snap: snapshotTrafficPublishMeters(),
  };
}

/**
 * Arm in-page start/end snapshots at absolute wall times.
 * When resetAtStart, generation-ticket reset runs at the start deadline before the start snap.
 */
export function armPairedCapture(plan: PairedCapturePlan): PairedCapturePlan {
  if (!Number.isFinite(plan.startAtMs) || !Number.isFinite(plan.endAtMs)) {
    throw new Error("armPairedCapture: non-finite deadlines");
  }
  if (plan.endAtMs <= plan.startAtMs) {
    throw new Error("armPairedCapture: endAtMs must be > startAtMs");
  }
  clearPairedCapture();
  armed = {
    plan: { ...plan, requestedDurationMs: plan.endAtMs - plan.startAtMs },
    start: null,
    end: null,
    status: "armed",
  };

  const delayStart = Math.max(0, plan.startAtMs - Date.now());
  timers.push(
    setTimeout(() => {
      if (!armed) return;
      if (plan.resetAtStart) resetTrafficPublishMeters();
      armed.start = captureSlot("start", plan.startAtMs);
      if (armed.end) armed.status = "complete";
    }, delayStart),
  );

  const delayEnd = Math.max(0, plan.endAtMs - Date.now());
  timers.push(
    setTimeout(() => {
      if (!armed) return;
      armed.end = captureSlot("end", plan.endAtMs);
      if (armed.start) armed.status = "complete";
    }, delayEnd),
  );

  return armed.plan;
}

/** Read armed capture state (safe after end deadline; does not snapshot meters). */
export function getPairedCapture(): PairedCaptureState | null {
  if (!armed) return null;
  return {
    plan: armed.plan,
    start: armed.start,
    end: armed.end,
    status: armed.status,
  };
}

/**
 * TASK-28B/28D DEV/test meters — client-side Trail publish & delivery counters.
 * Product cadence / payloads are unchanged; only DEV counters move.
 *
 * Write success/error are generation-ticketed: reset bumps generation so in-flight
 * completions from a prior window are ignored. Attempts remain the primary traffic metric.
 *
 * Caveat: hub deliveries ≠ billed Firestore/RTDB reads. Emulator totals ≠ production billing.
 */

export type TrafficPublishMetersSnapshot = {
  source: "trafficPublishMeters";
  atMs: number;
  /** Actual livePublicationRides `setDoc` call starts (not billed writes). */
  livePublicationRideWriteAttempts: number;
  /** Successful livePublicationRides `setDoc` completions (same generation as attempt). */
  livePublicationRideWrites: number;
  /** livePublicationRides `setDoc` failures after the call started (same generation). */
  livePublicationRideWriteErrors: number;
  /**
   * Actual RTDB motion `set` call starts.
   * Excludes DEV `__rtwMotionWriteFaultOnce` synthetic throws that skip `set`.
   */
  rtdbMotionWriteAttempts: number;
  /** Successful RTDB motion `set` completions (same generation as attempt). */
  rtdbMotionWrites: number;
  /** RTDB motion `set` failures after the call started (not synthetic fault-before-set). */
  rtdbMotionWriteErrors: number;
  /** Approximate UTF-8 length of JSON.stringify(payload) summed on successful sets. */
  rtdbMotionWriteBytesApprox: number;
  /** Hub onSnapshot callback count (not billed document reads). */
  fsLiveRideUnderlyingDeliveries: number;
  /** Sum of QuerySnapshot.docChanges().length on underlying livePublicationRides snapshots. */
  fsLiveRideUnderlyingDocChanges: number;
  /** Hub onValue callback count (not billed download). */
  rtdbMotionUnderlyingDeliveries: number;
};

export type TrafficPublishMetersDelta = Omit<TrafficPublishMetersSnapshot, "source" | "atMs"> & {
  source: "trafficPublishMetersDelta";
  windowMs: number;
};

/** Opaque ticket from an attempt; completions ignore mismatched generation after reset. */
export type TrafficMeterTicket = {
  generation: number;
};

const meters = {
  livePublicationRideWriteAttempts: 0,
  livePublicationRideWrites: 0,
  livePublicationRideWriteErrors: 0,
  rtdbMotionWriteAttempts: 0,
  rtdbMotionWrites: 0,
  rtdbMotionWriteErrors: 0,
  rtdbMotionWriteBytesApprox: 0,
  fsLiveRideUnderlyingDeliveries: 0,
  fsLiveRideUnderlyingDocChanges: 0,
  rtdbMotionUnderlyingDeliveries: 0,
};

/** Bumped on every reset — in-flight completions with older tickets are dropped. */
let meterGeneration = 1;

/** UTF-8 byte length of JSON-encoded value (approx payload size; not wire/billing bytes). */
export function approxUtf8JsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

function isDevMeter(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function ticketMatches(ticket: TrafficMeterTicket | null | undefined): boolean {
  return Boolean(ticket && ticket.generation === meterGeneration);
}

/** DEV/test only — call immediately before the actual livePublicationRides `setDoc`. */
export function noteLivePublicationRideWriteAttempt(): TrafficMeterTicket | null {
  if (!isDevMeter()) return null;
  meters.livePublicationRideWriteAttempts += 1;
  return { generation: meterGeneration };
}

/** DEV/test only — call after a successful livePublicationRides `setDoc`. */
export function noteLivePublicationRideWriteOk(ticket: TrafficMeterTicket | null): void {
  if (!isDevMeter()) return;
  if (!ticketMatches(ticket)) return;
  meters.livePublicationRideWrites += 1;
}

/** DEV/test only — call when livePublicationRides `setDoc` throws. */
export function noteLivePublicationRideWriteError(ticket: TrafficMeterTicket | null): void {
  if (!isDevMeter()) return;
  if (!ticketMatches(ticket)) return;
  meters.livePublicationRideWriteErrors += 1;
}

/** DEV/test only — call immediately before the actual RTDB motion `set` (after fault gate). */
export function noteRtdbMotionWriteAttempt(): TrafficMeterTicket | null {
  if (!isDevMeter()) return null;
  meters.rtdbMotionWriteAttempts += 1;
  return { generation: meterGeneration };
}

/** DEV/test only — call after a successful RTDB motion `set`. */
export function noteRtdbMotionWriteOk(
  ticket: TrafficMeterTicket | null,
  payload: unknown,
): void {
  if (!isDevMeter()) return;
  if (!ticketMatches(ticket)) return;
  meters.rtdbMotionWrites += 1;
  meters.rtdbMotionWriteBytesApprox += approxUtf8JsonBytes(payload);
}

/** DEV/test only — call when RTDB motion `set` throws (not fault-before-set). */
export function noteRtdbMotionWriteError(ticket: TrafficMeterTicket | null): void {
  if (!isDevMeter()) return;
  if (!ticketMatches(ticket)) return;
  meters.rtdbMotionWriteErrors += 1;
}

/** Underlying Firestore livePublicationRides onSnapshot delivery (hub). */
export function noteFsLiveRideUnderlyingDelivery(): void {
  if (!isDevMeter()) return;
  meters.fsLiveRideUnderlyingDeliveries += 1;
}

/** Doc-level changes in one underlying livePublicationRides snapshot. */
export function noteFsLiveRideUnderlyingDocChanges(changeCount: number): void {
  if (!isDevMeter()) return;
  if (!Number.isFinite(changeCount) || changeCount <= 0) return;
  meters.fsLiveRideUnderlyingDocChanges += Math.floor(changeCount);
}

/** Underlying RTDB motion onValue delivery (hub). */
export function noteRtdbMotionUnderlyingDelivery(): void {
  if (!isDevMeter()) return;
  meters.rtdbMotionUnderlyingDeliveries += 1;
}

/**
 * Clear counters and begin a new meter generation.
 * In-flight write completions that started before this reset are ignored.
 */
export function resetTrafficPublishMeters(): void {
  meterGeneration += 1;
  meters.livePublicationRideWriteAttempts = 0;
  meters.livePublicationRideWrites = 0;
  meters.livePublicationRideWriteErrors = 0;
  meters.rtdbMotionWriteAttempts = 0;
  meters.rtdbMotionWrites = 0;
  meters.rtdbMotionWriteErrors = 0;
  meters.rtdbMotionWriteBytesApprox = 0;
  meters.fsLiveRideUnderlyingDeliveries = 0;
  meters.fsLiveRideUnderlyingDocChanges = 0;
  meters.rtdbMotionUnderlyingDeliveries = 0;
}

export function snapshotTrafficPublishMeters(): TrafficPublishMetersSnapshot {
  return {
    source: "trafficPublishMeters",
    atMs: Date.now(),
    livePublicationRideWriteAttempts: meters.livePublicationRideWriteAttempts,
    livePublicationRideWrites: meters.livePublicationRideWrites,
    livePublicationRideWriteErrors: meters.livePublicationRideWriteErrors,
    rtdbMotionWriteAttempts: meters.rtdbMotionWriteAttempts,
    rtdbMotionWrites: meters.rtdbMotionWrites,
    rtdbMotionWriteErrors: meters.rtdbMotionWriteErrors,
    rtdbMotionWriteBytesApprox: meters.rtdbMotionWriteBytesApprox,
    fsLiveRideUnderlyingDeliveries: meters.fsLiveRideUnderlyingDeliveries,
    fsLiveRideUnderlyingDocChanges: meters.fsLiveRideUnderlyingDocChanges,
    rtdbMotionUnderlyingDeliveries: meters.rtdbMotionUnderlyingDeliveries,
  };
}

/** End − start numeric fields for a fixed measure window. */
export function deltaTrafficPublishMeters(
  start: TrafficPublishMetersSnapshot,
  end: TrafficPublishMetersSnapshot,
): TrafficPublishMetersDelta {
  return {
    source: "trafficPublishMetersDelta",
    windowMs: Math.max(0, end.atMs - start.atMs),
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

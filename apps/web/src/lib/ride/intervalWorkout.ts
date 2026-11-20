import {
  getRideIntervalTotalSec,
  getRideIntervalView,
  normalizeRideIntervalConfig,
  type RideIntervalConfig,
  type RideIntervalPhase,
} from "./rideInterval";
import { parseWeightKg } from "./caloriesEstimate";

export type WorkoutIntensity = "light" | "moderate" | "vigorous";
export type IntervalWorkoutFeedback = "easier" | "as-planned" | "harder";
type IntervalWorkoutPhase = Exclude<RideIntervalPhase, "complete">;
type PhaseSeconds = Record<IntervalWorkoutPhase, number>;

/**
 * Self-selected stationary-cycle categories, not measured output or an RPE→MET conversion.
 * Category anchors: https://pacompendium.com/bicycling/ (2024 Adult Compendium).
 * Light/moderate/vigorous work estimates use 4/6/8 MET; easy phases use 3.5 MET.
 * Manual resistance differs between bikes: these are product estimation assumptions.
 */
export const INTERVAL_INTENSITIES: readonly {
  id: WorkoutIntensity;
  label: string;
  description: string;
  workMet: number;
  recoveryMet: number;
}[] = Object.freeze([
  { id: "light", label: "가볍게", description: "여유 있게 대화할 수 있는 정도", workMet: 4, recoveryMet: 3.5 },
  { id: "moderate", label: "보통으로", description: "숨이 차지만 문장으로 대화할 수 있는 정도", workMet: 6, recoveryMet: 3.5 },
  { id: "vigorous", label: "힘차게", description: "숨이 많이 차고 짧은 말만 가능한 정도", workMet: 8, recoveryMet: 3.5 },
]);

export type IntervalWorkoutRecord = {
  version: 1;
  id: string;
  config: Required<RideIntervalConfig>;
  intensity: WorkoutIntensity;
  startElapsedSec: number;
  endElapsedSec: number;
  plannedSec: number;
  elapsedSec: number;
  /** Confirmed pedal seconds only; null means no usable sensor sample. */
  activeSec: number | null;
  phaseSeconds: PhaseSeconds;
  activePhaseSeconds: PhaseSeconds;
  signalGap: boolean;
  status: "completed" | "stopped" | "reconfigured" | "disabled";
  caloriesEstimate: number | null;
  /** Private Ride-only input snapshot for reproducing this estimate. */
  weightKg?: number | null;
  feedback?: IntervalWorkoutFeedback;
};

const PHASES: readonly IntervalWorkoutPhase[] = ["warmup", "work", "recovery", "rest", "cooldown"];
const MAX_WORKOUTS = 64;
const EPSILON = 0.000001;
const MAX_SESSION_SECONDS = 7 * 24 * 60 * 60;

function emptyPhases(): PhaseSeconds {
  return { warmup: 0, work: 0, recovery: 0, rest: 0, cooldown: 0 };
}

function isWorkoutIntensity(value: unknown): value is WorkoutIntensity {
  return value === "light" || value === "moderate" || value === "vigorous";
}

function validSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_SESSION_SECONDS;
}

function phaseSum(phases: PhaseSeconds): number {
  return PHASES.reduce((sum, phase) => sum + phases[phase], 0);
}

function copyRecord(record: IntervalWorkoutRecord): IntervalWorkoutRecord {
  return {
    ...record,
    config: { ...record.config },
    phaseSeconds: { ...record.phaseSeconds },
    activePhaseSeconds: { ...record.activePhaseSeconds },
  };
}

function readPhases(value: unknown): PhaseSeconds | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const phases = emptyPhases();
  for (const phase of PHASES) {
    if (!validSeconds(raw[phase])) return null;
    phases[phase] = raw[phase];
  }
  return phases;
}

/** Unknown/legacy records are ignored; never fabricate interval history from a normal Ride. */
export function parseIntervalWorkouts(raw: unknown): IntervalWorkoutRecord[] {
  if (!Array.isArray(raw)) return [];
  const parsed: IntervalWorkoutRecord[] = [];
  const ids = new Set<string>();
  for (const item of raw.slice(0, MAX_WORKOUTS)) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const config = normalizeRideIntervalConfig(value.config);
    const phases = readPhases(value.phaseSeconds);
    const activePhases = readPhases(value.activePhaseSeconds);
    if (value.version !== 1 || typeof value.id !== "string" || !value.id.trim() || value.id.length > 160 || ids.has(value.id)) continue;
    if (!config || !isWorkoutIntensity(value.intensity) || !phases || !activePhases) continue;
    if (!validSeconds(value.startElapsedSec) || !validSeconds(value.endElapsedSec) || !validSeconds(value.elapsedSec) || !validSeconds(value.plannedSec)) continue;
    if (Math.abs(value.plannedSec - getRideIntervalTotalSec(config)) > EPSILON || value.elapsedSec > value.plannedSec + EPSILON) continue;
    if (Math.abs(value.endElapsedSec - value.startElapsedSec - value.elapsedSec) > EPSILON || Math.abs(phaseSum(phases) - value.elapsedSec) > EPSILON) continue;
    if (PHASES.some((phase) => activePhases[phase] > phases[phase] + EPSILON)) continue;
    if (value.activeSec !== null && !validSeconds(value.activeSec)) continue;
    if (value.activeSec === null ? phaseSum(activePhases) > EPSILON : Math.abs(phaseSum(activePhases) - value.activeSec) > EPSILON) continue;
    if (typeof value.signalGap !== "boolean") continue;
    if (value.status !== "completed" && value.status !== "stopped" && value.status !== "reconfigured" && value.status !== "disabled") continue;
    if (value.status === "completed" && Math.abs(value.elapsedSec - value.plannedSec) > EPSILON) continue;
    if (value.caloriesEstimate !== null && (!validSeconds(value.caloriesEstimate) || !Number.isInteger(value.caloriesEstimate))) continue;
    if (value.activeSec === null && value.caloriesEstimate !== null) continue;
    if (value.weightKg !== undefined && value.weightKg !== null && parseWeightKg(value.weightKg) === null) continue;
    const feedback = value.feedback === "easier" || value.feedback === "as-planned" || value.feedback === "harder" ? value.feedback : undefined;
    parsed.push({
      version: 1,
      id: value.id,
      config,
      intensity: value.intensity,
      startElapsedSec: value.startElapsedSec,
      endElapsedSec: value.endElapsedSec,
      plannedSec: value.plannedSec,
      elapsedSec: value.elapsedSec,
      activeSec: value.activeSec as number | null,
      phaseSeconds: phases,
      activePhaseSeconds: activePhases,
      signalGap: value.signalGap,
      status: value.status,
      caloriesEstimate: value.caloriesEstimate as number | null,
      ...(value.weightKg !== undefined ? { weightKg: value.weightKg as number | null } : {}),
      ...(feedback ? { feedback } : {}),
    });
    ids.add(value.id);
  }
  return parsed;
}

type Sample = { elapsedSec: number; activeSec: number | null; signalGap?: boolean };
type FinishStatus = "stopped" | "reconfigured" | "disabled";
type ActiveWorkout = {
  record: IntervalWorkoutRecord;
  weightKg: number | null;
  lastElapsedSec: number;
  lastActiveSec: number | null;
};

/**
 * Pure recorder. Call advance at the cadence-counter sampling rate (currently 1 second),
 * using the same pause-excluding Ride clock. Sensor counter jumps are spread across the
 * elapsed sample interval: this estimates phase allocation, not second-by-second intensity.
 */
export class IntervalWorkoutTracker {
  private records: IntervalWorkoutRecord[] = [];
  private active: ActiveWorkout | null = null;

  begin(input: { id: string; config: RideIntervalConfig; intensity: WorkoutIntensity; elapsedSec: number; activeSec: number | null; weightKg: number | null }): void {
    const config = normalizeRideIntervalConfig(input.config);
    if (!config || !isWorkoutIntensity(input.intensity) || !validSeconds(input.elapsedSec) || !input.id.trim() || input.id.length > 160) return;
    if (input.activeSec !== null && !validSeconds(input.activeSec)) return;
    if (this.records.some((record) => record.id === input.id) || this.active?.record.id === input.id) return;
    if (this.active) this.finish({ ...input, status: "reconfigured" });
    // Reject additional starts rather than silently dropping any completed history.
    if (this.records.length >= MAX_WORKOUTS) return;
    this.active = {
      weightKg: parseWeightKg(input.weightKg),
      lastElapsedSec: input.elapsedSec,
      lastActiveSec: input.activeSec,
      record: {
        version: 1, id: input.id, config, intensity: input.intensity,
        startElapsedSec: input.elapsedSec, endElapsedSec: input.elapsedSec,
        plannedSec: getRideIntervalTotalSec(config), elapsedSec: 0,
        activeSec: input.activeSec === null ? null : 0,
        phaseSeconds: emptyPhases(), activePhaseSeconds: emptyPhases(),
        signalGap: false, status: "stopped", caloriesEstimate: null, weightKg: parseWeightKg(input.weightKg),
      },
    };
    this.refreshCalories();
  }

  advance(input: Sample): void {
    const active = this.active;
    if (!active || !validSeconds(input.elapsedSec) || input.elapsedSec < active.lastElapsedSec) return;
    if (input.activeSec !== null && !validSeconds(input.activeSec)) return;
    const fullDelta = input.elapsedSec - active.lastElapsedSec;
    const record = active.record;
    const endElapsedSec = Math.min(input.elapsedSec, record.startElapsedSec + record.plannedSec);
    const delta = Math.max(0, endElapsedSec - active.lastElapsedSec);
    let pedalDelta = 0;
    if (input.activeSec === null) {
      record.signalGap = true;
    } else {
      if (record.activeSec === null) record.activeSec = 0;
      if (active.lastActiveSec !== null && input.activeSec >= active.lastActiveSec) {
        const rawDelta = input.activeSec - active.lastActiveSec;
        pedalDelta = fullDelta > 0 ? Math.min(fullDelta, rawDelta) * (delta / fullDelta) : 0;
        if (rawDelta > fullDelta + EPSILON) record.signalGap = true;
      } else if (delta > 0) {
        // A newly connected/reset counter gives no evidence about the preceding gap.
        record.signalGap = true;
      }
    }
    record.signalGap ||= input.signalGap === true;
    if (delta > 0) {
      let offset = active.lastElapsedSec - record.startElapsedSec;
      const endOffset = endElapsedSec - record.startElapsedSec;
      while (offset < endOffset - EPSILON) {
        const view = getRideIntervalView(offset * 1000, record.config);
        if (view.phase === "complete") break;
        const seconds = Math.min(endOffset - offset, view.stepRemainingMs / 1000);
        if (seconds <= 0) break;
        record.phaseSeconds[view.phase] += seconds;
        record.activePhaseSeconds[view.phase] += pedalDelta * (seconds / delta);
        offset += seconds;
      }
      record.endElapsedSec = endElapsedSec;
      record.elapsedSec = endOffset;
      if (record.activeSec !== null) record.activeSec = phaseSum(record.activePhaseSeconds);
    }
    active.lastElapsedSec = input.elapsedSec;
    active.lastActiveSec = input.activeSec;
    this.refreshCalories();
    if (record.elapsedSec >= record.plannedSec - EPSILON) {
      record.status = "completed";
      this.records.push(copyRecord(record));
      this.active = null;
    }
  }

  finish(input: Sample & { status?: FinishStatus }): void {
    if (!this.active || !validSeconds(input.elapsedSec) || input.elapsedSec < this.active.lastElapsedSec) return;
    if (input.activeSec !== null && !validSeconds(input.activeSec)) return;
    this.advance(input);
    if (!this.active) return;
    this.active.record.status = input.status ?? "stopped";
    // StrictMode may replay the start effect before any Ride time passes. An empty
    // configuration transition is not an execution and must not consume the cap.
    if (this.active.record.elapsedSec > EPSILON) this.records.push(copyRecord(this.active.record));
    this.active = null;
  }

  snapshot(): IntervalWorkoutRecord[] {
    return [...this.records, ...(this.active ? [this.active.record] : [])].map(copyRecord);
  }

  reset(): void {
    this.active = null;
    this.records = [];
  }

  private refreshCalories(): void {
    if (!this.active) return;
    const { record, weightKg } = this.active;
    if (weightKg === null || record.activeSec === null) {
      record.caloriesEstimate = null;
      return;
    }
    const intensity = INTERVAL_INTENSITIES.find((option) => option.id === record.intensity)!;
    const metSeconds = PHASES.reduce((sum, phase) => sum + record.activePhaseSeconds[phase] * (phase === "work" ? intensity.workMet : intensity.recoveryMet), 0);
    record.caloriesEstimate = Math.round(weightKg * metSeconds / 3600);
  }
}

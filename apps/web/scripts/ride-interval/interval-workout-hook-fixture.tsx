import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useRideInterval } from "../../src/hooks/useRideInterval";
import type { RideIntervalConfig } from "../../src/lib/ride/rideInterval";
import type { IntervalWorkoutRecord, WorkoutIntensity } from "../../src/lib/ride/intervalWorkout";

type FixtureState = { status: "idle" | "running" | "paused"; elapsedMs: number; ownerUid: string };
const config: RideIntervalConfig = { warmupSec: 0, highSec: 10, lowSec: 10, repeats: 1, cooldownSec: 0, rounds: 1, roundRestSec: 0 };
declare global {
  interface Window {
    intervalHookProbe: {
      patch: (patch: Partial<FixtureState> & { activeSec?: number | null }) => void;
      sample: () => void;
      batch: (next: RideIntervalConfig, intensity: WorkoutIntensity, enabled: boolean) => void;
      intensity: (value: WorkoutIntensity) => void;
      finish: () => IntervalWorkoutRecord[];
      view: ReturnType<typeof useRideInterval>["view"];
      selectedIntensity: WorkoutIntensity;
      enabled: boolean;
      config: Required<RideIntervalConfig>;
      state: FixtureState;
    };
  }
}

export function Fixture() {
  const initiallyRunning = new URLSearchParams(location.search).get("running") === "1";
  const [state, setState] = useState<FixtureState>({ status: initiallyRunning ? "running" : "idle", elapsedMs: 0, ownerUid: "interval-hook-a" });
  const activeSecRef = useRef<number | null>(0);
  const signalGapRef = useRef(false);
  const program = useRideInterval(state.status, state.elapsedMs, true, config, {
    ownerUid: state.ownerUid, weightKg: 70, activeSecRef, signalGapRef,
  });
  useEffect(() => {
    window.intervalHookProbe = {
      patch(patch) {
        if ("activeSec" in patch) activeSecRef.current = patch.activeSec ?? null;
        const { activeSec: _activeSec, ...statePatch } = patch;
        void _activeSec;
        setState((previous) => ({ ...previous, ...statePatch }));
      },
      sample: program.sampleWorkouts,
      batch(next, intensity, enabled) {
        program.onConfig(next);
        program.onIntensity(intensity);
        program.onEnabled(enabled);
      },
      intensity: program.onIntensity,
      finish: program.finishWorkouts,
      view: program.view,
      selectedIntensity: program.intensity,
      enabled: program.enabled,
      config: program.config,
      state,
    };
  });
  return <output id="interval-hook-state">{JSON.stringify({ state, view: program.view, intensity: program.intensity, enabled: program.enabled })}</output>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);

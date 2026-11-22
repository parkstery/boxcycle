import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RideIntervalSettingsSheet } from "../../src/components/ride/RideIntervalSettingsSheet";
import { RideSummarySheet } from "../../src/components/ride/RideSummarySheet";
import { RIDE_INTERVAL_PRESETS, type RideIntervalConfig } from "../../src/lib/ride/rideInterval";
import type { WorkoutIntensity, IntervalWorkoutRecord, IntervalWorkoutFeedback } from "../../src/lib/ride/intervalWorkout";
import type { RideEndResult } from "../../src/lib/ride/rideEndResult";

export function Runtime() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<RideIntervalConfig>(RIDE_INTERVAL_PRESETS[1]!.config);
  const [intensity, setIntensity] = useState<WorkoutIntensity>("moderate");
  const [quickSec, setQuickSec] = useState<number | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [rideId, setRideId] = useState("ride-a");
  const [feedback, setFeedback] = useState<IntervalWorkoutFeedback | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState(true);
  const workout: IntervalWorkoutRecord = {
    version:1, id:"workout-a", config:RIDE_INTERVAL_PRESETS[1]!.config, intensity:"moderate", startElapsedSec:0, endElapsedSec:900,
    plannedSec:900, elapsedSec:900, activeSec:840, phaseSeconds:{warmup:300,work:120,recovery:120,rest:60,cooldown:300},
    activePhaseSeconds:{warmup:280,work:120,recovery:120,rest:40,cooldown:280}, signalGap:false, status:"completed", caloriesEstimate:98,
  };
  const result = {
    recordId:rideId, endedAtIso:"2026-11-20T00:00:00Z", elapsedSec:900, sessionDistanceMeters:3000, avgSpeedKmh:12,
    caloriesEstimate:98, intervalWorkouts:[workout], savedRouteId:null, routeName:null, hasRoute:false,
    previousProgressRatio:0, progressRatio:0, routeCompleted:false, anchorLngLat:null, anchorPlaceLabel:null,
    profile:"cycling", routeDistanceMeters:0, rideSaveStatus:"success", savedRouteProgressStatus:"n/a",
  } satisfies RideEndResult;
  return <>
    <div style={{position:"fixed",bottom:0,left:0,zIndex:100,display:"flex",gap:8}}>
      <button onClick={() => setOpen(true)}>설정 열기</button>
      <button onClick={() => setSummaryOpen(true)}>결과 열기</button>
      <button onClick={() => setRideId("ride-b")}>다음 기록</button>
      <button onClick={() => setRejectFeedback(false)}>피드백 성공 전환</button>
    </div>
    <RideIntervalSettingsSheet open={open} config={config} restartOnApply={false} onApply={(next) => { setConfig(next); return true; }}
      onClose={() => setOpen(false)} enabled={enabled} onEnabled={setEnabled} intensity={intensity} onIntensity={setIntensity}
      onQuickIntervalRide={(sec) => { setQuickSec(sec); setOpen(false); }} />
    <RideSummarySheet open={summaryOpen} riderName="검증 라이더" arrivalCompleted={false} elapsedLabel="15분" avgKmh="12.0" caloriesEstimate={98}
      result={result} userId={null} calorieProfileComplete adhocSaveAvailable={false} maxNameLength={60}
      onSaveAdhoc={() => {}} onDismissAdhoc={() => {}} onClose={() => setSummaryOpen(false)}
      onIntervalFeedback={async (_id, effort) => { if (rejectFeedback) throw new Error("fixture rejection"); setFeedback(effort); }} />
    <output id="workout-ui-state" style={{position:"fixed",top:0,left:0,pointerEvents:"none",fontSize:10}}>
      {JSON.stringify({enabled,intensity,quickSec,feedback,rideId})}
    </output>
  </>;
}
createRoot(document.getElementById("root")!).render(<Runtime />);

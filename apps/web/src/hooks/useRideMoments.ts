import { useEffect, useRef, useState } from "react";
import { cancelRideMomentSound, playRideMomentSound } from "../lib/ride/rideMomentSound";
import { safeRideSpeechCancel, speakRideText } from "../lib/ride/rideSpeech";
import {
  emptyRideMomentMemory,
  resolveRideMoments,
  RIDE_MOMENT_DISPLAY_MS,
  RIDE_MOMENT_PRIORITY,
  type RideMomentEvent,
  type RideMomentInput,
} from "../lib/ride/rideMoments";

/**
 * 표시 타이머는 이 훅을 쓰는 자식만 다시 그린다. App·지도 리렌더를 부르지 않는다.
 */
export function useRideMoments(input: RideMomentInput, soundEnabled: boolean, intervalTtsEnabled = false): RideMomentEvent | null {
  const memoryRef = useRef(emptyRideMomentMemory());
  const timeoutRef = useRef<number | null>(null);
  const displayedRef = useRef<RideMomentEvent | null>(null);
  const [event, setEvent] = useState<RideMomentEvent | null>(null);
  const status = input.status;
  const elapsedMs = input.elapsedMs;
  const routeMeters = input.routeMeters;
  const traveledMeters = input.traveledMeters;
  const waypointMeters = input.waypointMeters;
  const interval = input.interval;
  const newRoadKm = input.newRoadKm;
  const ended = input.ended;
  const intervalRunKey = input.intervalRunKey ?? null;

  useEffect(() => {
    const previous = memoryRef.current;
    const resolved = resolveRideMoments(previous, {
      status,
      elapsedMs,
      routeMeters,
      traveledMeters,
      waypointMeters,
      interval,
      newRoadKm,
      ended,
      intervalRunKey,
    });
    memoryRef.current = resolved.memory;

    const clearDisplay = () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      cancelRideMomentSound();
      displayedRef.current = null;
      setEvent(null);
    };

    const displayingInterval = displayedRef.current?.kind.startsWith("interval");
    const newRide = status === "running" && (previous.lastStatus === "idle" || previous.ended);
    const changedIntervalRun = intervalRunKey !== previous.intervalRunKey;
    if (displayingInterval && (interval == null || changedIntervalRun)) safeRideSpeechCancel();
    if (newRide || (displayingInterval && (interval == null || changedIntervalRun))) clearDisplay();
    if (!soundEnabled) cancelRideMomentSound();

    if (!resolved.event) {
      const ending = displayedRef.current?.kind === "finish" || displayedRef.current?.kind === "stop";
      if (status === "paused" || (status === "idle" && !ending)) { if (interval) safeRideSpeechCancel(); clearDisplay(); }
      return;
    }

    const showing = displayedRef.current;
    if (showing && RIDE_MOMENT_PRIORITY[resolved.event.kind] < RIDE_MOMENT_PRIORITY[showing.kind]) {
      return;
    }

    displayedRef.current = resolved.event;
    setEvent(resolved.event);
    if (intervalTtsEnabled && resolved.event.kind.startsWith("interval")) speakRideText(resolved.event.coach, "ko-KR");
    if (soundEnabled) playRideMomentSound(resolved.event.sound);
    else cancelRideMomentSound();
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      displayedRef.current = null;
      setEvent(null);
    }, RIDE_MOMENT_DISPLAY_MS);
  }, [
    status,
    elapsedMs,
    routeMeters,
    traveledMeters,
    waypointMeters,
    interval,
    newRoadKm,
    ended,
    intervalRunKey,
    soundEnabled,
    intervalTtsEnabled,
  ]);

  useEffect(() => () => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    displayedRef.current = null;
    memoryRef.current = emptyRideMomentMemory();
    cancelRideMomentSound();
  }, []);

  return event;
}

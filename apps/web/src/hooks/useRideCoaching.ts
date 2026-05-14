import { useEffect, useMemo, useRef, useState } from "react";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { routeElevationSignature } from "../lib/fetchRouteElevations";
import type { CoachingData } from "../lib/coachTypes";
import {
  buildCoachElevationPoints,
  elevationReadyForCoach,
  sliceCoachPointsAhead,
} from "../lib/coachElevationFromRoute";
import {
  getCourseBriefingMessage,
  getPredictiveCoaching,
  getRideEncouragementMessage,
  parseResistanceBand,
  pickFreshTipForResistance,
} from "../services/aiCoach";
import {
  installRideSpeechVoicesListener,
  safeRideSpeechCancel,
  setRideTtsEnabled,
  speakRideText,
} from "../lib/rideSpeech";
import type { RideSessionStatus } from "./useVirtualRideSession";

const COACH_TICK_MS = 500;
const FRESH_TIP_MS = 30_000;

type SegmentState = {
  coaching: CoachingData & { tipId?: string; resId?: string };
  validUntilDistanceM: number;
};

function tipIndexFromCoaching(c: CoachingData & { tipId?: string }): number | null {
  const m = c.tipId?.match(/(\d+)\s*$/);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function useRideCoaching(opts: {
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  sessionStatus: RideSessionStatus;
  speedKmh: number;
  elevationM: readonly number[];
  sampledCoords: readonly LngLat[];
  ttsEnabled: boolean;
}): {
  coachData: CoachingData | null;
} {
  const [coachData, setCoachData] = useState<CoachingData | null>(null);
  const routeSig = useMemo(() => routeElevationSignature(opts.routeGeometry), [opts.routeGeometry]);

  const vdRef = useRef(0);
  const routeLenRef = useRef(0);
  const speedRef = useRef(0);
  const sessionRef = useRef<RideSessionStatus>(opts.sessionStatus);
  const ttsRef = useRef(opts.ttsEnabled);
  vdRef.current = opts.virtualDistanceMeters;
  routeLenRef.current = opts.routeDistanceMeters;
  speedRef.current = opts.speedKmh;
  sessionRef.current = opts.sessionStatus;
  ttsRef.current = opts.ttsEnabled;

  const segmentRef = useRef<SegmentState | null>(null);
  const inflightRef = useRef(false);
  const lastResistanceRef = useRef<number | null>(null);
  const lastFreshTipAtRef = useRef(0);
  const lastTipIndexRef = useRef<number | null>(null);
  const skipResistanceSpeakOnceRef = useRef(false);
  const prevStatusRef = useRef<RideSessionStatus>(opts.sessionStatus);

  const coachPoints = useMemo(() => {
    if (!opts.routeGeometry || opts.elevationM.length === 0 || opts.sampledCoords.length === 0) {
      return [];
    }
    return buildCoachElevationPoints(opts.routeGeometry, opts.elevationM, opts.sampledCoords);
  }, [opts.routeGeometry, opts.elevationM, opts.sampledCoords]);

  useEffect(() => {
    return installRideSpeechVoicesListener();
  }, []);

  useEffect(() => {
    setRideTtsEnabled(opts.ttsEnabled);
  }, [opts.ttsEnabled]);

  useEffect(() => {
    segmentRef.current = null;
    inflightRef.current = false;
    lastResistanceRef.current = null;
    lastTipIndexRef.current = null;
    lastFreshTipAtRef.current = 0;
    setCoachData(null);
  }, [routeSig]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = opts.sessionStatus;

    if (opts.sessionStatus === "running" && prev === "idle") {
      safeRideSpeechCancel();
      const kmTotal = (routeLenRef.current / 1000).toFixed(2);
      speakRideText(getCourseBriefingMessage(kmTotal));
      skipResistanceSpeakOnceRef.current = true;
      segmentRef.current = null;
      inflightRef.current = false;
    }

    if (
      opts.sessionStatus === "idle" &&
      (prev === "running" || prev === "paused") &&
      routeLenRef.current > 0
    ) {
      const km = (vdRef.current / 1000).toFixed(2);
      speakRideText(getRideEncouragementMessage(km));
      segmentRef.current = null;
      inflightRef.current = false;
      lastResistanceRef.current = null;
    }
  }, [opts.sessionStatus]);

  useEffect(() => {
    if (opts.sessionStatus !== "running") return;
    if (!opts.routeGeometry || routeLenRef.current < 80) return;
    if (!elevationReadyForCoach(opts.elevationM)) return;
    if (coachPoints.length < 2) return;

    const tick = () => {
      if (sessionRef.current !== "running") return;
      const vd = vdRef.current;
      const routeLen = routeLenRef.current;
      const speed = speedRef.current;
      const seg = segmentRef.current;
      const ttsOn = ttsRef.current;

      if (seg && vd <= seg.validUntilDistanceM) {
        const rNow = parseResistanceBand(seg.coaching.resistance);
        const lastR = lastResistanceRef.current;
        const now = Date.now();
        if (lastR === rNow && now - lastFreshTipAtRef.current >= FRESH_TIP_MS) {
          const fresh = pickFreshTipForResistance(rNow, false, lastTipIndexRef.current);
          lastFreshTipAtRef.current = now;
          lastTipIndexRef.current = fresh.tipIndex;
          const nextCoaching = { ...seg.coaching, tip: fresh.displayText };
          segmentRef.current = { ...seg, coaching: nextCoaching };
          setCoachData(nextCoaching);
          if (ttsOn) speakRideText(fresh.displayText);
        }
        return;
      }

      if (inflightRef.current) return;
      inflightRef.current = true;

      const upcoming = sliceCoachPointsAhead(coachPoints, routeLen, vd, 24);
      void getPredictiveCoaching(
        upcoming,
        routeLen,
        coachPoints.length,
        vd,
        speed,
        seg?.coaching.resistance,
      ).then(
        ({ coaching, validUntilDistanceM }) => {
          inflightRef.current = false;
          if (sessionRef.current !== "running") return;
          segmentRef.current = { coaching, validUntilDistanceM };
          setCoachData(coaching);

          const r = parseResistanceBand(coaching.resistance);
          const lastR = lastResistanceRef.current;

          if (skipResistanceSpeakOnceRef.current) {
            skipResistanceSpeakOnceRef.current = false;
            lastResistanceRef.current = r;
            lastTipIndexRef.current = tipIndexFromCoaching(coaching);
            lastFreshTipAtRef.current = Date.now();
            return;
          }

          if (lastR !== r) {
            lastResistanceRef.current = r;
            lastFreshTipAtRef.current = Date.now();
            lastTipIndexRef.current = tipIndexFromCoaching(coaching);
            if (ttsOn) speakRideText(coaching.tip);
            return;
          }

          const now = Date.now();
          if (now - lastFreshTipAtRef.current >= FRESH_TIP_MS) {
            const fresh = pickFreshTipForResistance(r, false, lastTipIndexRef.current);
            lastFreshTipAtRef.current = now;
            lastTipIndexRef.current = fresh.tipIndex;
            const nextCoaching = { ...coaching, tip: fresh.displayText };
            segmentRef.current = { coaching: nextCoaching, validUntilDistanceM };
            setCoachData(nextCoaching);
            if (ttsOn) speakRideText(fresh.displayText);
          }
        },
        () => {
          inflightRef.current = false;
        },
      );
    };

    tick();
    const id = window.setInterval(tick, COACH_TICK_MS);
    return () => clearInterval(id);
  }, [opts.sessionStatus, opts.routeGeometry, coachPoints, opts.elevationM]);

  return { coachData };
}

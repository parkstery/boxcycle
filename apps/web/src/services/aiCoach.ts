import type { CoachingData } from "../lib/coachTypes";
import type { CoachElevationPoint } from "./roadElevationCoach";
import { getTipIndicesByResistance, getCoachingPhrases } from "./phraseManifest";
import { estimateRoadSlope } from "./roadElevationCoach";

function resistanceToIntensityAction(targetRes: number): {
  intensity: "LOW" | "MODERATE" | "HIGH" | "MAX";
  action: "SIT" | "STAND" | "TUCK" | "PEDAL";
} {
  if (targetRes >= 6) return { intensity: "HIGH", action: "STAND" };
  if (targetRes <= 2) return { intensity: "LOW", action: "TUCK" };
  return { intensity: "MODERATE", action: "PEDAL" };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function getAdvancedCoaching(
  _currentElevation: number,
  upcomingPoints: CoachElevationPoint[],
  _currentSpeed: number,
  previousResistance?: string,
): Promise<CoachingData & { tipId?: string; resId?: string }> {
  let slope = 0;
  let distance = 0;
  let elevationSpanM = 0;
  let trendSlope = 0;
  let trendRiseM = 0;
  if (upcomingPoints.length > 1) {
    const est = estimateRoadSlope(upcomingPoints);
    const longSlope = est.slope;
    const shortSlope = est.slopeShort;
    trendSlope = est.trendSlope;
    trendRiseM = est.trendRiseM;
    const candidates = [longSlope, shortSlope, trendSlope];
    slope = candidates.reduce((best, v) => (Math.abs(v) > Math.abs(best) ? v : best), 0);
    distance = est.distanceM;
    elevationSpanM = est.elevationSpanM;
  }

  const lowConfidence = distance < 15;
  if (lowConfidence) slope = 0;

  let targetRes: number;
  if (slope >= 10) targetRes = 8;
  else if (slope >= 7) targetRes = 7;
  else if (slope >= 5) targetRes = 6;
  else if (slope >= 3) targetRes = 5;
  else if (slope >= 1) targetRes = 4;
  else if (slope >= -1) targetRes = 3;
  else if (slope >= -3) targetRes = 2;
  else targetRes = 1;

  const sustainedTrendReliable = distance >= 120 && elevationSpanM >= 3;
  if (!lowConfidence && sustainedTrendReliable) {
    const uphillRiseReliable = trendRiseM >= 3;
    if (uphillRiseReliable) {
      if (trendSlope >= 10) targetRes = Math.max(targetRes, 8);
      else if (trendSlope >= 7) targetRes = Math.max(targetRes, 7);
      else if (trendSlope >= 4) targetRes = Math.max(targetRes, 6);
      else if (trendSlope >= 2) targetRes = Math.max(targetRes, 5);
      else if (trendSlope >= 0.8) targetRes = Math.max(targetRes, 4);
    } else if (trendRiseM <= -3) {
      if (trendSlope <= -3) targetRes = Math.min(targetRes, 1);
      else if (trendSlope <= -1) targetRes = Math.min(targetRes, 2);
    }
  }

  const resistanceText = `Resistance ${targetRes}`;
  const resId = `res_${targetRes}`;

  const candidateIndices = getTipIndicesByResistance(targetRes);
  const tipIndex =
    candidateIndices.length > 0 ? pickRandom(candidateIndices) : Math.floor(Math.random() * 32);
  const phrases = getCoachingPhrases();
  const tipId = `tip_${tipIndex}`;
  const tipText = phrases[tipIndex]?.text ?? phrases[0].text;

  const { intensity, action } = resistanceToIntensityAction(targetRes);

  void previousResistance;
  void lowConfidence;
  const tipForDisplay = `${tipText} (R${targetRes})`;

  return {
    tip: tipForDisplay,
    resistance: resistanceText,
    intensity,
    action,
    tipId,
    resId,
  };
}

/** 거리 기준 세그먼트 — `validUntilDistanceM` 까지 동일 코칭으로 본다. */
export async function getPredictiveCoaching(
  upcomingPoints: CoachElevationPoint[],
  routeDistanceM: number,
  _elevLen: number,
  currentDistanceM: number,
  currentSpeed: number,
  previousResistance?: string,
): Promise<{
  coaching: CoachingData & { tipId?: string; resId?: string };
  validUntilDistanceM: number;
}> {
  const spanM = Math.min(480, Math.max(120, upcomingPoints.length * 22));
  const validUntilDistanceM = Math.min(routeDistanceM, currentDistanceM + spanM);
  const coaching = await getAdvancedCoaching(0, upcomingPoints, currentSpeed, previousResistance);
  return { coaching, validUntilDistanceM };
}

export function pickFreshTipForResistance(
  targetRes: number,
  _isSteady: boolean,
  avoidTipIndex?: number | null,
): { tipText: string; tipIndex: number; displayText: string } {
  const all = getTipIndicesByResistance(targetRes);
  const filtered = typeof avoidTipIndex === "number" ? all.filter((i) => i !== avoidTipIndex) : all;
  const pool = filtered.length > 0 ? filtered : all;
  const tipIndex = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : 0;
  const phrases = getCoachingPhrases();
  const tipText = phrases[tipIndex]?.text ?? phrases[0].text;
  const displayText = `${tipText} (R${targetRes})`;
  return { tipText, tipIndex, displayText };
}

export function parseResistanceBand(resistanceText: string | undefined): number {
  if (!resistanceText) return 3;
  if (resistanceText === "Steady") return 3;
  const m = resistanceText.match(/Resistance\s*(\d+)/i);
  const n = m ? parseInt(m[1], 10) : 3;
  return Number.isFinite(n) ? Math.max(1, Math.min(8, n)) : 3;
}

export function getCourseBriefingMessage(distanceKmLabel: string): string {
  return `The ride distance is about ${distanceKmLabel} kilometers. Have a great ride!`;
}

export function getRideEncouragementMessage(distanceKmLabel: string): string {
  return `You covered about ${distanceKmLabel} kilometers. Great job!`;
}

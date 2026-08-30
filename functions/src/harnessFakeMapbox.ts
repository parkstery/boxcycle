import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { resolveHarnessActive } from "./harnessActive.js";

type LngLat = [number, number];
type RouteProfile = "cycling" | "driving" | "walking";

export type HarnessFakeDirectionsRoute = {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance: number;
  duration: number;
};

const HARNESS_STATS_DOC = "harness/routeTokenFakeMapbox";

export function isHarnessFakeMapboxActive(): boolean {
  return resolveHarnessActive(process.env);
}

type HarnessStats = {
  providerCallCount: number;
  failNext: boolean;
};

async function readHarnessStats(): Promise<HarnessStats> {
  const snap = await getFirestore().doc(HARNESS_STATS_DOC).get();
  const data = snap.data() ?? {};
  return {
    providerCallCount:
      typeof data.providerCallCount === "number" ? data.providerCallCount : 0,
    failNext: data.failNext === true,
  };
}

export async function resetHarnessFakeMapbox(): Promise<void> {
  if (!isHarnessFakeMapboxActive()) return;
  await getFirestore().doc(HARNESS_STATS_DOC).set({
    providerCallCount: 0,
    failNext: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function setHarnessFakeMapboxFailNext(fail: boolean): Promise<void> {
  if (!isHarnessFakeMapboxActive()) return;
  await getFirestore().doc(HARNESS_STATS_DOC).set(
    { failNext: fail, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function getHarnessFakeMapboxCallCount(): Promise<number> {
  if (!isHarnessFakeMapboxActive()) return 0;
  const stats = await readHarnessStats();
  return stats.providerCallCount;
}

export async function fetchHarnessFakeDirections(
  profile: RouteProfile,
  start: LngLat,
  end: LngLat,
  waypoints: LngLat[],
): Promise<HarnessFakeDirectionsRoute> {
  if (!isHarnessFakeMapboxActive()) {
    throw new Error("harness fake mapbox is not active");
  }

  const ref = getFirestore().doc(HARNESS_STATS_DOC);
  const failNext = await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const shouldFail = data.failNext === true;
    const current =
      typeof data.providerCallCount === "number" ? data.providerCallCount : 0;
    tx.set(
      ref,
      {
        providerCallCount: current + 1,
        failNext: shouldFail ? false : data.failNext === true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return shouldFail;
  });

  if (failNext) {
    throw new Error("harness fake mapbox intentional failure");
  }

  const coords: [number, number][] = [start];
  for (const w of waypoints) coords.push(w);
  coords.push(end);

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const straightDeg = Math.sqrt(dx * dx + dy * dy) * 111_320;
  const profileFactor = profile === "walking" ? 1.08 : profile === "driving" ? 1.18 : 1.12;
  const distance = Math.max(250, straightDeg * profileFactor);
  const duration = distance / (profile === "walking" ? 1.4 : profile === "driving" ? 13 : 5);

  return {
    geometry: { type: "LineString", coordinates: coords },
    distance,
    duration,
  };
}

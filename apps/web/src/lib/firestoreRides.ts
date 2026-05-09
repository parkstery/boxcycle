import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { StoredRideSession } from "./rideSessionsStorage";

const RIDES_COLLECTION = "rides";

type RideDoc = {
  userId: string;
  roomId: string | null;
  courseId: string | null;
  profile: "cycling" | "driving" | "walking";
  startedAt: Timestamp | null;
  endedAt: Timestamp;
  elapsedSec: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  caloriesEstimate: number;
  routeDistanceMeters: number;
  routeDurationSec: number;
  source: "web";
  status: "completed";
  createdAt: unknown;
  updatedAt: unknown;
};

export async function saveRideSessionToFirestore(input: {
  userId: string;
  roomId: string | null;
  profile: "cycling" | "driving" | "walking";
  session: StoredRideSession;
}): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  const endedAtDate = new Date(input.session.endedAt);
  const endedAt = Number.isNaN(endedAtDate.getTime())
    ? Timestamp.now()
    : Timestamp.fromDate(endedAtDate);

  const docData: RideDoc = {
    userId: input.userId,
    roomId: input.roomId,
    courseId: null,
    profile: input.profile,
    startedAt: null,
    endedAt,
    elapsedSec: input.session.elapsedSec,
    distanceMeters: input.session.distanceMeters,
    avgSpeedKmh: input.session.avgSpeedKmh,
    caloriesEstimate: input.session.caloriesEstimate,
    routeDistanceMeters: input.session.routeDistanceMeters,
    routeDurationSec: input.session.routeDurationSec,
    source: "web",
    status: "completed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await addDoc(collection(db, RIDES_COLLECTION), docData);
}

export async function backfillRideSessionsToFirestore(input: {
  userId: string;
  roomId: string | null;
  profile: "cycling" | "driving" | "walking";
  sessions: StoredRideSession[];
}): Promise<void> {
  const ordered = [...input.sessions]
    .filter((s) => s && Number.isFinite(s.elapsedSec))
    .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
  for (const session of ordered) {
    await saveRideSessionToFirestore({
      userId: input.userId,
      roomId: input.roomId,
      profile: input.profile,
      session,
    });
  }
}

export async function loadRecentRideSessionsFromFirestore(
  userId: string,
  limitCount = 50,
): Promise<StoredRideSession[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, RIDES_COLLECTION),
    where("userId", "==", userId),
    orderBy("endedAt", "desc"),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<RideDoc>;
    const endedAt =
      data.endedAt instanceof Timestamp
        ? data.endedAt.toDate().toISOString()
        : new Date().toISOString();
    return {
      id: d.id,
      endedAt,
      elapsedSec: Number(data.elapsedSec ?? 0),
      distanceMeters: Number(data.distanceMeters ?? 0),
      avgSpeedKmh: Number(data.avgSpeedKmh ?? 0),
      caloriesEstimate: Number(data.caloriesEstimate ?? 0),
      routeDistanceMeters: Number(data.routeDistanceMeters ?? 0),
      routeDurationSec: Number(data.routeDurationSec ?? 0),
    };
  });
}

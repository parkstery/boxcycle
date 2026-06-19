import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  GeoPoint,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName, getPresenceMemberType, type PresenceMemberType } from "./authDisplay";
import { getFirebaseApp } from "./firebase";
import type { LngLat } from "./geo";
import { isMemberRecentlySeen, lastSeenAtToMillis } from "./firestoreTrail";

/** Phase 6 — 동일 출판(`publicationId`) 세션 멤버십. `publicationPresence` 집계와 별개. */
export const PUBLICATION_SESSIONS_COLLECTION = "publicationSessions" as const;
export const PUBLICATION_SESSION_MEMBERS_SUBCOLLECTION = "members" as const;

export type PublicationSessionMemberRow = {
  uid: string;
  displayName: string | null;
  memberType: PresenceMemberType | null;
  lastSeenAtMs: number | null;
  liveLngLat: LngLat | null;
};

export const isPublicationSessionMemberActive = isMemberRecentlySeen;

export const PUBLICATION_SESSION_LIVE_SHARE_INTERVAL_MS = 2000;

function membersCollectionRef(publicationId: string) {
  const db = getFirestore(getFirebaseApp());
  return collection(
    db,
    PUBLICATION_SESSIONS_COLLECTION,
    publicationId.trim(),
    PUBLICATION_SESSION_MEMBERS_SUBCOLLECTION,
  );
}

function parseLiveLngLat(data: Record<string, unknown>): LngLat | null {
  const lng = data.liveLng;
  const lat = data.liveLat;
  if (typeof lng === "number" && typeof lat === "number" && Number.isFinite(lng) && Number.isFinite(lat)) {
    return [lng, lat];
  }
  const gp = data.liveGeo;
  if (gp instanceof GeoPoint) {
    return [gp.longitude, gp.latitude];
  }
  return null;
}

export async function upsertPublicationSessionMember(user: User, publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, PUBLICATION_SESSIONS_COLLECTION, id, PUBLICATION_SESSION_MEMBERS_SUBCOLLECTION, user.uid);
  await setDoc(
    ref,
    {
      memberType: getPresenceMemberType(user),
      displayName: getPresenceDisplayName(user),
      photoURL: user.photoURL ?? null,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function touchPublicationSessionMember(user: User, publicationId: string): Promise<void> {
  await upsertPublicationSessionMember(user, publicationId);
}

export async function mergePublicationSessionMemberLiveLocation(
  user: User,
  publicationId: string,
  lngLat: LngLat | null,
): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, PUBLICATION_SESSIONS_COLLECTION, id, PUBLICATION_SESSION_MEMBERS_SUBCOLLECTION, user.uid);
  if (lngLat) {
    await setDoc(
      ref,
      {
        memberType: getPresenceMemberType(user),
        displayName: getPresenceDisplayName(user),
        photoURL: user.photoURL ?? null,
        liveLng: lngLat[0],
        liveLat: lngLat[1],
        lastSeenAt: serverTimestamp(),
      },
      { merge: true },
    );
  } else {
    await setDoc(
      ref,
      {
        memberType: getPresenceMemberType(user),
        displayName: getPresenceDisplayName(user),
        photoURL: user.photoURL ?? null,
        liveLng: deleteField(),
        liveLat: deleteField(),
        lastSeenAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export async function deletePublicationSessionMember(uid: string, publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, PUBLICATION_SESSIONS_COLLECTION, id, PUBLICATION_SESSION_MEMBERS_SUBCOLLECTION, uid));
}

export function subscribePublicationSessionMembers(
  publicationId: string,
  onChange: (members: PublicationSessionMemberRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    membersCollectionRef(publicationId),
    (snap) => {
      const rows: PublicationSessionMemberRow[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const mt = data.memberType;
        const memberType: PresenceMemberType | null =
          mt === "guest" || mt === "user" ? mt : null;
        return {
          uid: d.id,
          displayName: typeof data.displayName === "string" ? data.displayName : null,
          memberType,
          lastSeenAtMs: lastSeenAtToMillis(data.lastSeenAt),
          liveLngLat: parseLiveLngLat(data),
        };
      });
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}

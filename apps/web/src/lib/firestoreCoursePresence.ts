/**
 * @deprecated Phase 6 — {@link ./firestorePublicationSessionPresence.ts} 사용.
 */
import type { User } from "firebase/auth";
import type { FirestoreError, Unsubscribe } from "firebase/firestore";
import type { LngLat } from "./geo";
import {
  deletePublicationSessionMember,
  isPublicationSessionMemberActive,
  mergePublicationSessionMemberLiveLocation,
  PUBLICATION_SESSION_LIVE_SHARE_INTERVAL_MS,
  subscribePublicationSessionMembers,
  touchPublicationSessionMember,
  upsertPublicationSessionMember,
  type PublicationSessionMemberRow,
} from "./firestorePublicationSessionPresence";

export type CourseMemberRow = PublicationSessionMemberRow;
export const isCourseMemberActive = isPublicationSessionMemberActive;
export const COURSE_LIVE_SHARE_INTERVAL_MS = PUBLICATION_SESSION_LIVE_SHARE_INTERVAL_MS;

export async function upsertCoursePresence(user: User, publicationId: string): Promise<void> {
  await upsertPublicationSessionMember(user, publicationId);
}

export async function touchCoursePresence(user: User, publicationId: string): Promise<void> {
  await touchPublicationSessionMember(user, publicationId);
}

export async function mergeCourseMemberLiveLocation(
  user: User,
  publicationId: string,
  lngLat: LngLat | null,
): Promise<void> {
  await mergePublicationSessionMemberLiveLocation(user, publicationId, lngLat);
}

export async function deleteCoursePresence(uid: string, publicationId: string): Promise<void> {
  await deletePublicationSessionMember(uid, publicationId);
}

export function subscribeCourseMembers(
  publicationId: string,
  onChange: (members: CourseMemberRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  return subscribePublicationSessionMembers(publicationId, onChange, onError);
}

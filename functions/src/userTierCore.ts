import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export type ServerUserTier = "anonymous" | "registered_free" | "registered_paid" | "admin";

/** Auth·users 문서 동기 — 익명은 tier anonymous(미설정 시만), 연동 계정은 tier 클라이언트 승격에 맡김 */
export async function mergeUserAuthMeta(uid: string): Promise<{ isAnonymous: boolean }> {
  const userRecord = await getAuth().getUser(uid);
  const isAnonymous = userRecord.providerData.length === 0;
  const ref = getFirestore().doc(`users/${uid}`);
  const snap = await ref.get();
  const existingTier = snap.data()?.tier as string | undefined;

  const patch: Record<string, unknown> = {
    isAnonymous,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (isAnonymous) {
    if (!existingTier || existingTier.length === 0) {
      patch.tier = "anonymous" satisfies ServerUserTier;
      patch.tierUpdatedAt = FieldValue.serverTimestamp();
    }
  }

  await ref.set(patch, { merge: true });
  return { isAnonymous };
}

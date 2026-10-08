/**
 * 체중·강도 서버 저장 — userPrivate/{uid}(본인만 읽기·쓰기, firestore.rules).
 * users/{uid} 는 로그인 사용자 전원이 읽으므로 여기에 두지 않는다.
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "../../firebase/app";
import type { CalorieCloudSnapshot } from "../calorieProfileSync";
import { parseCalorieProfile, type CalorieProfile } from "./calorieProfileLocal";

export const USER_PRIVATE_COLLECTION = "userPrivate";

/**
 * 캐시만 본 단계는 `pending` 으로 넘긴다 — 처음 쓰는 기기의 빈 캐시를 「서버에 없음」으로
 * 오해하면 낡은 로컬 값이 다른 기기에서 넣은 값을 덮어쓴다.
 */
export function subscribeCalorieProfileCloud(
  uid: string,
  cb: (snap: CalorieCloudSnapshot) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!uid) return () => {};
  const ref = doc(getFirebaseFirestore(), USER_PRIVATE_COLLECTION, uid);
  return onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.exists()) {
        cb({ kind: "present", profile: parseCalorieProfile(snap.data()) });
      } else {
        cb(snap.metadata.fromCache ? { kind: "pending" } : { kind: "missing" });
      }
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  );
}

export async function writeCalorieProfileCloud(uid: string, profile: CalorieProfile): Promise<void> {
  if (!uid) return;
  await setDoc(doc(getFirebaseFirestore(), USER_PRIVATE_COLLECTION, uid), {
    weightKg: profile.weightKg,
    intensityId: profile.intensityId,
    updatedAt: serverTimestamp(),
  });
}

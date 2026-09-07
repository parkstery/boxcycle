/**
 * F3: rides/{rideId}.conquestResult 구독.
 * RideEndResult의 serverRideId로 해당 문서를 subscribe하고 conquestResult를 반환한다.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseFirestore } from "../lib/firebase";
import {
  EMPTY_CONQUEST_RESULT,
  parseConquestResult,
  isRideOwnedByUser,
  isRideIdMatch,
  type RideConquestResult,
} from "../lib/rideConquestResult";

export type UseRideConquestResultOptions = {
  /** F3: Firestore rides/{} doc ID. null이면 구독 안 함 */
  serverRideId: string | null | undefined;
  /** 현재 로그인 사용자 uid. conquestResult는 본인 주행만 읽는다 (F5 ownership) */
  userId: string | null | undefined;
  /** 이 result의 로컬 recordId — F5 late response ownership 체크용 */
  localRecordId: string;
};

/**
 * rides/{serverRideId}.conquestResult 구독 hook.
 * F3: 계정 총계 − baseline 패턴 제거. CF 결과를 직접 읽는다.
 */
export function useRideConquestResult(
  options: UseRideConquestResultOptions,
): RideConquestResult {
  const { serverRideId, userId, localRecordId } = options;
  const [result, setResult] = useState<RideConquestResult>(EMPTY_CONQUEST_RESULT);

  useEffect(() => {
    if (!serverRideId || !userId) {
      setResult(EMPTY_CONQUEST_RESULT);
      return;
    }

    const db = getFirebaseFirestore();
    const docRef = doc(db, "rides", serverRideId);

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          setResult({ status: "error", newMeters: 0 });
          return;
        }

        const data = snap.data();
        // F5: userId 일치 확인 (다른 사용자의 주행 결과를 내 result로 표시하지 않음)
        if (!isRideOwnedByUser(data?.userId as string | undefined, userId)) {
          setResult({ status: "error", newMeters: 0 });
          return;
        }

        // F5: delayed snap guard — active serverRideId 변경 후 늦은 응답 거부
        if (!isRideIdMatch(serverRideId, snap.id)) {
          setResult({ status: "error", newMeters: 0 });
          return;
        }

        const conquestResult = data?.conquestResult as
          | Record<string, unknown>
          | null
          | undefined;
        setResult(parseConquestResult(conquestResult));
      },
      (error) => {
        console.warn(`[useRideConquestResult] rides/${serverRideId} 구독 실패:`, error);
        setResult({ status: "error", newMeters: 0 });
      },
    );

    return () => unsubscribe();
  }, [serverRideId, userId, localRecordId]);

  return result;
}

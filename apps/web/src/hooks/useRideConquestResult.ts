/**
 * F3: rides/{rideId}.conquestResult 구독.
 * S1-2: Now uses RideConquestSubscription production controller.
 */
import { onSnapshot } from "firebase/firestore";
import { useEffect, useState, useRef } from "react";
import { getFirebaseFirestore } from "../lib/firebase";
import {
  EMPTY_CONQUEST_RESULT,
  type RideConquestResult,
} from "../lib/rideConquestResult";
import {
  RideConquestSubscription,
  type RideConquestSubscriptionKey,
} from "../lib/rideConquestSubscription";

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
 * S1-2: Now uses RideConquestSubscription production controller.
 */
export function useRideConquestResult(
  options: UseRideConquestResultOptions,
): RideConquestResult {
  const { serverRideId, userId, localRecordId } = options;
  const [result, setResult] = useState<RideConquestResult>(EMPTY_CONQUEST_RESULT);
  const subscriptionRef = useRef<RideConquestSubscription | null>(null);

  useEffect(() => {
    if (!serverRideId || !userId) {
      setResult(EMPTY_CONQUEST_RESULT);
      return;
    }

    // S1-2: Create production subscription controller (once)
    if (!subscriptionRef.current) {
      const db = getFirebaseFirestore();
      subscriptionRef.current = new RideConquestSubscription(
        {
          firestore: db,
          subscribe: onSnapshot,
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
        {
          onResult: setResult,
        },
      );
    }

    // S1-2: Activate with current key
    const key: RideConquestSubscriptionKey = {
      userId,
      localRecordId,
      serverRideId,
    };
    subscriptionRef.current.activate(key);

    return () => {
      subscriptionRef.current?.dispose();
    };
  }, [serverRideId, userId, localRecordId]);

  return result;
}

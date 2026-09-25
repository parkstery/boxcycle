import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "../lib/firebase/app";
import type { SharedElevationStore } from "../lib/route/fetchRouteElevations";

/**
 * 경로 표고의 영구 저장소 (`RIDE-ELEVATION-QUOTA-1` D2 — 호출 구조 축소).
 *
 * 도로의 고도는 변하지 않는다. 그런데 지금까지는 같은 경로를 누가 몇 번 달리든 매번
 * 72콜이 나갔다. 경로당 한 번만 받아 여기에 남기면 호출량이 「주행 수」가 아니라
 * **「경로 수」**로 떨어진다 — 자릿수가 바뀐다. 두 번째 주행자부터는 Firestore 읽기 1회다.
 *
 * 문서는 **덮어쓰지 않는다**(rules 도 create 만 허용). 같은 키는 같은 기하이므로
 * 값이 달라질 이유가 없고, 뒤늦게 들어온 값이 앞의 값을 밀어낼 이유도 없다.
 */
const COLLECTION = "routeElevations";

/** 표고로 말이 되는 범위 — 사해(-430m)와 에베레스트(8849m) 바깥은 저장하지 않는다. */
const MIN_ELEVATION_M = -500;
const MAX_ELEVATION_M = 9000;
const MAX_SAMPLES = 256;

export function isStorableElevationValues(values: unknown): values is number[] {
  return (
    Array.isArray(values) &&
    values.length >= 2 &&
    values.length <= MAX_SAMPLES &&
    values.every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= MIN_ELEVATION_M && v <= MAX_ELEVATION_M,
    )
  );
}

/**
 * Firestore 어댑터. 표고는 **있으면 좋은 것**이지 주행을 막을 것이 아니므로,
 * 실패(비로그인·권한·오프라인)는 전부 삼키고 호출부는 실제 질의로 넘어간다.
 */
export const firestoreElevationStore: SharedElevationStore = {
  async read(key: string): Promise<number[] | null> {
    if (!key) return null;
    try {
      const snap = await getDoc(doc(getFirebaseFirestore(), COLLECTION, key));
      if (!snap.exists()) return null;
      const values = (snap.data() as { values?: unknown }).values;
      // 축퇴 방어 — 저장소에 이상한 값이 들어 있으면 없는 것으로 치고 다시 받는다.
      return isStorableElevationValues(values) ? values : null;
    } catch {
      return null;
    }
  },

  async write(key: string, values: number[]): Promise<void> {
    if (!key || !isStorableElevationValues(values)) return;
    try {
      await setDoc(doc(getFirebaseFirestore(), COLLECTION, key), {
        values,
        sampleCount: values.length,
        source: "open-meteo",
        createdAt: serverTimestamp(),
      });
    } catch {
      // 이미 있거나(동시 주행) 권한이 없을 뿐 — 다음 사람이 한 번 더 물으면 된다.
    }
  },
};

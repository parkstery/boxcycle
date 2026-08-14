import { useSyncExternalStore } from "react";
import { getTickTestOffList, subscribeTickTest } from "../../lib/tickTestSwitches";

/** DEV — 꺼진 틱 스위치만 표시. 전부 켜면 d4c8fbf 와 같이 안 보임. */
export function TickTestOffBadge() {
  const off = useSyncExternalStore(subscribeTickTest, getTickTestOffList, getTickTestOffList);
  if (!import.meta.env.DEV || off.length === 0) return null;
  return (
    <div className="map-view__tick-test" aria-live="polite">
      tick off: {off.join(" ")}
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RecentRoadDisplaySession, type RecentRoadInput } from "../lib/conquest/recentNewRoadDisplay";
import type { LineStringGeometry } from "../lib/geo/geo";
import type { RideConquestResult } from "../lib/ride/rideConquestResult";

export function useRecentRoadDisplay(input: RecentRoadInput) {
  const session = useRef(new RecentRoadDisplaySession());
  const latest = useRef(input);
  const [state, setState] = useState<{ uid: string | null; geometry: LineStringGeometry[] }>({ uid: null, geometry: [] });
  const { uid, active, persisted, cellIds, route, traveled, from, ended } = input;
  useLayoutEffect(() => {
    latest.current = { uid, active, persisted, cellIds, route, traveled, from, ended };
  }, [uid, active, persisted, cellIds, route, traveled, from, ended]);
  useEffect(() => {
    setState({ uid, geometry: session.current.advance({ uid, active, persisted, cellIds, route, traveled, from, ended }) });
  }, [uid, active, persisted, cellIds, route, traveled, from, ended]);
  const onResult = useCallback((recordId: string, result: RideConquestResult) => {
    // Child result effects can run before the parent's end-transition effect.
    session.current.advance(latest.current);
    setState({ uid: latest.current.uid, geometry: session.current.result(recordId, result) });
  }, []);
  const onTimeout = useCallback((recordId: string) => {
    session.current.advance(latest.current);
    setState({ uid: latest.current.uid, geometry: session.current.timeout(recordId) });
  }, []);
  return { geometry: state.uid === uid && uid ? state.geometry : [], onResult, onTimeout };
}

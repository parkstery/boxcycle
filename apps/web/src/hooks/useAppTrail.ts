import { useCallback, useEffect, useState } from "react";
import { sanitizeTrailId } from "../lib/firestoreTrail";
import { readTrailIdFromLocation, replaceTrailInUrl } from "../lib/trailUrl";

/**
 * Trail ID와 `?trail=`(하위 호환 `?room=`) URL 동기화. `popstate` 시 둘 다 갱신.
 */
export function useAppTrail() {
  const [trailId, setTrailId] = useState(readTrailIdFromLocation);
  const [trailDraft, setTrailDraft] = useState(readTrailIdFromLocation);

  useEffect(() => {
    const onPop = () => {
      const next = readTrailIdFromLocation();
      setTrailId(next);
      setTrailDraft(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const applyTrailFromDraft = useCallback(() => {
    const next = sanitizeTrailId(trailDraft);
    setTrailDraft(next);
    setTrailId(next);
    replaceTrailInUrl(next);
  }, [trailDraft]);

  return { trailId, setTrailId, trailDraft, setTrailDraft, applyTrailFromDraft };
}

/** @deprecated `useAppTrail` */
export function useAppRoom() {
  const t = useAppTrail();
  return {
    roomId: t.trailId,
    setRoomId: t.setTrailId,
    roomDraft: t.trailDraft,
    setRoomDraft: t.setTrailDraft,
    applyRoomFromDraft: t.applyTrailFromDraft,
  };
}

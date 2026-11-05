import { useCallback, useState } from "react";
import {
  loadListRegion,
  loadRecentRegions,
  pushRecentRegion,
  saveListRegion,
  saveRecentRegions,
  WORLD_REGION,
  type ListRegionKey,
  type ListRegionListId,
} from "../lib/geo/listRegionFilter";

/** 목록 지역 칩의 상태 — 마지막 범위(목록별)와 최근 고른 곳(공용)을 기기에 기억한다. 처음은 세계. */
export function useListRegion(listId: ListRegionListId) {
  const [region, setRegion] = useState<ListRegionKey>(() => loadListRegion(listId));
  const [recents, setRecents] = useState<ListRegionKey[]>(loadRecentRegions);
  const pick = useCallback(
    (key: ListRegionKey) => {
      setRegion(key);
      saveListRegion(listId, key);
      if (key === WORLD_REGION) return;
      const next = pushRecentRegion(loadRecentRegions(), key);
      setRecents(next);
      saveRecentRegions(next);
    },
    [listId],
  );
  return { region, recents, pick };
}

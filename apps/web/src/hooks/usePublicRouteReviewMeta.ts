import type { User } from "firebase/auth";
import { useCallback, useState } from "react";
import {
  createPublicRouteRequest,
  loadMyPendingRequestRouteIds,
  type ExperienceTagId,
} from "../lib/publicRouteRequests";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";

export type UsePublicRouteReviewMetaOptions = {
  configured: boolean;
  user: User | null;
};

/**
 * 퍼블릭 경로 공개 요청 모달과, 내 대기(pending) 신청 경로 id 집합·새로고침.
 * 퍼블릭 등록은 자동 심사(CF)로 처리되므로 관리자 심사 큐·심사자 판별은 여기서 다루지 않는다.
 */
export function usePublicRouteReviewMeta(options: UsePublicRouteReviewMetaOptions) {
  const { configured, user } = options;

  const [publicRouteRequestModalRoute, setPublicRouteRequestModalRoute] = useState<SavedRoute | null>(null);
  const [pendingPublicRouteIds, setPendingPublicRouteIds] = useState<ReadonlySet<string>>(() => new Set());

  const refreshPublicRouteMeta = useCallback(async () => {
    if (!configured || !user) {
      setPendingPublicRouteIds(new Set());
      return;
    }
    try {
      const mine = await loadMyPendingRequestRouteIds(user.uid);
      setPendingPublicRouteIds(mine);
    } catch {
      setPendingPublicRouteIds(new Set());
    }
  }, [configured, user]);

  const handleSubmitPublicRouteRequest = useCallback(
    async (input: {
      publicTitle: string;
      publicSummary: string;
      experienceTags: ExperienceTagId[];
      namingPolicyAcknowledged: boolean;
    }) => {
      if (!user) return;
      const route = publicRouteRequestModalRoute;
      if (!route) return;
      await createPublicRouteRequest(user, route, input);
      setPublicRouteRequestModalRoute(null);
      await refreshPublicRouteMeta();
    },
    [user, publicRouteRequestModalRoute, refreshPublicRouteMeta],
  );

  return {
    publicRouteRequestModalRoute,
    setPublicRouteRequestModalRoute,
    pendingPublicRouteIds,
    refreshPublicRouteMeta,
    handleSubmitPublicRouteRequest,
  };
}

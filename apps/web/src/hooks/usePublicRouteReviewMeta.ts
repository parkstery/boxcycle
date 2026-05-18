import type { User } from "firebase/auth";
import { useCallback, useState } from "react";
import {
  createPublicRouteRequest,
  isRouteReviewer,
  loadMyPendingRequestRouteIds,
  loadPendingPublicRouteRequests,
  type ExperienceTagId,
} from "../lib/publicRouteRequests";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";

export type UsePublicRouteReviewMetaOptions = {
  configured: boolean;
  user: User | null;
};

/**
 * 퍼블릭 경로 공개 요청 모달, 심사자 여부·대기 id·심사 큐 건수, 메타 새로고침.
 */
export function usePublicRouteReviewMeta(options: UsePublicRouteReviewMetaOptions) {
  const { configured, user } = options;

  const [publicRouteRequestModalRoute, setPublicRouteRequestModalRoute] = useState<SavedRoute | null>(null);
  const [isPublicRouteReviewer, setIsPublicRouteReviewer] = useState(false);
  const [pendingPublicRouteIds, setPendingPublicRouteIds] = useState<ReadonlySet<string>>(() => new Set());
  const [publicRouteReviewQueueCount, setPublicRouteReviewQueueCount] = useState(0);

  const refreshPublicRouteMeta = useCallback(async () => {
    if (!configured || !user) {
      setIsPublicRouteReviewer(false);
      setPendingPublicRouteIds(new Set());
      setPublicRouteReviewQueueCount(0);
      return;
    }
    try {
      const rev = await isRouteReviewer(user);
      setIsPublicRouteReviewer(rev);
      const mine = await loadMyPendingRequestRouteIds(user.uid);
      setPendingPublicRouteIds(mine);
      if (rev) {
        const q = await loadPendingPublicRouteRequests();
        setPublicRouteReviewQueueCount(q.length);
      } else {
        setPublicRouteReviewQueueCount(0);
      }
    } catch {
      setIsPublicRouteReviewer(false);
      setPendingPublicRouteIds(new Set());
      setPublicRouteReviewQueueCount(0);
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
    isPublicRouteReviewer,
    pendingPublicRouteIds,
    publicRouteReviewQueueCount,
    refreshPublicRouteMeta,
    handleSubmitPublicRouteRequest,
  };
}

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import {
  rollbackPublicRouteRequestIfOverQuota,
  rollbackSavedRouteIfOverQuota,
} from "./tierQuotaCore.js";

/** 클라이언트 우회 create 시 quota 초과 문서 삭제 */
export const savedRoutesTierQuotaGuard = onDocumentCreated(
  {
    document: "savedRoutes/{routeId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const userId = snap.data()?.userId;
    if (typeof userId !== "string" || !userId.trim()) return;
    await rollbackSavedRouteIfOverQuota(event.params.routeId, userId.trim());
  },
);

export const publicRouteRequestsTierQuotaGuard = onDocumentCreated(
  {
    document: "publicRouteRequests/{requestId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const uid = snap.data()?.applicantUid;
    if (typeof uid !== "string" || !uid.trim()) return;
    await rollbackPublicRouteRequestIfOverQuota(event.params.requestId, uid.trim());
  },
);

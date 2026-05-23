import { onSchedule } from "firebase-functions/v2/scheduler";
import { purgeStaleOpenTrailListings } from "./openTrailListingCore.js";

/** listing `updatedAt` 90초 초과 유령 문서 정리 */
export const openTrailListingsSweep = onSchedule(
  {
    schedule: "every 2 minutes",
    region: "asia-northeast3",
    timeZone: "Asia/Seoul",
  },
  async () => {
    const purged = await purgeStaleOpenTrailListings(80);
    if (purged > 0) {
      console.info("[openTrailListingsSweep] purged", { purged });
    }
  },
);

import { onSchedule } from "firebase-functions/v2/scheduler";
import { purgeStaleOpenTrailListings } from "./openTrailListingCore.js";
import { REGION } from "./region.js";

/** listing updatedAt stale 정리 — 10분 주기 */
export const openTrailListingsSweep = onSchedule(
  {
    schedule: "every 10 minutes",
    region: REGION,
    timeZone: "Asia/Seoul",
  },
  async () => {
    const purged = await purgeStaleOpenTrailListings(80);
    if (purged > 0) {
      console.info("[openTrailListingsSweep] purged", { purged });
    }
  },
);

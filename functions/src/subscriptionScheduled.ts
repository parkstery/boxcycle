import { onSchedule } from "firebase-functions/v2/scheduler";
import { sweepExpiredSubscriptions } from "./subscriptionCore.js";

/** KST 04:00 — 만료된 registered_paid 강등 */
export const subscriptionExpireSweep = onSchedule(
  {
    schedule: "0 19 * * *",
    timeZone: "UTC",
    region: "asia-northeast3",
  },
  async () => {
    const n = await sweepExpiredSubscriptions(500);
    if (n > 0) {
      console.info("[subscriptionExpireSweep] downgraded", n);
    }
  },
);

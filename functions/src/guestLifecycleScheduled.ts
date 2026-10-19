/**
 * Guest 수명 정리 — 매일 KST 03:15. 삭제는 작은 배치만, 실패는 다음 실행이 이어 받는다.
 *
 * RTDB 초기화 실패는 null 로 남긴다. 이 경우 guestRtdbPort 가 삭제 계열 쓰기를 거부해
 * 해당 uid 는 실패·재시도 상태로 남는다 — RTDB 재쓰기 차단 없이 개인 데이터·Auth 만
 * 지우는 일이 없다(66-supervisor-findings-02 §HTTP 초안).
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getRtdbOrNull, guestLifecyclePortsFromAdmin } from "./guestLifecycleAdmin.js";
import { runGuestLifecycleSweep } from "./guestLifecycleCore.js";
import { REGION } from "./region.js";

export const guestLifecycleSweep = onSchedule(
  {
    schedule: "15 3 * * *",
    timeZone: "Asia/Seoul",
    region: REGION,
    timeoutSeconds: 540,
  },
  async () => {
    const rtdb = getRtdbOrNull();
    const nowMs = Date.now();
    const report = await runGuestLifecycleSweep(await guestLifecyclePortsFromAdmin(getFirestore(), getAuth(), rtdb, nowMs));
    if (rtdb == null) console.error("[guestLifecycleSweep] RTDB 초기화 실패 — 삭제는 실패·재시도로 남는다");
    console.info("[guestLifecycleSweep]", report);
  },
);

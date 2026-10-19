/**
 * Guest 복원·로그아웃·Google 연결의 클라이언트 동작.
 * 서버·Rules·에뮬레이터는 쓰지 않는다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
  },
});

const restore = await import("../../src/lib/identity/authRestore.ts");
const cache = await import("../../src/lib/identity/uidLocalCache.ts");
const link = await import("../../src/lib/identity/guestGoogleLink.ts");
const activity = await import("../../src/lib/identity/guestActivity.ts");
const persistence = await import("../../src/lib/identity/authPersistence.ts");
const resume = await import("../../src/lib/identity/guestResume.ts");

test("초기 null 은 자동 Guest 를 열지 않고, 복원 확정 후에만 빈 세션이 된다", () => {
  let state = restore.INITIAL_AUTH_EXPOSURE;
  state = restore.reduceAuthExposure(state, { type: "early-null" });
  assert.equal(state.phase, "booting");
  assert.equal(state.blockAutoAnonymous, true);
  state = restore.reduceAuthExposure(state, { type: "cleared" });
  assert.equal(state.blockAutoAnonymous, true, "부트 중 cleared 도 새 Guest 를 허용하면 안 된다");
  state = restore.reduceAuthExposure(state, { type: "persistence-empty" });
  assert.equal(state.phase, "ready");
  assert.equal(state.blockAutoAnonymous, false);
});

test("복원 중인 계정이 있으면 뒤늦은 빈 세션 신호가 새 Guest 를 열지 않는다", () => {
  let state = restore.reduceAuthExposure(restore.INITIAL_AUTH_EXPOSURE, { type: "candidate", uid: "kept" });
  state = restore.reduceAuthExposure(state, { type: "persistence-empty" });
  state = restore.reduceAuthExposure(state, { type: "early-null" });
  assert.equal(state.phase, "verifying");
  assert.equal(state.pendingUid, "kept");
  assert.equal(state.blockAutoAnonymous, true);
  assert.equal(state.exposedUid, null);
});

test("네트워크 오류는 사용자를 노출하지 않고 재시도 상태로 남긴다", () => {
  let state = restore.reduceAuthExposure(restore.INITIAL_AUTH_EXPOSURE, { type: "candidate", uid: "guest-1" });
  state = restore.reduceAuthExposure(state, { type: "offline", uid: "guest-1" });
  assert.equal(state.phase, "offline");
  assert.equal(state.exposedUid, null);
  assert.equal(state.pendingUid, "guest-1");
  assert.equal(state.blockAutoAnonymous, true);
  assert.equal(state.expiryKind, null);
});

test("계정이 없을 때만 uid 캐시를 지운다. 비활성·토큰 무효는 남긴다", () => {
  assert.equal(restore.expiryClearsUidCache("auth/user-not-found"), true);
  for (const code of ["auth/user-disabled", "auth/user-token-expired", "auth/invalid-user-token", "auth/user-token-revoked"]) {
    assert.equal(restore.expiryClearsUidCache(code), false, code);
  }
  memory.clear();
  memory.set("boxcycle_ride_resume_slot_v1_gone", "slot");
  memory.set("boxcycle_calorie_profile_v1_gone", "cal");
  memory.set("boxcycle_ride_resume_slot_v1_kept", "slot");
  memory.set("boxcycle_other_app_key", "stay");
  cache.clearUidLocalCache("gone");
  assert.equal(memory.get("boxcycle_ride_resume_slot_v1_gone"), undefined);
  assert.equal(memory.get("boxcycle_calorie_profile_v1_gone"), undefined);
  assert.equal(memory.get("boxcycle_ride_resume_slot_v1_kept"), "slot");
  assert.equal(memory.get("boxcycle_other_app_key"), "stay");
});

test("확인 성공 전에는 user 를 노출하지 않는다", () => {
  const state = restore.reduceAuthExposure(restore.INITIAL_AUTH_EXPOSURE, { type: "candidate", uid: "pending" });
  assert.equal(state.exposedUid, null);
  const ready = restore.reduceAuthExposure(state, { type: "verified", uid: "pending" });
  assert.equal(ready.exposedUid, "pending");
  assert.equal(ready.blockAutoAnonymous, false);
});

test("reload 가 계정을 못 찾으면 만료, 네트워크면 오프라인", async () => {
  const missing = await restore.verifyRestoredAuthUser({
    reload: async () => {
      throw { code: "auth/user-not-found" };
    },
    getIdToken: async () => "token",
  });
  assert.equal(missing.kind, "expired");
  if (missing.kind === "expired") assert.equal(missing.clearCache, true);

  const disabled = await restore.verifyRestoredAuthUser({
    reload: async () => {
      throw { code: "auth/user-disabled" };
    },
    getIdToken: async () => "token",
  });
  assert.equal(disabled.kind, "expired");
  if (disabled.kind === "expired") assert.equal(disabled.clearCache, false);

  const offline = await restore.verifyRestoredAuthUser({
    reload: async () => {
      throw { code: "auth/network-request-failed" };
    },
    getIdToken: async () => "token",
  });
  assert.equal(offline.kind, "offline");
});

test("Google 팝업은 lease 응답을 기다리지 않고 같은 턴에 연다", async () => {
  let popupAt = "";
  let resolveLease: (value: { ok: true; leaseToken: string }) => void = () => {};
  const leasePromise = new Promise<{ ok: true; leaseToken: string }>((resolve) => {
    resolveLease = resolve;
  });
  let completed = "";
  const pending = link.runGuestGoogleLink({
    beginLease: () => leasePromise,
    openLinkPopup: () => {
      popupAt = "same-turn";
      return Promise.resolve();
    },
    completeLease: async (token) => {
      completed = token;
    },
    cancelLease: async () => {},
    signIntoExistingAccount: async () => {},
    isExistingAccountError: () => false,
    isPopupCancel: () => false,
  });
  assert.equal(popupAt, "same-turn");
  resolveLease({ ok: true, leaseToken: "lease-1" });
  assert.equal(await pending, "linked");
  assert.equal(completed, "lease-1");
});

test("이미 있는 Google 계정으로 바꿀 때 삭제하지 않고 그 계정으로 들어간다", async () => {
  const calls: string[] = [];
  const outcome = await link.runGuestGoogleLink({
    beginLease: async () => ({ ok: true, leaseToken: "lease-2" }),
    openLinkPopup: async () => {
      throw { code: "auth/credential-already-in-use" };
    },
    completeLease: async () => {
      calls.push("complete");
    },
    cancelLease: async () => {
      calls.push("cancel");
    },
    signIntoExistingAccount: async () => {
      calls.push("existing");
    },
    isExistingAccountError: (error) => (error as { code?: string }).code === "auth/credential-already-in-use",
    isPopupCancel: () => false,
  });
  assert.equal(outcome, "existing");
  assert.deepEqual(calls, ["cancel", "existing"]);
});

test("삭제 예약이면 연결 완료를 호출하지 않는다", async () => {
  let completed = false;
  const outcome = await link.runGuestGoogleLink({
    beginLease: async () => ({ ok: false, reason: "deletion-pending", message: null }),
    openLinkPopup: async () => undefined,
    completeLease: async () => {
      completed = true;
    },
    cancelLease: async () => {},
    signIntoExistingAccount: async () => {},
    isExistingAccountError: () => false,
    isPopupCancel: () => false,
  });
  assert.equal(outcome, "blocked-linked");
  assert.equal(completed, false);
});

test("활동 핑은 보일 때 5분마다, 숨기면 보내지 않는다", () => {
  assert.equal(activity.shouldSendGuestActivity(null, 1_000, true), true);
  assert.equal(activity.shouldSendGuestActivity(1_000, 1_000 + activity.GUEST_ACTIVITY_INTERVAL_MS - 1, true), false);
  assert.equal(activity.shouldSendGuestActivity(1_000, 1_000 + activity.GUEST_ACTIVITY_INTERVAL_MS, true), true);
  assert.equal(activity.shouldSendGuestActivity(null, 1_000, false), false);
});

test("인증 지속성은 브라우저 로컬이고 탭 세션이 아니다", () => {
  assert.equal(persistence.AUTH_PERSISTENCE_CONTRACT, "browserLocal");
  assert.equal(persistence.authPersistenceSurvivesBrowserClose(), true);
  assert.equal(persistence.authPersistenceSurvivesBrowserClose("browserSession"), false);
  const app = readFileSync(fileURLToPath(new URL("../../src/lib/firebase/app.ts", import.meta.url)), "utf8");
  assert.match(app, /setPersistence\(getFirebaseAuth\(\), AUTH_BROWSER_PERSISTENCE\)/);
  assert.ok(!app.includes("browserSessionPersistence"));
});

test("만료 안내 문구", () => {
  assert.match(restore.authExpiryNoticeText("guest-expired"), /30일/);
  assert.match(restore.authExpiryNoticeText("account-unavailable"), /사용할 수 없습니다/);
});

test("종료 후 게스트로 시작은 확인된 익명 세션을 다시 쓰고 확정 삭제만 새로 만든다", () => {
  const ready = {
    hasAnonymousSession: true,
    hasGoogleSession: false,
    verifyKind: "ready" as const,
    code: null,
    activity: "ok" as const,
  };
  for (let i = 0; i < 5; i += 1) assert.equal(resume.decideGuestStart(ready), "reuse");
  assert.equal(
    resume.decideGuestStart({ ...ready, verifyKind: "expired", code: "auth/user-not-found", activity: "none" }),
    "create",
  );
  assert.equal(
    resume.decideGuestStart({ ...ready, verifyKind: "expired", code: "auth/user-disabled", activity: "none" }),
    "hold-blocked",
  );
  assert.equal(
    resume.decideGuestStart({ ...ready, activity: "stop" }),
    "hold-blocked",
  );
  assert.equal(
    resume.decideGuestStart({ ...ready, verifyKind: "offline", activity: "none" }),
    "hold-offline",
  );
  assert.equal(
    resume.decideGuestStart({ ...ready, activity: "retry" }),
    "hold-offline",
  );
  assert.equal(
    resume.decideGuestStart({
      hasAnonymousSession: false,
      hasGoogleSession: true,
      verifyKind: "ready",
      code: null,
      activity: "none",
    }),
    "switch-from-google",
  );
  assert.equal(
    resume.decideGuestStart({
      hasAnonymousSession: false,
      hasGoogleSession: false,
      verifyKind: "none",
      code: null,
      activity: "none",
    }),
    "create",
  );
});

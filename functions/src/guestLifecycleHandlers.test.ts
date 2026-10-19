import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUEST_LINK_LEASE_MS,
  MemoryGuestAuth,
  MemoryGuestRtdb,
  MemoryGuestStore,
  blankGuestLifecycleDoc,
  guestLifecyclePath,
  type AuthSnapshot,
  type GuestLifecycleDoc,
  type GuestLifecyclePorts,
  type GuestTx,
} from "./guestLifecycleCore.js";
import {
  handleGuestActivityRequest,
  handleGuestLinkRequest,
} from "./guestLifecycleHandlers.js";
import { isPermanentTokenVerificationError, runGuestLifecycleRequest } from "./guestLifecycleHttp.js";

/**
 * Guest 활동·Google 연결 lease HTTP 본문 계약 (guestLifecycleHandlers).
 *
 * 이 시험은 HTTP handler 층만 본다. Auth/Firestore/RTDB 는 Memory 포트로 대체하고,
 * 현실의 인증 토큰은 verifyToken 스텁으로 대체한다. 토큰 검증 층의 영구·일시 구분은
 * guestLifecycleHttp 의 분류 함수·503 래퍼 계약으로 이 파일 아래에서 검증한다.
 *
 * 운영·비공개 자료는 읽지 않는다.
 */

const NOW = 1_800_000_000_000;
const OLD = NOW - 60 * 24 * 60 * 60 * 1000;

type VerifyToken = (token: string) => Promise<{ uid: string } | null>;

function tokens(entries: Array<[string, string]>): VerifyToken {
  const map: Map<string, { uid: string }> = new Map(
    entries.map(([uid, id]) => [id, { uid }]),
  );
  return async (token) => map.get(token) ?? null;
}

function authUser(uid: string, over: Partial<AuthSnapshot> = {}): AuthSnapshot {
  return { uid, anonymous: false, disabled: false, admin: false, email: null, ...over };
}

function makePorts(store: MemoryGuestStore, auth: MemoryGuestAuth, rtdb: MemoryGuestRtdb): GuestLifecyclePorts {
  return {
    nowMs: NOW,
    store,
    auth,
    rtdb,
    deleteAccountData: async () => undefined,
    protectedUids: new Set<string>(),
    listAuthUsers: async () => auth.list(),
    listProfileUids: async () => [],
    listRetryUids: async () => [],
    readUserProfile: async () => null,
    recentRideOrPresence: async () => false,
    workerId: "glm-task04",
  };
}

async function seedDoc(store: MemoryGuestStore, uid: string, patch: Partial<GuestLifecycleDoc>): Promise<void> {
  await store.runTransaction(async (tx: GuestTx) => {
    tx.set(guestLifecyclePath(uid), { ...blankGuestLifecycleDoc(), ...patch });
  });
}

function errReason(status: number, body: Record<string, unknown>): string {
  const error = body.error as { reason?: string; message?: string } | undefined;
  return `status=${status} reason=${error?.reason ?? "-"} msg=${error?.message ?? "-"}`;
}

describe("guest 활동 갱신 HTTP handler", () => {
  it("405: POST 가 아니면 토큰 검증 전에 거절한다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    const verify = tokens([["guest-1", "tok-guest"]]);
    const out = await handleGuestActivityRequest(
      { method: "GET", authorization: "Bearer tok-guest" },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 405);
  });

  it("401: bearer 가 없거나 토큰 검증이 실패하면 거절하고 상태를 바꾸지 않는다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const verify = tokens([["guest-1", "tok-guest"]]);
    const ports = makePorts(store, auth, new MemoryGuestRtdb());

    const noHeader = await handleGuestActivityRequest(
      { method: "POST", authorization: null },
      { nowMs: NOW, verifyToken: verify, ports },
    );
    assert.equal(noHeader.status, 401);

    const badHeader = await handleGuestActivityRequest(
      { method: "POST", authorization: "tok-guest" },
      { nowMs: NOW, verifyToken: verify, ports },
    );
    assert.equal(badHeader.status, 401);

    const expired = await handleGuestActivityRequest(
      { method: "POST", authorization: "Bearer tok-not-yours" },
      { nowMs: NOW, verifyToken: verify, ports },
    );
    assert.equal(expired.status, 401);

    assert.equal(await store.get(guestLifecyclePath("guest-1")), null);
  });

  it("200: 올바른 게스트 활동을 서버 시각으로 기록한다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestActivityRequest(
      { method: "POST", authorization: "Bearer tok-guest" },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 200);
    const result = out.body.result as { ok: boolean; lastActivityAtMs: number };
    assert.equal(result.ok, true);
    // deps.nowMs 로 들어온 서버 시각 그대로. handler 입력 자체에 클라이언트 시각 자리가 없다.
    assert.equal(result.lastActivityAtMs, NOW);

    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "active");
    assert.equal(doc.lastActivityAtMs, NOW);
    assert.equal(doc.observedAtMs, NOW);
  });

  it("200: linking 중 게스트의 활동도 서버 시각으로 연장하고 linking 을 유지한다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    await seedDoc(store, "guest-1", { status: "linking", linkLeaseToken: "t".repeat(12), linkLeaseUntilMs: NOW + GUEST_LINK_LEASE_MS });
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestActivityRequest(
      { method: "POST", authorization: "Bearer tok-guest" },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 200);

    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "linking");
    assert.equal(doc.lastActivityAtMs, NOW);
  });

  it("409: 삭제가 예약된 게스트는 활동을 연장할 수 없고 마커를 건드리지 않는다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    await seedDoc(store, "guest-1", { status: "deletionScheduled", lastActivityAtMs: OLD });
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestActivityRequest(
      { method: "POST", authorization: "Bearer tok-guest" },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 409, errReason(out.status, out.body));
    const error = out.body.error as { reason: string };
    assert.equal(error.reason, "deletion-pending");

    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "deletionScheduled");
    assert.equal(doc.lastActivityAtMs, OLD);
  });

  it("412: Google 등록 계정은 활동을 갱신하지 않고 데이터를 만지지 않는다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("google-1", authUser("google-1", { anonymous: false, email: "g@example.com" }));
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    await seedDoc(store, "guest-1", { lastActivityAtMs: OLD });
    const verify = tokens([["google-1", "tok-google"]]);

    const out = await handleGuestActivityRequest(
      { method: "POST", authorization: "Bearer tok-google" },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 412, errReason(out.status, out.body));
    const error = out.body.error as { reason: string };
    assert.equal(error.reason, "not-anonymous");

    // 등록 계정은 lifecycle 문서 자체를 만들지 않는다. 다른 게스트 기록도 불변.
    assert.equal(await store.get(guestLifecyclePath("google-1")), null);
    const before = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(before.lastActivityAtMs, OLD);
  });

  it("[계약] 일시 네트워크 실패는 verifyToken 예외 그대로 handler 밖으로 전파된다", () => {
    /*
     * 계약: 만료·무효 토큰은 401("유효하지 않은 인증 토큰"), 일시 네트워크 실패는 5xx가
     * 된다. handler 층은 검증 실패(null=영구)만 401 로 만들고 throw 는 그대로 전파하며,
     * 실제 수신부(guestLifecycleHttp.runGuestLifecycleRequest)가 throw 를 503 JSON 으로
     * 바꾼다 — 일시 장애 때 정상 Guest 를 강제 로그아웃시키지 않는 계약의 기둥 2개.
     * 아래 두 describe 에서 양쪽을 각각 고정한다.
     */
    const verify: VerifyToken = async () => {
      throw new Error("auth/network-request-failed");
    };
    return assert.rejects(
      handleGuestActivityRequest(
        { method: "POST", authorization: "Bearer tok-guest" },
        { nowMs: NOW, verifyToken: verify, ports: makePorts(new MemoryGuestStore(), new MemoryGuestAuth(), new MemoryGuestRtdb()) },
      ),
      /network-request-failed/,
    );
  });
});

describe("guest Google 연결 lease HTTP handler", () => {
  it("405: POST 가 아니면 거절한다", async () => {
    const verify = tokens([["guest-1", "tok-guest"]]);
    const out = await handleGuestLinkRequest(
      { method: "GET", authorization: "Bearer tok-guest", action: "begin", leaseToken: null },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(new MemoryGuestStore(), new MemoryGuestAuth(), new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 405);
  });

  it("401: bearer 가 없거나 토큰 검증이 실패하면 거절한다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const verify = tokens([["guest-1", "tok-guest"]]);
    const ports = makePorts(store, auth, new MemoryGuestRtdb());

    const noHeader = await handleGuestLinkRequest(
      { method: "POST", authorization: null, action: "begin", leaseToken: null },
      { nowMs: NOW, verifyToken: verify, ports },
    );
    assert.equal(noHeader.status, 401);

    const expired = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-expired", action: "begin", leaseToken: null },
      { nowMs: NOW, verifyToken: verify, ports },
    );
    assert.equal(expired.status, 401);
    assert.equal(await store.get(guestLifecyclePath("guest-1")), null);
  });

  it("400: 알 수 없는 action 은 거절한다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "renew", leaseToken: "t".repeat(12) },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 400);
    assert.equal(await store.get(guestLifecyclePath("guest-1")), null);
  });

  it("400: complete·cancel 에 leaseToken 이 없거나 너무 짧으면 거절한다", async () => {
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const verify = tokens([["guest-1", "tok-guest"]]);
    const ports = makePorts(new MemoryGuestStore(), auth, new MemoryGuestRtdb());

    const missing = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "complete", leaseToken: null },
      { nowMs: NOW, verifyToken: verify, ports },
    );
    assert.equal(missing.status, 400);

    const short = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "complete", leaseToken: "t1" },
      { nowMs: NOW, verifyToken: verify, ports },
    );
    assert.equal(short.status, 400);
  });

  it("200: begin 은 게스트에게 2분 lease 토큰을 주고 서버 활동을 갱신한다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "begin", leaseToken: null },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 200, errReason(out.status, out.body));
    const result = out.body.result as { ok: boolean; leaseToken: string; leaseUntilMs: number };
    assert.equal(result.ok, true);
    assert.equal(result.leaseUntilMs, NOW + GUEST_LINK_LEASE_MS);

    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "linking");
    assert.equal(doc.linkLeaseToken, result.leaseToken);
    assert.ok(doc.linkLeaseToken!.length >= 8);
    assert.equal(doc.linkLeaseUntilMs, NOW + GUEST_LINK_LEASE_MS);
    // 연결 시작은 서버 활동 갱신이다.
    assert.equal(doc.lastActivityAtMs, NOW);
  });

  it("409: 삭제가 예약된 게스트는 begin 을 받을 수 없다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    await seedDoc(store, "guest-1", { status: "deletionScheduled", lastActivityAtMs: OLD });
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "begin", leaseToken: null },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 409, errReason(out.status, out.body));
    const error = out.body.error as { reason: string };
    assert.equal(error.reason, "deletion-pending");
    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "deletionScheduled");
  });

  it("412: Google 등록 계정은 begin 을 받을 수 없고 데이터를 만지지 않는다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("google-1", authUser("google-1", { anonymous: false, email: "g@example.com" }));
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    await seedDoc(store, "guest-1", { lastActivityAtMs: OLD });
    const verify = tokens([["google-1", "tok-google"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-google", action: "begin", leaseToken: null },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 412, errReason(out.status, out.body));
    const error = out.body.error as { reason: string };
    assert.equal(error.reason, "already-registered");
    assert.equal(await store.get(guestLifecyclePath("google-1")), null);
    const before = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(before.lastActivityAtMs, OLD);
  });

  it("200: cancel 은 lease 를 풀고 상태를 active 로 돌린다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const leaseToken = "t".repeat(12);
    await seedDoc(store, "guest-1", { status: "linking", linkLeaseToken: leaseToken, linkLeaseUntilMs: NOW + GUEST_LINK_LEASE_MS });
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "cancel", leaseToken },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 200);

    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "active");
    assert.equal(doc.linkLeaseToken, null);
    assert.equal(doc.linkLeaseUntilMs, null);
  });

  it("200: cancel 에 토큰이 어긋나도 lease 는 풀지 않는다(다른 사람 lease 를 지우지 않는다)", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const leaseToken = "t".repeat(12);
    await seedDoc(store, "guest-1", { status: "linking", linkLeaseToken: leaseToken, linkLeaseUntilMs: NOW + GUEST_LINK_LEASE_MS });
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "cancel", leaseToken: "x".repeat(12) },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 200);

    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "linking");
    assert.equal(doc.linkLeaseToken, leaseToken);
  });

  it("412: 아직 익명이면 complete 는 실패하고 lease 는 유지된다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const leaseToken = "t".repeat(12);
    await seedDoc(store, "guest-1", { status: "linking", linkLeaseToken: leaseToken, linkLeaseUntilMs: NOW + GUEST_LINK_LEASE_MS });
    const verify = tokens([["guest-1", "tok-guest"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-guest", action: "complete", leaseToken },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 412, errReason(out.status, out.body));
    const error = out.body.error as { reason: string };
    assert.equal(error.reason, "still-anonymous");

    // core 는 여전히 익명인 complete 시도에서 lease 를 회수해 active 로 되돌린다(관찰 계약 고정).
    const doc = (await store.get(guestLifecyclePath("guest-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "active");
    assert.equal(doc.linkLeaseToken, null);
  });

  it("200: 익명이 아닌 계정의 complete 는 면책·복구·RTDB 차단 해제까지 마친다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    const rtdb = new MemoryGuestRtdb();
    const leaseToken = "t".repeat(12);
    auth.users.set("google-1", authUser("google-1", { anonymous: false, email: "g@example.com", disabled: true }));
    await seedDoc(store, "google-1", {
      status: "linking",
      linkLeaseToken: leaseToken,
      linkLeaseUntilMs: NOW + GUEST_LINK_LEASE_MS,
      disabledByLifecycle: true,
    });
    await rtdb.setBlocked("google-1", true);
    const verify = tokens([["google-1", "tok-google"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-google", action: "complete", leaseToken },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, rtdb) },
    );
    assert.equal(out.status, 200);
    const result = out.body.result as { ok: boolean; exempt: boolean };
    assert.equal(result.ok, true);
    assert.equal(result.exempt, true);

    const doc = (await store.get(guestLifecyclePath("google-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "exempt");
    assert.equal(doc.disabledByLifecycle, false);
    assert.equal(doc.linkLeaseToken, null);
    assert.equal(doc.linkLeaseUntilMs, null);

    const user = await auth.getUser("google-1");
    assert.equal(user?.disabled, false);
    assert.equal(rtdb.blocked.get("google-1"), false);
  });

  it("412: 익명이 아닌 계정의 complete 는 lease 토큰이 어긋나면 거절한다", async () => {
    /*
     * lease fencing — 문서에 살아 있는 lease 토큰이 있으면 그 값이어야만 면책·복구가
     * 성공한다. 결과04 감리 FAIL(임의 토큰으로 exempt 기록·Auth 재허용)을 결함에서
     * 계약으로 고친 회귀 고정이다. 문서는 linking 마커·토큰 그대로 남는다.
     */
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    const leaseToken = "t".repeat(12);
    auth.users.set("google-1", authUser("google-1", { anonymous: false, email: "g@example.com" }));
    await seedDoc(store, "google-1", { status: "linking", linkLeaseToken: leaseToken, linkLeaseUntilMs: NOW + GUEST_LINK_LEASE_MS });
    const verify = tokens([["google-1", "tok-google"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-google", action: "complete", leaseToken: "x".repeat(12) },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, new MemoryGuestRtdb()) },
    );
    assert.equal(out.status, 412, errReason(out.status, out.body));
    const error = out.body.error as { reason: string };
    assert.equal(error.reason, "lease-mismatch");
    const doc = (await store.get(guestLifecyclePath("google-1"))) as GuestLifecycleDoc;
    assert.equal(doc.status, "linking");
    assert.equal(doc.linkLeaseToken, leaseToken);
  });

  it("412: lifecycle이 끈 등록 계정도 토큰이 어긋나면 complete 로 복구되지 않는다", async () => {
    /*
     * CAS/fencing — 일일 배치가 disabled 해 둔 등록 예정 계정은 정확한 lease 토큰이 있을
     * 때만 complete 가 복구한다(우리가 끈 disable 소유 표식 보호). 어긋나면 412 이고
     * Auth disabled 는 그대로 남는다 — 다음 sweep 이 문서만 보고 복구한다(settleOne
     * registered 분기).
     */
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    const rtdb = new MemoryGuestRtdb();
    const leaseToken = "t".repeat(12);
    auth.users.set("google-1", authUser("google-1", { anonymous: false, email: "g@example.com", disabled: true }));
    await seedDoc(store, "google-1", {
      status: "deleting",
      linkLeaseToken: leaseToken,
      linkLeaseUntilMs: NOW + GUEST_LINK_LEASE_MS,
      disabledByLifecycle: true,
    });
    const verify = tokens([["google-1", "tok-google"]]);

    const out = await handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-google", action: "complete", leaseToken: "x".repeat(12) },
      { nowMs: NOW, verifyToken: verify, ports: makePorts(store, auth, rtdb) },
    );
    assert.equal(out.status, 412, errReason(out.status, out.body));
    const error = out.body.error as { reason: string };
    assert.equal(error.reason, "lease-mismatch");
    assert.equal((await auth.getUser("google-1"))?.disabled, true);
    assert.notEqual(rtdb.blocked.get("google-1"), false);
  });
});

describe("verifyToken 영구·일시 구분과 503 응답 계약 (guestLifecycleHttp)", () => {
  type ResponseLike = Parameters<typeof runGuestLifecycleRequest>[0];

  function fakeResponse(): { res: ResponseLike; result: { status: number | null; body: unknown } } {
    const result = { status: null as number | null, body: undefined as unknown };
    const res: ResponseLike = {
      status(code: number) {
        result.status = code;
        return { json: (body: unknown) => { result.body = body; } };
      },
    };
    return { res, result };
  }

  it("만료·무효·사용중지·대상 유실 코드는 영구 오류(null→401)로 분류된다", () => {
    for (const code of ["auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token", "auth/argument-error", "auth/user-not-found", "auth/user-disabled"]) {
      assert.equal(isPermanentTokenVerificationError({ code }), true, code);
    }
  });

  it("네트워크·내부·과다요청·모르는 코드와 코드 없는 예외는 일시 오류로 분류된다", () => {
    for (const error of [
      { code: "auth/network-request-failed" },
      { code: "auth/internal-error" },
      { code: "auth/too-many-requests" },
      { code: "auth/not-a-known-code" },
      new Error("코드 없는 네트워크 장애"),
      undefined,
    ]) {
      assert.equal(isPermanentTokenVerificationError(error), false);
    }
  });

  it("일시 장애로 verifyToken 이 던지면 401 이 아니라 503 JSON 이다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const deps = {
      nowMs: NOW,
      verifyToken: (async () => { throw new Error("auth/network-request-failed"); }) as VerifyToken,
      ports: makePorts(store, auth, new MemoryGuestRtdb()),
    };
    const { res, result } = fakeResponse();
    await runGuestLifecycleRequest(res, () => handleGuestActivityRequest(
      { method: "POST", authorization: "Bearer tok-guest" },
      deps,
    ));
    assert.equal(result.status, 503);
    const error = (result.body as { error?: { reason?: string } }).error;
    assert.equal(error?.reason, "transient-failure");
    // 계정 상태는 일시 장애로 절대 바뀌지 않는다.
    assert.equal(await store.get(guestLifecyclePath("guest-1")), null);
  });

  it("영구 실패(null)는 503 이 아니라 handler 의 401 계약 그대로 응답한다", async () => {
    const store = new MemoryGuestStore();
    const auth = new MemoryGuestAuth();
    auth.users.set("guest-1", authUser("guest-1", { anonymous: true }));
    const deps = {
      nowMs: NOW,
      verifyToken: (async () => null) as VerifyToken,
      ports: makePorts(store, auth, new MemoryGuestRtdb()),
    };
    const { res, result } = fakeResponse();
    await runGuestLifecycleRequest(res, () => handleGuestLinkRequest(
      { method: "POST", authorization: "Bearer tok-expired", action: "begin", leaseToken: null },
      deps,
    ));
    assert.equal(result.status, 401);
    assert.equal(await store.get(guestLifecyclePath("guest-1")), null);
  });

  it("정상 결과는 가공 없이 그대로 응답한다", async () => {
    const { res, result } = fakeResponse();
    await runGuestLifecycleRequest(res, () => Promise.resolve({ status: 200, body: { result: { ok: true } } }));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { result: { ok: true } });
  });
});

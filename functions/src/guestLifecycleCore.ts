/**
 * Guest 수명 — 마지막 서버 활동 30일, 관찰 유예, 삭제 예약과 Google 연결 lease.
 *
 * Auth·Firestore·RTDB 는 한 트랜잭션이 아니다. 활동·연결 lease·삭제 예약은
 * guestLifecycle/{uid} 트랜잭션으로 직렬화하고, 그 다음에 Auth 를 끄고 provider 를 다시 읽는다.
 * 그 재확인만으로 경합이 사라진다고 보지 않는다. 남는 간격은 테스트와 결과 문서에 적는다.
 *
 * 개인 데이터 삭제는 deleteAccountData(공용 자산은 익명화)만 쓴다. 이 모듈은 그 함수를 호출할 뿐
 * 공용 경로 문서를 지우지 않는다.
 */
import { randomUUID } from "node:crypto";

export const GUEST_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;
export const GUEST_LINK_LEASE_MS = 2 * 60 * 1000;
export const GUEST_DELETION_BATCH_CAP = 20;
export const GUEST_OBSERVE_BATCH_CAP = 100;
/** 한 sweep worker 가 삭제를 소유하는 시간. 다른 worker 는 이 임대가 끝나기 전에 같은 uid 를 지우지 않는다. */
export const GUEST_DELETION_OWNER_LEASE_MS = 15 * 60 * 1000;

/** Rules·RTDB 가 클라이언트 재쓰기를 막는 상태. 삭제 뒤 tombstone(deleted)도 포함한다. */
export const GUEST_WRITE_BLOCK_STATUSES = [
  "deletionScheduled",
  "disabling",
  "deleting",
  "failed",
  "deleted",
] as const;

export type GuestWriteBlockStatus = (typeof GUEST_WRITE_BLOCK_STATUSES)[number];

export type GuestLifecycleStatus =
  | "active"
  | "linking"
  | GuestWriteBlockStatus
  | "exempt";

export type GuestLifecycleDoc = {
  status: GuestLifecycleStatus;
  lastActivityAtMs: number | null;
  observedAtMs: number | null;
  linkLeaseUntilMs: number | null;
  linkLeaseToken: string | null;
  generation: number;
  failureCount: number;
  lastError: string | null;
  /** 이 세대의 삭제를 맡은 sweep worker. 없으면 아직 예약 소유자가 없다. */
  deletionOwner: string | null;
  deletionLeaseUntilMs: number | null;
  /** 이 수명 작업이 Auth 를 끈 뒤에만 true. 관리자가 끈 계정은 false 로 남는다. */
  disabledByLifecycle: boolean;
};

export type AuthSnapshot = {
  uid: string;
  anonymous: boolean;
  disabled: boolean;
  admin: boolean;
  email: string | null;
};

export type UserProfileSnap = {
  tier: string | null;
  isAnonymous: boolean | null;
};

export type DocData = Record<string, unknown>;

export interface GuestTx {
  get(path: string): Promise<DocData | null>;
  set(path: string, data: DocData): void;
}

export interface GuestDocStore {
  get(path: string): Promise<DocData | null>;
  runTransaction<T>(fn: (tx: GuestTx) => Promise<T>): Promise<T>;
}

export interface GuestAuthPort {
  getUser(uid: string): Promise<AuthSnapshot | null>;
  updateUser(uid: string, patch: { disabled?: boolean }): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}

export interface GuestRtdbPort {
  setBlocked(uid: string, blocked: boolean): Promise<void>;
}

export type GuestLifecyclePorts = {
  nowMs: number;
  store: GuestDocStore;
  auth: GuestAuthPort;
  rtdb: GuestRtdbPort;
  deleteAccountData: (uid: string) => Promise<void>;
  protectedUids: ReadonlySet<string>;
  listAuthUsers: () => Promise<AuthSnapshot[]>;
  listProfileUids: () => Promise<string[]>;
  listRetryUids: () => Promise<string[]>;
  readUserProfile: (uid: string) => Promise<UserProfileSnap | null>;
  recentRideOrPresence: (uid: string, nowMs: number) => Promise<boolean>;
  deletionCap?: number;
  observeCap?: number;
  /** 같은 프로세스의 다른 sweep 과 삭제를 구분한다. 없으면 실행마다 새로 만든다. */
  workerId?: string;
  recordRun?: (report: GuestSweepReport) => Promise<void>;
};

export type GuestSweepReport = {
  scanned: number;
  skippedProtected: number;
  skippedAdmin: number;
  skippedRegistered: number;
  skippedFresh: number;
  skippedLease: number;
  skippedRecent: number;
  skippedDeleted: number;
  observed: number;
  restored: number;
  deleted: number;
  failed: number;
  authAlreadyGone: number;
  retryable: number;
  skippedUnmanagedDisabled: number;
  skippedBusy: number;
  capped: boolean;
};

export type ActivityResult =
  | { ok: true; lastActivityAtMs: number }
  | { ok: false; reason: "missing-auth" | "not-anonymous" | "deletion-pending" };

export type LinkLeaseResult =
  | { ok: true; leaseToken: string; leaseUntilMs: number }
  | { ok: false; reason: "missing-auth" | "not-anonymous" | "deletion-pending" | "already-registered" };

const BLOCKING: ReadonlySet<string> = new Set(GUEST_WRITE_BLOCK_STATUSES);

export function guestLifecyclePath(uid: string): string {
  return `guestLifecycle/${uid}`;
}

export function guestMarkerBlocksClientWrite(status: unknown): boolean {
  return typeof status === "string" && BLOCKING.has(status);
}

export function isWithinGuestWindow(atMs: number | null, nowMs: number, windowMs = GUEST_INACTIVITY_MS): boolean {
  return typeof atMs === "number" && Number.isFinite(atMs) && nowMs - atMs < windowMs;
}

export function parseProtectedUidList(data: Record<string, unknown> | undefined): string[] {
  const raw = data?.protectedUids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 128);
}

export function blankGuestLifecycleDoc(): GuestLifecycleDoc {
  return {
    status: "active",
    lastActivityAtMs: null,
    observedAtMs: null,
    linkLeaseUntilMs: null,
    linkLeaseToken: null,
    generation: 0,
    failureCount: 0,
    lastError: null,
    deletionOwner: null,
    deletionLeaseUntilMs: null,
    disabledByLifecycle: false,
  };
}

/** users 문서가 없는 개인 데이터·RTDB motion uid 를 Auth 목록과 합친다. */
export function unionCandidateUids(...groups: ReadonlyArray<readonly string[]>): string[] {
  const out = new Set<string>();
  for (const group of groups) {
    for (const uid of group) {
      if (typeof uid === "string" && uid.length > 0 && uid.length <= 128) out.add(uid);
    }
  }
  return [...out];
}

export function isGuestAuth(user: AuthSnapshot): boolean {
  return user.anonymous && !user.admin && !user.email;
}

export function isRegisteredProfile(profile: UserProfileSnap | null): boolean {
  if (!profile) return false;
  if (profile.isAnonymous === false) return true;
  return profile.tier === "registered_free" || profile.tier === "registered_paid" || profile.tier === "admin";
}

function asDoc(data: DocData | null): GuestLifecycleDoc {
  if (!data) return blankGuestLifecycleDoc();
  const status = data.status;
  return {
    status: typeof status === "string" ? (status as GuestLifecycleStatus) : "active",
    lastActivityAtMs: typeof data.lastActivityAtMs === "number" ? data.lastActivityAtMs : null,
    observedAtMs: typeof data.observedAtMs === "number" ? data.observedAtMs : null,
    linkLeaseUntilMs: typeof data.linkLeaseUntilMs === "number" ? data.linkLeaseUntilMs : null,
    linkLeaseToken: typeof data.linkLeaseToken === "string" ? data.linkLeaseToken : null,
    generation: typeof data.generation === "number" ? data.generation : 0,
    failureCount: typeof data.failureCount === "number" ? data.failureCount : 0,
    lastError: typeof data.lastError === "string" ? data.lastError : null,
    deletionOwner: typeof data.deletionOwner === "string" ? data.deletionOwner : null,
    deletionLeaseUntilMs: typeof data.deletionLeaseUntilMs === "number" ? data.deletionLeaseUntilMs : null,
    disabledByLifecycle: data.disabledByLifecycle === true,
  };
}

function toData(doc: GuestLifecycleDoc): DocData {
  return { ...doc };
}

function leaseActive(doc: GuestLifecycleDoc, nowMs: number): boolean {
  return doc.status === "linking" && typeof doc.linkLeaseUntilMs === "number" && doc.linkLeaseUntilMs > nowMs;
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

async function readDoc(store: GuestDocStore, uid: string): Promise<GuestLifecycleDoc> {
  return asDoc(await store.get(guestLifecyclePath(uid)));
}

export async function recordGuestActivity(
  ports: Pick<GuestLifecyclePorts, "store" | "auth">,
  uid: string,
  nowMs: number,
): Promise<ActivityResult> {
  const user = await ports.auth.getUser(uid);
  if (!user) return { ok: false, reason: "missing-auth" };
  if (!isGuestAuth(user)) return { ok: false, reason: "not-anonymous" };
  return ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (guestMarkerBlocksClientWrite(doc.status)) return { ok: false, reason: "deletion-pending" };
    if (doc.status === "exempt") return { ok: false, reason: "not-anonymous" };
    const next: GuestLifecycleDoc = {
      ...doc,
      status: doc.status === "linking" ? "linking" : "active",
      lastActivityAtMs: nowMs,
      observedAtMs: doc.observedAtMs ?? nowMs,
      lastError: null,
    };
    tx.set(guestLifecyclePath(uid), toData(next));
    return { ok: true, lastActivityAtMs: nowMs };
  });
}

export async function beginGuestLinkLease(
  ports: Pick<GuestLifecyclePorts, "store" | "auth">,
  uid: string,
  nowMs: number,
): Promise<LinkLeaseResult> {
  const user = await ports.auth.getUser(uid);
  if (!user) return { ok: false, reason: "missing-auth" };
  if (!isGuestAuth(user)) return { ok: false, reason: "already-registered" };
  return ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (guestMarkerBlocksClientWrite(doc.status)) return { ok: false, reason: "deletion-pending" };
    const leaseToken = randomUUID();
    const leaseUntilMs = nowMs + GUEST_LINK_LEASE_MS;
    const next: GuestLifecycleDoc = {
      ...doc,
      status: "linking",
      linkLeaseToken: leaseToken,
      linkLeaseUntilMs: leaseUntilMs,
      lastActivityAtMs: nowMs,
      observedAtMs: doc.observedAtMs ?? nowMs,
      lastError: null,
    };
    tx.set(guestLifecyclePath(uid), toData(next));
    return { ok: true, leaseToken, leaseUntilMs };
  });
}

export async function completeGuestLink(
  ports: Pick<GuestLifecyclePorts, "store" | "auth" | "rtdb">,
  uid: string,
  leaseToken: string,
): Promise<{ ok: true; exempt: boolean } | { ok: false; reason: "missing-auth" | "still-anonymous" | "lease-mismatch" }> {
  const user = await ports.auth.getUser(uid);
  if (!user) return { ok: false, reason: "missing-auth" };
  if (isGuestAuth(user)) {
    await ports.store.runTransaction(async (tx) => {
      const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
      if (doc.status === "linking" && doc.linkLeaseToken === leaseToken) {
        tx.set(guestLifecyclePath(uid), toData({
          ...doc,
          status: "active",
          linkLeaseToken: null,
          linkLeaseUntilMs: null,
        }));
      }
    });
    return { ok: false, reason: "still-anonymous" };
  }
  const existing = await readDoc(ports.store, uid);
  /*
   * lease fencing — 문서에 살아 있는 lease 토큰이 기록돼 있으면 그 값이어야만 등록을
   * 확정한다. 임의 토큰으로 면책(exempt)·Auth 재허용이 성공하면 token 검증이 무의미해진다
   * (결과04 감리 FAIL). 문서가 lease 없이 blank(active)이면 기존 등록 계정 경로로 계속한다.
   */
  if (existing.linkLeaseToken != null && existing.linkLeaseToken !== leaseToken) {
    return { ok: false, reason: "lease-mismatch" };
  }
  const lifecycleDisabled = existing.disabledByLifecycle;
  if (user.disabled && lifecycleDisabled) {
    await ports.auth.updateUser(uid, { disabled: false });
  }
  const outcome = await ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    const liveToken = doc.linkLeaseToken;
    if (liveToken != null && liveToken !== leaseToken) {
      // 예약·취소 경합으로 토큰이 우리 것보다 새로워졌다 — 이 처리는 폐기하고 다시 시작해야 한다.
      return { written: false, mismatch: true };
    }
    if (doc.status === "deleted") return { written: false, mismatch: false };
    const tokenMatches = doc.status === "linking" && doc.linkLeaseToken === leaseToken;
    if (!tokenMatches && !doc.disabledByLifecycle && guestMarkerBlocksClientWrite(doc.status)) {
      return { written: false, mismatch: true };
    }
    tx.set(guestLifecyclePath(uid), toData({
      ...doc,
      status: "exempt",
      disabledByLifecycle: false,
      deletionOwner: null,
      deletionLeaseUntilMs: null,
      linkLeaseToken: null,
      linkLeaseUntilMs: null,
      lastError: null,
    }));
    return { written: true, mismatch: false };
  });
  if (outcome.mismatch || !outcome.written) return { ok: false, reason: "lease-mismatch" };
  if (lifecycleDisabled) await ports.rtdb.setBlocked(uid, false);
  return { ok: true, exempt: true };
}

export async function cancelGuestLinkLease(
  ports: Pick<GuestLifecyclePorts, "store">,
  uid: string,
  leaseToken: string,
): Promise<void> {
  await ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (doc.status !== "linking" || doc.linkLeaseToken !== leaseToken) return;
    tx.set(guestLifecyclePath(uid), toData({
      ...doc,
      status: "active",
      linkLeaseToken: null,
      linkLeaseUntilMs: null,
    }));
  });
}

function emptyReport(): GuestSweepReport {
  return {
    scanned: 0,
    skippedProtected: 0,
    skippedAdmin: 0,
    skippedRegistered: 0,
    skippedFresh: 0,
    skippedLease: 0,
    skippedRecent: 0,
    skippedDeleted: 0,
    observed: 0,
    restored: 0,
    deleted: 0,
    failed: 0,
    authAlreadyGone: 0,
    retryable: 0,
    skippedUnmanagedDisabled: 0,
    skippedBusy: 0,
    capped: false,
  };
}

type SettleKind =
  | "skippedProtected"
  | "skippedAdmin"
  | "skippedRegistered"
  | "skippedFresh"
  | "skippedLease"
  | "skippedRecent"
  | "skippedDeleted"
  | "skippedUnmanagedDisabled"
  | "skippedBusy"
  | "observed"
  | "restored"
  | "deleted"
  | "failed"
  | "retryable"
  | "capped";

function otherOwnerActive(doc: GuestLifecycleDoc, nowMs: number, workerId: string): boolean {
  return doc.deletionOwner != null
    && doc.deletionOwner !== workerId
    && typeof doc.deletionLeaseUntilMs === "number"
    && doc.deletionLeaseUntilMs > nowMs;
}

async function revertSchedule(ports: GuestLifecyclePorts, uid: string): Promise<void> {
  await ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (doc.status !== "deletionScheduled") return;
    tx.set(guestLifecyclePath(uid), toData({ ...doc, status: "active", lastError: null }));
  });
}

async function setPipeline(
  ports: GuestLifecyclePorts,
  uid: string,
  status: "disabling" | "deleting" | "deleted" | "failed",
  lastError: string | null,
  workerId: string,
  generation: number,
  claimDisable: boolean,
): Promise<boolean> {
  return ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (doc.deletionOwner !== workerId || doc.generation !== generation) return false;
    if (doc.status === "exempt" || doc.status === "active" || doc.status === "linking") return false;
    if (doc.status === "deleted" && status !== "deleted") return false;
    const next: GuestLifecycleDoc = {
      ...doc,
      status,
      lastError,
      failureCount: status === "failed" ? doc.failureCount + 1 : doc.failureCount,
      deletionOwner: workerId,
      deletionLeaseUntilMs: status === "failed" ? ports.nowMs : ports.nowMs + GUEST_DELETION_OWNER_LEASE_MS,
      disabledByLifecycle: claimDisable ? true : doc.disabledByLifecycle,
    };
    tx.set(guestLifecyclePath(uid), toData(next));
    return true;
  });
}

async function reenableIfLifecycleOwned(
  ports: GuestLifecyclePorts,
  uid: string,
  workerId: string,
  generation: number,
  weDisabled: boolean,
): Promise<void> {
  const doc = await readDoc(ports.store, uid);
  if (!weDisabled && !doc.disabledByLifecycle) return;
  if (!weDisabled && doc.deletionOwner != null && doc.deletionOwner !== workerId && doc.generation !== generation) return;
  const user = await ports.auth.getUser(uid);
  if (user?.disabled) await ports.auth.updateUser(uid, { disabled: false });
  await ports.store.runTransaction(async (tx) => {
    const current = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (!weDisabled && !current.disabledByLifecycle) return;
    if (current.status === "deleted") return;
    tx.set(guestLifecyclePath(uid), toData({
      ...current,
      status: "exempt",
      disabledByLifecycle: false,
      deletionOwner: null,
      deletionLeaseUntilMs: null,
      linkLeaseToken: null,
      linkLeaseUntilMs: null,
      lastError: null,
    }));
  });
  await ports.rtdb.setBlocked(uid, false);
}

async function purgeGuest(
  ports: GuestLifecyclePorts,
  uid: string,
  nowMs: number,
  workerId: string,
  generation: number,
): Promise<Exclude<SettleKind, "capped" | "observed" | "skippedFresh" | "skippedLease" | "skippedDeleted" | "skippedProtected" | "skippedAdmin">> {
  const before = await ports.auth.getUser(uid);
  const ownedDoc = await readDoc(ports.store, uid);
  if (before?.disabled && !ownedDoc.disabledByLifecycle) return "skippedUnmanagedDisabled";
  if (before && !isGuestAuth(before)) {
    if (ownedDoc.disabledByLifecycle) {
      await reenableIfLifecycleOwned(ports, uid, workerId, generation, false);
      return "restored";
    }
    return "skippedRegistered";
  }
  try {
    if (before && !before.disabled && (await ports.recentRideOrPresence(uid, nowMs))) {
      await revertSchedule(ports, uid);
      return "skippedRecent";
    }
  } catch {
    await revertSchedule(ports, uid).catch(() => undefined);
    return "retryable";
  }
  let weDisabled = false;
  try {
    if (before && !before.disabled) {
      const marked = await setPipeline(ports, uid, "disabling", null, workerId, generation, true);
      if (!marked) return "skippedBusy";
      await ports.auth.updateUser(uid, { disabled: true });
      weDisabled = true;
    } else if (before) {
      const marked = await setPipeline(ports, uid, "disabling", null, workerId, generation, false);
      if (!marked) return "skippedBusy";
    }
    const afterDisable = await ports.auth.getUser(uid);
    if (afterDisable && !isGuestAuth(afterDisable)) {
      await reenableIfLifecycleOwned(ports, uid, workerId, generation, weDisabled);
      return "restored";
    }
    await ports.rtdb.setBlocked(uid, true);
    const deleting = await setPipeline(ports, uid, "deleting", null, workerId, generation, false);
    if (!deleting) {
      const raced = await ports.auth.getUser(uid);
      if (!raced || !isGuestAuth(raced)) {
        await reenableIfLifecycleOwned(ports, uid, workerId, generation, weDisabled);
        return "restored";
      }
      return "skippedBusy";
    }
    const latest = await ports.auth.getUser(uid);
    if (latest && !isGuestAuth(latest)) {
      await reenableIfLifecycleOwned(ports, uid, workerId, generation, weDisabled);
      return "restored";
    }
    await ports.deleteAccountData(uid);
    if (latest) {
      try {
        await ports.auth.deleteUser(uid);
      } catch (error) {
        const missing = error instanceof Error && /not-found|user-not-found/i.test(error.message);
        if (!missing) throw error;
      }
    }
    await setPipeline(ports, uid, "deleted", null, workerId, generation, false);
    return "deleted";
  } catch (error) {
    const doc = await readDoc(ports.store, uid).catch(() => null);
    if (!doc || doc.deletionOwner !== workerId || doc.generation !== generation) return "retryable";
    await setPipeline(ports, uid, "failed", errorText(error), workerId, generation, false).catch(() => undefined);
    // 실패 표식은 예약을 소유한 worker 층에서만 쓴다(66-supervisor-findings-02 §2). 여기서 RTDB
    // 재차 실패해도 이 회차 판정은 유지한다 — 전체 배치를 끊지 않고 다음 실행이 이어 본다.
    await ports.rtdb.setBlocked(uid, true).catch(() => undefined);
    return "failed";
  }
}

/** armDeletion 의 판정. `kind` 가 단일 문자열 리터럴이라 TS narrowing 이 확실하다. */
export type GuestArmResult =
  | { kind: "armed"; generation: number }
  | { kind: "lease" }
  | { kind: "fresh" }
  | { kind: "deleted" }
  | { kind: "exempt" }
  | { kind: "busy" };

async function armDeletion(
  ports: GuestLifecyclePorts,
  uid: string,
  nowMs: number,
  workerId: string,
  force = false,
): Promise<GuestArmResult> {
  return ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (doc.status === "deleted") return { kind: "deleted" };
    if (!force && doc.status === "exempt") return { kind: "exempt" };
    if (!force && leaseActive(doc, nowMs)) return { kind: "lease" };
    if (BLOCKING.has(doc.status)) {
      if (otherOwnerActive(doc, nowMs, workerId)) return { kind: "busy" };
      tx.set(guestLifecyclePath(uid), toData({
        ...doc,
        deletionOwner: workerId,
        deletionLeaseUntilMs: nowMs + GUEST_DELETION_OWNER_LEASE_MS,
      }));
      return { kind: "armed", generation: doc.generation };
    }
    if (!force && isWithinGuestWindow(doc.lastActivityAtMs, nowMs)) return { kind: "fresh" };
    if (!force && doc.lastActivityAtMs == null && isWithinGuestWindow(doc.observedAtMs, nowMs)) return { kind: "fresh" };
    const generation = doc.generation + 1;
    tx.set(guestLifecyclePath(uid), toData({
      ...doc,
      status: "deletionScheduled",
      generation,
      deletionOwner: workerId,
      deletionLeaseUntilMs: nowMs + GUEST_DELETION_OWNER_LEASE_MS,
      linkLeaseToken: null,
      linkLeaseUntilMs: null,
      observedAtMs: doc.observedAtMs ?? nowMs,
    }));
    return { kind: "armed", generation };
  });
}

async function observe(ports: GuestLifecyclePorts, uid: string, nowMs: number): Promise<boolean> {
  return ports.store.runTransaction(async (tx) => {
    const doc = asDoc(await tx.get(guestLifecyclePath(uid)));
    if (doc.observedAtMs != null || doc.lastActivityAtMs != null) return false;
    if (doc.status === "deleted" || doc.status === "exempt" || BLOCKING.has(doc.status)) return false;
    tx.set(guestLifecyclePath(uid), toData({
      ...doc,
      status: doc.status === "linking" ? "linking" : "active",
      observedAtMs: nowMs,
    }));
    return true;
  });
}

async function settleOne(
  ports: GuestLifecyclePorts,
  uid: string,
  authUser: AuthSnapshot | null,
  profile: UserProfileSnap | null,
  canDelete: boolean,
  canObserve: boolean,
  workerId: string,
): Promise<SettleKind | "authAlreadyGone"> {
  if (ports.protectedUids.has(uid)) return "skippedProtected";
  if (authUser?.admin || profile?.tier === "admin") return "skippedAdmin";
  if ((authUser && !isGuestAuth(authUser)) || (!authUser && isRegisteredProfile(profile))) {
    try {
      const linked = await readDoc(ports.store, uid);
      if (authUser?.disabled && linked.disabledByLifecycle && !isGuestAuth(authUser)) {
        await reenableIfLifecycleOwned(ports, uid, workerId, linked.generation, false);
        return "restored";
      }
    } catch {
      return "retryable";
    }
    return "skippedRegistered";
  }

  let doc: GuestLifecycleDoc;
  try {
    doc = await readDoc(ports.store, uid);
  } catch {
    return "retryable";
  }
  if (authUser?.disabled && !doc.disabledByLifecycle) return "skippedUnmanagedDisabled";
  if (!authUser) {
    if (doc.status === "deleted") return "skippedDeleted";
    if (!canDelete) return "capped";
    try {
      if (await ports.recentRideOrPresence(uid, ports.nowMs)) return "skippedRecent";
    } catch {
      return "retryable";
    }
    const orphanArmed = await armDeletion(ports, uid, ports.nowMs, workerId, true);
    if (orphanArmed.kind === "busy") return "skippedBusy";
    if (orphanArmed.kind === "deleted") return "skippedDeleted";
    if (orphanArmed.kind !== "armed") return "retryable";
    const orphanOutcome = await purgeGuest(ports, uid, ports.nowMs, workerId, orphanArmed.generation);
    if (orphanOutcome === "deleted") return "authAlreadyGone";
    return orphanOutcome;
  }
  if (doc.status === "deleted") return "skippedDeleted";
  if (leaseActive(doc, ports.nowMs)) return "skippedLease";
  const inPipeline = BLOCKING.has(doc.status);
  const activityFresh = isWithinGuestWindow(doc.lastActivityAtMs, ports.nowMs);
  const graceFresh = doc.lastActivityAtMs == null && (doc.observedAtMs == null || isWithinGuestWindow(doc.observedAtMs, ports.nowMs));
  if (!inPipeline && activityFresh) return "skippedFresh";
  if (!inPipeline && doc.lastActivityAtMs == null && doc.observedAtMs == null) {
    if (!canObserve) return "capped";
    const wrote = await observe(ports, uid, ports.nowMs);
    return wrote ? "observed" : "skippedFresh";
  }
  if (!inPipeline && graceFresh) return "skippedFresh";
  if (!inPipeline && (await ports.recentRideOrPresence(uid, ports.nowMs))) return "skippedRecent";
  if (!canDelete) return "capped";

  const armed = await armDeletion(ports, uid, ports.nowMs, workerId);
  if (armed.kind === "lease") return "skippedLease";
  if (armed.kind === "fresh") return "skippedFresh";
  if (armed.kind === "deleted") return "skippedDeleted";
  if (armed.kind === "exempt") return "skippedRegistered";
  if (armed.kind === "busy") return "skippedBusy";
  const outcome = await purgeGuest(ports, uid, ports.nowMs, workerId, armed.generation);
  if (outcome === "deleted" && !authUser) return "authAlreadyGone";
  return outcome;
}

export async function runGuestLifecycleSweep(ports: GuestLifecyclePorts): Promise<GuestSweepReport> {
  const report = emptyReport();
  const deletionCap = ports.deletionCap ?? GUEST_DELETION_BATCH_CAP;
  const observeCap = ports.observeCap ?? GUEST_OBSERVE_BATCH_CAP;
  const workerId = ports.workerId ?? randomUUID();
  const authUsers = await ports.listAuthUsers();
  const byUid = new Map(authUsers.map((user) => [user.uid, user]));
  const retryUids = await ports.listRetryUids();
  const profileUids = await ports.listProfileUids();
  const ordered = [...new Set([...retryUids, ...byUid.keys(), ...profileUids])];
  let deletions = 0;
  let observations = 0;

  for (const uid of ordered) {
    if (deletions >= deletionCap && observations >= observeCap) {
      report.capped = true;
      break;
    }
    report.scanned += 1;
    let authUser: AuthSnapshot | null;
    let profile: UserProfileSnap | null;
    try {
      authUser = byUid.get(uid) ?? (await ports.auth.getUser(uid));
      profile = await ports.readUserProfile(uid);
    } catch {
      report.retryable += 1;
      continue;
    }
    let kind: SettleKind | "authAlreadyGone";
    try {
      kind = await settleOne(
        ports,
        uid,
        authUser,
        profile,
        deletions < deletionCap,
        observations < observeCap,
        workerId,
      );
    } catch {
      kind = "retryable";
    }
    if (kind === "capped") {
      report.capped = true;
      continue;
    }
    if (kind === "authAlreadyGone") {
      report.deleted += 1;
      report.authAlreadyGone += 1;
      deletions += 1;
      continue;
    }
    report[kind] += 1;
    if (kind === "deleted" || kind === "failed" || kind === "restored") deletions += 1;
    if (kind === "observed") observations += 1;
  }

  if (ports.recordRun) await ports.recordRun(report);
  return report;
}

/** 테스트·어댑터용 직렬 저장소. 트랜잭션은 큐로 한 번에 하나다. */
export class MemoryGuestStore implements GuestDocStore {
  private docs = new Map<string, DocData>();
  private chain: Promise<unknown> = Promise.resolve();

  async get(path: string): Promise<DocData | null> {
    const data = this.docs.get(path);
    return data ? structuredClone(data) : null;
  }

  runTransaction<T>(fn: (tx: GuestTx) => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const writes = new Map<string, DocData>();
      const tx: GuestTx = {
        get: async (path) => {
          if (writes.has(path)) return structuredClone(writes.get(path) ?? null);
          const data = this.docs.get(path);
          return data ? structuredClone(data) : null;
        },
        set: (path, data) => {
          writes.set(path, structuredClone(data));
        },
      };
      const result = await fn(tx);
      for (const [path, data] of writes) this.docs.set(path, data);
      return result;
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export class MemoryGuestAuth implements GuestAuthPort {
  readonly users = new Map<string, AuthSnapshot>();
  readonly disabled: string[] = [];
  readonly deleted: string[] = [];

  async getUser(uid: string): Promise<AuthSnapshot | null> {
    const user = this.users.get(uid);
    return user ? { ...user } : null;
  }

  async updateUser(uid: string, patch: { disabled?: boolean }): Promise<void> {
    const user = this.users.get(uid);
    if (!user) throw new Error("auth/user-not-found");
    if (patch.disabled != null) {
      user.disabled = patch.disabled;
      this.disabled.push(`${uid}:${patch.disabled}`);
    }
  }

  async deleteUser(uid: string): Promise<void> {
    this.deleted.push(uid);
    this.users.delete(uid);
  }

  list(): AuthSnapshot[] {
    return [...this.users.values()].map((user) => ({ ...user }));
  }
}

export class MemoryGuestRtdb implements GuestRtdbPort {
  readonly blocked = new Map<string, boolean>();

  async setBlocked(uid: string, blocked: boolean): Promise<void> {
    this.blocked.set(uid, blocked);
  }
}

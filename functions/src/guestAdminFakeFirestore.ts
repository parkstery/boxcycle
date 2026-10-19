/**
 * Admin writer guard 계약용 격리 fake Firestore — 시험 전용 헬퍼(테스트 러너에 직접 등록되지 않는다).
 *
 * 실제 Firestore transaction 충돌 감지를 흉내 낸다: transaction 이 읽은 문서가 커밋 전에
 * 다른 쪽에서 바뀌면 CONFLICT 를 표시하고 재시도가 돌게 한다. guestLifecycle marker 경합이
 * read 집합 안 marker read 로 직렬화된다는 계약(guestLifecycleGuard)을 이 재시도 위에서 검증한다.
 */
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { guestLifecyclePath, type GuestWriteBlockStatus } from "./guestLifecycleCore.js";

export type SnapshotLike = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  get(field: string): unknown;
};

export type FakeRefLike = { path: string };

export type FakeTx = {
  get(ref: FakeRefLike): Promise<SnapshotLike>;
  set(ref: FakeRefLike, data: Record<string, unknown>, opts?: { merge?: boolean }): void;
  update(ref: FakeRefLike, data: Record<string, unknown>): void;
  delete(ref: FakeRefLike): void;
};

const CONFLICT = Symbol("fake-db transaction conflict");

export class FakeAdminFirestore {
  readonly docs = new Map<string, Record<string, unknown> | null>();
  private readonly versions = new Map<string, number>();
  /** marker 문서를 읽은 직후 1회 돌릴 훅 — arm 경합 재현용. */
  onMarkerReadHook: (() => void) | null = null;
  attempts = 0;
  conflicts = 0;

  doc(path: string): FakeRefLike {
    return makeFakeRef(this, path);
  }

  /** 문서를 직접 기록하고 버전을 올린다 — race 재현·seed 의 기본 진입점. */
  seed(path: string, data: Record<string, unknown>): void {
    this.docs.set(path, { ...data });
    this.versions.set(path, (this.versions.get(path) ?? 0) + 1);
  }

  readSnap(path: string) {
    const data = this.docs.get(path);
    if (data == null) {
      return { exists: false, data: () => undefined, get: () => undefined };
    }
    return {
      exists: true,
      data: () => ({ ...data }),
      get: (field: string) => (data && Object.prototype.hasOwnProperty.call(data, field) ? data[field] : undefined),
    };
  }

  async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      this.attempts = attempt;
      const reads = new Map<string, number>();
      const writes: Array<{ kind: "set" | "update"; path: string; data: Record<string, unknown>; merge: boolean }> = [];
      const tx: FakeTx = {
        get: async (ref) => {
          const snap = this.readSnap(ref.path);
          reads.set(ref.path, this.versions.get(ref.path) ?? 0);
          if (ref.path.startsWith("guestLifecycle/") && this.onMarkerReadHook) {
            const hook = this.onMarkerReadHook;
            this.onMarkerReadHook = null;
            hook();
          }
          return snap;
        },
        set: (ref, data, opts) => writes.push({ kind: "set", path: ref.path, data, merge: opts?.merge === true }),
        update: (ref, data) => writes.push({ kind: "update", path: ref.path, data, merge: true }),
        delete: (ref) => {
          this.docs.set(ref.path, null);
          this.versions.set(ref.path, (this.versions.get(ref.path) ?? 0) + 1);
        },
      };
      let value: T;
      try {
        const result = await fn(tx);
        // 커밋 직전 충돌 판정 — 읽었던 문서가 읽은 뒤 바뀌면 실제 Firestore 처럼 재시도한다.
        for (const [path, version] of reads) {
          if ((this.versions.get(path) ?? 0) !== version) {
            this.conflicts += 1;
            throw CONFLICT;
          }
        }
        value = result;
      } catch (error) {
        if (error === CONFLICT) continue;
        throw error;
      }
      for (const w of writes) {
        const prev = this.docs.has(w.path) && this.docs.get(w.path) != null ? this.docs.get(w.path)! : {};
        this.docs.set(w.path, commitData(prev, w.data, w.kind === "update" || w.merge));
        this.versions.set(w.path, (this.versions.get(w.path) ?? 0) + 1);
      }
      return value;
    }
    throw new Error("fake-db: transaction retries exhausted");
  }
}

/** FieldValue.increment(x) 를 커밋 시점에 적용한다 — 나머지 sentinel 은 원형 보관. */
function commitData(
  prev: Record<string, unknown>,
  raw: Record<string, unknown>,
  merge: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = merge ? { ...prev } : {};
  for (const [key, value] of Object.entries(raw)) {
    if (value instanceof FieldValue && value.constructor.name === "NumericIncrementTransform") {
      const prevNum = typeof out[key] === "number" ? out[key] : 0;
      out[key] = prevNum + Number((value as unknown as { operand?: number }).operand ?? 0);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function makeFakeRef(db: FakeAdminFirestore, path: string): FakeRefLike {
  return {
    path,
    collection: (sub: string) => makeFakeRef(db, `${path}/${sub}`),
    doc: (id: string) => makeFakeRef(db, `${path}/${id}`),
    get: async () => db.readSnap(path),
  } as unknown as FakeRefLike;
}

/** Admin deps 교체 — guard 가 Auth/Firestore 표면만 쓰므로 관련 계약은 여기서 재현된다. */
export function fakeAdminDeps(db: FakeAdminFirestore) {
  return {
    auth: {
      getUser: async () => ({ providerData: [] }),
    },
    db: db as unknown as Firestore,
  };
}

/** Google 등록 계정처럼 provider 있는 getUser. */
export function fakeAdminDepsWithProviders(db: FakeAdminFirestore, providerCount = 1) {
  return {
    auth: {
      getUser: async () => ({ providerData: Array.from({ length: providerCount }, () => ({})) }),
    },
    db: db as unknown as Firestore,
  };
}

/** guestLifecycle/{uid} marker seed — arm 이후 쓰는 흔내. */
export function seedMarker(db: FakeAdminFirestore, uid: string, status: GuestWriteBlockStatus): void {
  db.seed(guestLifecyclePath(uid), { status });
}

export function markerStatusOf(db: FakeAdminFirestore, uid: string): unknown {
  return db.docs.get(guestLifecyclePath(uid))?.status;
}

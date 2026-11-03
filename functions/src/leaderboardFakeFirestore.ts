/**
 * 리더보드 점수 시험용 가짜 Firestore — 시험 전용 헬퍼(테스트 러너에 직접 등록되지 않는다).
 * 실제 쿼리 의미를 흉내 낸다: where(==, >, >=, <, <=) · orderBy · startAfter(값) · limit · count · select(무시).
 * 읽기 경로의 쿼리 조립(member 필터·정렬·커서)이 틀리면 결과가 달라지도록, 인자를 해석해서 계산한다.
 * 트랜잭션은 단일 스레드라 충돌 재시도는 없다(원장 멱등은 같은 주행을 두 번 넣어 확인한다).
 */
import type { Firestore } from "firebase-admin/firestore";

type Data = Record<string, unknown>;
type Where = { field: string; op: string; value: unknown };
type Order = { field: string; dir: "asc" | "desc" };

export class FakeScoreDb {
  readonly docs = new Map<string, Data>();
  /** 쿼리가 훑은 문서 수(읽기 비용 감각 확인용) */
  queryReads = 0;
  /** batch.delete 로 지운 경로(순서대로) */
  readonly deletedPaths: string[] = [];

  asFirestore(): Firestore {
    return this as unknown as Firestore;
  }

  doc(path: string) {
    const id = path.slice(path.lastIndexOf("/") + 1);
    const snap = () => {
      const data = this.docs.get(path);
      return {
        id,
        exists: data !== undefined,
        ref: this.doc(path),
        data: () => (data ? { ...data } : undefined),
        get: (f: string) => data?.[f],
      };
    };
    return { path, id, get: async () => snap(), _snap: snap };
  }

  collection(name: string) {
    return new FakeQuery(this, name, [], [], null, null);
  }

  batch() {
    const ops: Array<() => void> = [];
    return {
      update: (ref: { path: string }, data: Data) => {
        ops.push(() => this.docs.set(ref.path, { ...(this.docs.get(ref.path) ?? {}), ...data }));
      },
      delete: (ref: { path: string }) => {
        ops.push(() => {
          this.deletedPaths.push(ref.path);
          this.docs.delete(ref.path);
        });
      },
      commit: async () => {
        ops.forEach((f) => f());
      },
    };
  }

  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const writes: Array<() => void> = [];
    const tx = {
      get: async (ref: { path: string }) => this.doc(ref.path)._snap(),
      set: (ref: { path: string }, data: Data, opts?: { merge?: boolean }) => {
        writes.push(() => this.docs.set(ref.path, opts?.merge ? { ...(this.docs.get(ref.path) ?? {}), ...data } : { ...data }));
      },
    };
    const out = await fn(tx);
    writes.forEach((f) => f());
    return out;
  }
}

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

class FakeQuery {
  constructor(
    private readonly db: FakeScoreDb,
    private readonly name: string,
    private readonly wheres: Where[],
    private readonly orders: Order[],
    private readonly cursor: unknown[] | null,
    private readonly max: number | null,
  ) {}

  private with(p: Partial<{ wheres: Where[]; orders: Order[]; cursor: unknown[] | null; max: number | null }>) {
    return new FakeQuery(
      this.db,
      this.name,
      p.wheres ?? this.wheres,
      p.orders ?? this.orders,
      p.cursor === undefined ? this.cursor : p.cursor,
      p.max === undefined ? this.max : p.max,
    );
  }

  where(field: string, op: string, value: unknown) {
    return this.with({ wheres: [...this.wheres, { field, op, value }] });
  }
  orderBy(field: string, dir: "asc" | "desc" = "asc") {
    return this.with({ orders: [...this.orders, { field, dir }] });
  }
  startAfter(...values: unknown[]) {
    return this.with({ cursor: values });
  }
  limit(n: number) {
    return this.with({ max: n });
  }
  select() {
    return this;
  }

  private run() {
    const prefix = `${this.name}/`;
    let rows = [...this.db.docs.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .map(([path, data]) => ({ path, id: path.slice(prefix.length), data }));
    for (const w of this.wheres) {
      rows = rows.filter((r) => {
        const v = r.data[w.field];
        if (w.op === "==") return v === w.value;
        if (v === undefined) return false;
        const c = cmp(v, w.value);
        return w.op === ">" ? c > 0 : w.op === ">=" ? c >= 0 : w.op === "<" ? c < 0 : c <= 0;
      });
    }
    const compare = (a: { id: string; data: Data }, b: { id: string; data: Data }): number => {
      for (const o of this.orders) {
        const c = cmp(a.data[o.field], b.data[o.field]);
        if (c !== 0) return o.dir === "asc" ? c : -c;
      }
      return cmp(a.id, b.id);
    };
    rows.sort(compare);
    if (this.cursor) {
      const cur = this.cursor;
      rows = rows.filter((r) => {
        for (let i = 0; i < this.orders.length; i += 1) {
          const o = this.orders[i]!;
          const c = cmp(r.data[o.field], cur[i]);
          if (c !== 0) return o.dir === "asc" ? c > 0 : c < 0;
        }
        return false; // 커서와 모든 정렬 값이 같으면 그 문서 자체 — startAfter 는 제외한다
      });
    }
    return rows;
  }

  async get() {
    let rows = this.run();
    if (this.max != null) rows = rows.slice(0, this.max);
    this.db.queryReads += rows.length;
    const docs = rows.map((r) => ({
      id: r.id,
      ref: this.db.doc(r.path),
      exists: true,
      data: () => ({ ...r.data }),
      get: (f: string) => r.data[f],
    }));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }

  count() {
    return {
      get: async () => {
        const n = this.run().length;
        // count 집계는 1000 인덱스 항목당 읽기 1회 — 감각만 맞춘다
        this.db.queryReads += Math.ceil(n / 1000);
        return { data: () => ({ count: n }) };
      },
    };
  }
}

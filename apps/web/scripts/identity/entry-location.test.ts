/**
 * 첫 진입 위치 선택. 브라우저·서버 없이 권한·실패·늦은 콜백·watchdog 를 검증한다.
 *
 * node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ENTRY_LOCATION_FALLBACK_TARGET } from "../../src/hooks/useEntryLocation.ts";
import {
  ENTRY_GEOLOCATION_TIMEOUT_MS,
  ENTRY_LOCATION_NOTICE,
  ENTRY_PERMISSION_QUERY_WATCHDOG_MS,
  createEntryLocationSession,
  type EntryLocationEnv,
  type EntryLocationReadOptions,
  type EntryLocationSession,
} from "../../src/lib/geo/entryLocation.ts";
import { MAP_FALLBACK_CENTER, MAP_FALLBACK_ZOOM } from "../../src/lib/map/mapBootCenter.ts";

await import("./auth-session-gate-tsx-register.mjs");
const { EntryLocationDialog } = await import(
  "../../src/components/auth/EntryLocationDialog.tsx"
);

const CURRENT_LABEL = "내 위치";
const ROME_LABEL = "기본 위치";

type QueryResult = "granted" | "prompt" | "denied";

type Harness = {
  session: EntryLocationSession;
  calls: { query: number; read: number };
  options: EntryLocationReadOptions[];
  advance: (ms: number) => void;
  resolveQuery: (state: QueryResult) => void;
  succeed: (lng: number, lat: number) => void;
  fail: (kind: "denied" | "timeout" | "failed") => void;
};

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve()).then(() => undefined);
}

function createClock() {
  let now = 0;
  let nextId = 1;
  const timers: { id: number; at: number; fn: () => void }[] = [];
  return {
    setTimeout(fn: () => void, ms: number) {
      const id = nextId;
      nextId += 1;
      timers.push({ id, at: now + ms, fn });
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      return id;
    },
    clearTimeout(id: unknown) {
      const index = timers.findIndex((timer) => timer.id === id);
      if (index >= 0) timers.splice(index, 1);
    },
    advance(ms: number) {
      const target = now + ms;
      while (timers.length > 0 && timers[0].at <= target) {
        const timer = timers.shift();
        if (!timer) break;
        now = timer.at;
        timer.fn();
      }
      now = target;
    },
  };
}

function harness(options?: {
  hasGeolocation?: boolean;
  query?: () => Promise<QueryResult> | null;
  blockQuery?: boolean;
  blockRead?: boolean;
}): Harness {
  const clock = createClock();
  const calls = { query: 0, read: 0 };
  const readOptions: EntryLocationReadOptions[] = [];
  const resolvers: Array<(state: QueryResult) => void> = [];
  let succeed: (lng: number, lat: number) => void = () => {};
  let fail: (kind: "denied" | "timeout" | "failed") => void = () => {};
  const env: EntryLocationEnv = {
    hasGeolocation: () => options?.hasGeolocation ?? true,
    queryPermission: () => {
      calls.query += 1;
      if (options?.query) return options.query();
      if (options?.blockQuery === false) return Promise.resolve("granted");
      return new Promise((resolve) => {
        resolvers.push(resolve);
      });
    },
    readPosition: (readOpts, handlers) => {
      calls.read += 1;
      readOptions.push(readOpts);
      succeed = handlers.onSuccess;
      fail = handlers.onError;
      if (options?.blockRead === false) handlers.onSuccess(127.02, 37.5);
    },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  };
  return {
    session: createEntryLocationSession(env, ENTRY_LOCATION_FALLBACK_TARGET),
    calls,
    options: readOptions,
    advance: clock.advance,
    resolveQuery: (state) => {
      const resolve = resolvers.shift();
      if (!resolve) throw new Error("대기 중인 권한 조회가 없습니다");
      resolve(state);
    },
    get succeed() { return succeed; },
    fail: (kind) => fail(kind),
  };
}

function romeCenter(): [number, number] {
  return [MAP_FALLBACK_CENTER[0], MAP_FALLBACK_CENTER[1]];
}

test("fallback 상수는 mapBootCenter 콜로세움·줌 15", () => {
  assert.equal(ENTRY_PERMISSION_QUERY_WATCHDOG_MS, 1500);
  assert.equal(ENTRY_GEOLOCATION_TIMEOUT_MS, 8000);
  assert.equal(MAP_FALLBACK_ZOOM, 15);
  assert.deepEqual(ENTRY_LOCATION_FALLBACK_TARGET.center, romeCenter());
  assert.equal(ENTRY_LOCATION_FALLBACK_TARGET.zoom, MAP_FALLBACK_ZOOM);
});

test("enabled false 는 지리 API·타이머를 호출하지 않는다", () => {
  const env: EntryLocationEnv = {
    hasGeolocation: () => {
      throw new Error("geo");
    },
    queryPermission: () => {
      throw new Error("query");
    },
    readPosition: () => {
      throw new Error("read");
    },
    setTimeout: () => {
      throw new Error("timer");
    },
    clearTimeout: () => {},
  };
  const session = createEntryLocationSession(env, ENTRY_LOCATION_FALLBACK_TARGET);
  session.setEnabled(false);
  session.chooseRome();
  session.chooseCurrent();
  assert.deepEqual(session.getSnapshot(), {
    phase: "idle",
    permission: "unknown",
    target: null,
    notice: null,
  });
});

test("지리 API 미지원은 조회 없이 콜로세움 ready", () => {
  let query = 0;
  let read = 0;
  const env: EntryLocationEnv = {
    hasGeolocation: () => false,
    queryPermission: () => {
      query += 1;
      throw new Error("query");
    },
    readPosition: () => {
      read += 1;
      throw new Error("read");
    },
    setTimeout: () => {
      throw new Error("timer");
    },
    clearTimeout: () => {},
  };
  const session = createEntryLocationSession(env, ENTRY_LOCATION_FALLBACK_TARGET);
  session.setEnabled(true);
  const snap = session.getSnapshot();
  assert.equal(snap.phase, "ready");
  assert.equal(snap.notice, ENTRY_LOCATION_NOTICE.unsupported);
  assert.deepEqual(snap.target?.center, romeCenter());
  assert.equal(snap.target?.zoom, 15);
  assert.equal(query, 0);
  assert.equal(read, 0);
  assert.notEqual(snap.target, ENTRY_LOCATION_FALLBACK_TARGET);
  if (snap.target) snap.target.center[0] = 0;
  assert.equal(ENTRY_LOCATION_FALLBACK_TARGET.center[0], MAP_FALLBACK_CENTER[0]);
});

test("granted 는 즉시 1회 읽고 유한 좌표를 ready 로 유지한다", async () => {
  const box = harness({ blockQuery: false, blockRead: false });
  box.session.setEnabled(true);
  await flushMicrotasks();
  const snap = box.session.getSnapshot();
  assert.equal(box.calls.query, 1);
  assert.equal(box.calls.read, 1);
  assert.equal(snap.phase, "ready");
  assert.equal(snap.permission, "granted");
  assert.equal(snap.notice, null);
  assert.deepEqual(snap.target?.center, [127.02, 37.5]);
  assert.equal(snap.target?.zoom, MAP_FALLBACK_ZOOM);
  assert.deepEqual(box.options[0], {
    timeout: 8000,
    maximumAge: 0,
    enableHighAccuracy: false,
  });
  assert.equal(box.session.getSnapshot().target, snap.target);
  box.session.chooseCurrent();
  assert.equal(box.calls.read, 1);
  assert.equal(box.session.getSnapshot().target, snap.target);
});

test("경계 좌표 180,-90 은 유효하다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("granted");
  await flushMicrotasks();
  box.succeed(180, -90);
  const snap = box.session.getSnapshot();
  assert.equal(snap.phase, "ready");
  assert.equal(snap.notice, null);
  assert.deepEqual(snap.target?.center, [180, -90]);
});

test("prompt 는 버튼을 누르기 전에는 위치를 요청하지 않는다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("prompt");
  await flushMicrotasks();
  assert.equal(box.session.getSnapshot().phase, "choice");
  assert.equal(box.session.getSnapshot().permission, "prompt");
  assert.equal(box.calls.read, 0);
  box.session.chooseCurrent();
  box.session.chooseCurrent();
  box.session.chooseCurrent();
  assert.equal(box.calls.read, 1);
  assert.equal(box.session.getSnapshot().phase, "locating");
  box.succeed(12.5, 41.9);
  const ready = box.session.getSnapshot();
  assert.equal(ready.phase, "ready");
  assert.equal(ready.permission, "granted");
  assert.equal(ready.notice, null);
  assert.deepEqual(ready.target?.center, [12.5, 41.9]);
  assert.equal(box.session.getSnapshot().target, ready.target);
});

test("unknown 은 명시 버튼에서만 요청하고 권한 조회 실패도 unknown choice", async () => {
  const missing = harness({
    query: () => null,
  });
  missing.session.setEnabled(true);
  assert.equal(missing.session.getSnapshot().phase, "choice");
  assert.equal(missing.session.getSnapshot().permission, "unknown");
  assert.equal(missing.calls.read, 0);
  missing.session.chooseCurrent();
  assert.equal(missing.calls.read, 1);

  const thrown = harness({
    query: () => {
      throw new Error("unsupported");
    },
  });
  thrown.session.setEnabled(true);
  assert.equal(thrown.calls.query, 1);
  assert.equal(thrown.session.getSnapshot().permission, "unknown");
  assert.equal(thrown.calls.read, 0);

  const rejected = harness({
    query: () => Promise.reject(new Error("query failed")),
  });
  rejected.session.setEnabled(true);
  await flushMicrotasks();
  assert.equal(rejected.session.getSnapshot().phase, "choice");
  assert.equal(rejected.session.getSnapshot().permission, "unknown");
  assert.equal(rejected.calls.read, 0);
});

test("denied 차단 화면은 choice 유지이고 클릭 한 번당 위치를 요청한다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("denied");
  await flushMicrotasks();
  const blocked = box.session.getSnapshot();
  assert.equal(blocked.phase, "choice");
  assert.equal(blocked.permission, "denied");
  assert.equal(blocked.target, null);
  assert.equal(blocked.notice, null);

  // 차단 상태에서도 내 위치 근처 버튼으로 다시 시도한다. 클릭 한 번당 요청 한 번.
  box.session.chooseCurrent();
  assert.equal(box.calls.read, 1);
  assert.equal(box.session.getSnapshot().phase, "locating");
  box.session.chooseCurrent();
  assert.equal(box.calls.read, 1, "대기 중 중복 클릭은 요청을 늘리지 않는다");

  // 재요청이 다시 거절로 끝나면 ready 로 확정하지 않고 같은 선택 화면을 유지한다(2).
  box.fail("denied");
  const again = box.session.getSnapshot();
  assert.equal(again.phase, "choice");
  assert.equal(again.permission, "denied");
  assert.equal(again.target, null);
  assert.equal(again.notice, null);

  // 거절 오류 뒤에 도착하는 늦은 성공도 무시한다.
  box.succeed(126.978, 37.5665);
  assert.equal(box.session.getSnapshot().phase, "choice");

  // 다시 버튼을 누르면 또 한 번 요청한다.
  box.session.chooseCurrent();
  assert.equal(box.calls.read, 2);
});

test("denied 허용 뒤 같은 버튼 재시도는 한국 좌표로 ready 를 유지한다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("denied");
  await flushMicrotasks();

  // 첫 재시도도 거절로 끝나면 선택 화면을 유지한다.
  box.session.chooseCurrent();
  box.fail("denied");
  assert.equal(box.session.getSnapshot().phase, "choice");

  // 브라우저 설정에서 허용한 뒤 같은 버튼을 한 번 누르면 ready 가 된다(3).
  box.session.chooseCurrent();
  box.succeed(126.978, 37.5665);
  const ready = box.session.getSnapshot();
  assert.equal(ready.phase, "ready");
  assert.equal(ready.permission, "granted");
  assert.equal(ready.notice, null);
  assert.deepEqual(ready.target?.center, [126.978, 37.5665]);
  assert.equal(ready.target?.zoom, 15);
});

test("denied 에서 명시 앱 기본 위치 확정은 콜로세움 ready 를 유지한다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("denied");
  await flushMicrotasks();
  box.session.chooseRome();
  const ready = box.session.getSnapshot();
  assert.equal(ready.phase, "ready");
  assert.equal(ready.permission, "denied");
  assert.equal(ready.notice, null);
  assert.deepEqual(ready.target?.center, romeCenter());
  assert.equal(ready.target?.zoom, 15);

  // ready 이후에는 위치를 다시 요청하지 않는다(4).
  box.session.chooseCurrent();
  assert.equal(box.calls.read, 0);
  box.session.chooseRome();
  assert.equal(box.session.getSnapshot().target, ready.target);
});

test("acceptPosition 은 choice 에서 유효 좌표를 ready 로 확정한다", async () => {
  const box = harness();
  // 비활성(idle)에서는 아무 일도 하지 않는다.
  box.session.acceptPosition(Number.NaN, 0);
  box.session.acceptPosition(126.978, 37.5665);
  assert.equal(box.session.getSnapshot().phase, "idle");
  assert.equal(box.session.getSnapshot().target, null);

  box.session.setEnabled(true);
  box.resolveQuery("prompt");
  await flushMicrotasks();
  assert.equal(box.session.getSnapshot().phase, "choice");

  // 유효하지 않은 좌표는 무시한다.
  for (const [lng, lat] of [
    [Number.NaN, 0],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
    [180.1, 0],
    [0, -90.1],
  ] as const) {
    box.session.acceptPosition(lng, lat);
    assert.equal(box.session.getSnapshot().phase, "choice", `${lng},${lat}`);
  }

  // 네이티브 결과로 ready. 위치 API(getCurrentPosition)는 한 번도 부르지 않는다.
  box.session.acceptPosition(126.978, 37.5665);
  const ready = box.session.getSnapshot();
  assert.equal(box.calls.read, 0);
  assert.equal(box.calls.query, 1);
  assert.equal(ready.phase, "ready");
  assert.equal(ready.permission, "granted");
  assert.equal(ready.notice, null);
  assert.deepEqual(ready.target?.center, [126.978, 37.5665]);
  assert.equal(ready.target?.zoom, 15);

  // ready 이후의 늦은 결과는 무시한다.
  box.session.acceptPosition(10, 20);
  assert.equal(box.session.getSnapshot().target, ready.target);
  assert.deepEqual(box.session.getSnapshot().target?.center, [126.978, 37.5665]);

  // locating 중의 결과도 무시한다.
  const locating = harness({ query: () => Promise.resolve("prompt") });
  locating.session.setEnabled(true);
  await flushMicrotasks();
  locating.session.chooseCurrent();
  assert.equal(locating.session.getSnapshot().phase, "locating");
  locating.session.acceptPosition(126.978, 37.5665);
  assert.equal(locating.session.getSnapshot().phase, "locating");
  locating.succeed(127.02, 37.5);
  assert.equal(locating.session.getSnapshot().phase, "ready");
});

test("기본 위치 확정 뒤의 네이티브 결과는 무시한다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("prompt");
  await flushMicrotasks();
  box.session.chooseRome();
  const rome = box.session.getSnapshot();
  assert.equal(rome.phase, "ready");
  assert.deepEqual(rome.target?.center, romeCenter());
  box.session.acceptPosition(126.978, 37.5665);
  box.session.acceptPosition(Number.NaN, Number.NaN);
  assert.equal(box.session.getSnapshot().target, rome.target);
  assert.deepEqual(box.session.getSnapshot().target?.center, romeCenter());
  assert.equal(box.calls.read, 0);
});

test("자기활성 해제 뒤의 네이티브 결과도 무시한다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("prompt");
  await flushMicrotasks();
  box.session.setEnabled(false);
  box.session.acceptPosition(126.978, 37.5665);
  assert.equal(box.session.getSnapshot().phase, "idle");
  assert.equal(box.session.getSnapshot().target, null);
});

test("실패·브라우저 timeout·invalid 는 재시도 선택과 안내를 유지한다", async () => {
  async function locate(onRead: (box: Harness) => void) {
    const box = harness();
    box.session.setEnabled(true);
    box.resolveQuery("granted");
    await flushMicrotasks();
    assert.equal(box.session.getSnapshot().phase, "locating");
    onRead(box);
    return box.session.getSnapshot();
  }

  const failed = await locate((box) => box.fail("failed"));
  assert.equal(failed.phase, "choice");
  assert.equal(failed.notice, ENTRY_LOCATION_NOTICE.failed);
  assert.equal(failed.target, null);

  const timedOut = await locate((box) => box.fail("timeout"));
  assert.equal(timedOut.notice, ENTRY_LOCATION_NOTICE.timeout);
  assert.equal(timedOut.target, null);

  for (const [lng, lat] of [
    [Number.NaN, 0],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 1],
    [180.1, 0],
    [-180.1, 0],
    [0, 90.1],
    [0, -90.1],
  ] as const) {
    const invalid = await locate((box) => box.succeed(lng, lat));
    assert.equal(invalid.phase, "choice", `${lng},${lat}`);
    assert.equal(invalid.notice, ENTRY_LOCATION_NOTICE.invalid);
    assert.equal(invalid.target, null);
    assert.equal(JSON.stringify(invalid.notice).includes(String(lng)), false);
  }
});

test("권한 조회 watchdog 1500ms 이후의 granted 는 위치를 시작하지 않는다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  assert.equal(box.session.getSnapshot().phase, "checking");
  box.advance(ENTRY_PERMISSION_QUERY_WATCHDOG_MS - 1);
  assert.equal(box.session.getSnapshot().phase, "checking");
  assert.equal(box.calls.read, 0);
  box.advance(1);
  assert.equal(box.session.getSnapshot().phase, "choice");
  assert.equal(box.session.getSnapshot().permission, "unknown");
  box.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(box.calls.read, 0);
  assert.equal(box.session.getSnapshot().phase, "choice");
});

test("권한 선택을 8초 넘게 기다려도 승인 후 한국 좌표를 목적지로 사용한다", async () => {
  for (const permission of ["prompt", "unknown", "denied"] as const) {
    const box = permission === "unknown" ? harness({ query: () => null }) : harness();
    box.session.setEnabled(true);
    if (permission !== "unknown") box.resolveQuery(permission);
    await flushMicrotasks();
    box.session.chooseCurrent();
    box.advance(ENTRY_GEOLOCATION_TIMEOUT_MS * 3);
    assert.equal(box.session.getSnapshot().phase, "locating", permission);
    box.succeed(126.978, 37.5665);
    assert.equal(box.session.getSnapshot().phase, "ready");
    assert.deepEqual(box.session.getSnapshot().target?.center, [126.978, 37.5665]);
    assert.equal(box.session.getSnapshot().notice, null);
    assert.equal(box.session.getSnapshot().permission, "granted");
    assert.equal(box.calls.read, 1);
  }
});

test("기승인 위치 watchdog 이후 재시도를 유지하고 늦은 성공은 무시한다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("granted");
  await flushMicrotasks();
  box.advance(ENTRY_GEOLOCATION_TIMEOUT_MS - 1);
  assert.equal(box.session.getSnapshot().phase, "locating");
  box.advance(1);
  const ready = box.session.getSnapshot();
  assert.equal(ready.phase, "choice");
  assert.equal(ready.notice, ENTRY_LOCATION_NOTICE.timeout);
  assert.equal(ready.target, null);
  box.succeed(127, 37);
  assert.equal(box.session.getSnapshot().target, ready.target);
  assert.equal(box.session.getSnapshot().target, null);
  assert.equal(box.calls.read, 1);
});

test("콜로세움 선택은 진행 중 조회·위치를 취소하고 늦은 콜백을 무시한다", async () => {
  const pendingQuery = harness();
  pendingQuery.session.setEnabled(true);
  pendingQuery.session.chooseRome();
  const rome = pendingQuery.session.getSnapshot();
  assert.equal(rome.phase, "ready");
  assert.equal(rome.notice, null);
  assert.deepEqual(rome.target?.center, romeCenter());
  pendingQuery.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(pendingQuery.calls.read, 0);
  assert.equal(pendingQuery.session.getSnapshot().target, rome.target);

  const locating = harness();
  locating.session.setEnabled(true);
  locating.resolveQuery("prompt");
  await flushMicrotasks();
  locating.session.chooseCurrent();
  assert.equal(locating.session.getSnapshot().phase, "locating");
  locating.advance(ENTRY_GEOLOCATION_TIMEOUT_MS * 3);
  assert.equal(locating.session.getSnapshot().phase, "locating");
  locating.session.chooseRome();
  const cancelled = locating.session.getSnapshot();
  assert.equal(cancelled.notice, null);
  assert.deepEqual(cancelled.target?.center, romeCenter());
  locating.succeed(10, 20);
  locating.advance(ENTRY_GEOLOCATION_TIMEOUT_MS);
  assert.equal(locating.session.getSnapshot().target, cancelled.target);
  assert.equal(locating.session.getSnapshot().notice, null);
  assert.equal(locating.calls.read, 1);
});

test("enabled false 와 재시작은 이전 요청의 granted 가 위치를 시작하지 않게 한다", async () => {
  const first = harness();
  first.session.setEnabled(true);
  first.session.setEnabled(false);
  assert.equal(first.session.getSnapshot().phase, "idle");
  assert.equal(first.session.getSnapshot().target, null);
  first.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(first.calls.read, 0);
  assert.equal(first.session.getSnapshot().phase, "idle");

  first.session.setEnabled(true);
  assert.equal(first.calls.query, 2);
  assert.equal(first.session.getSnapshot().phase, "checking");
  first.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(first.calls.read, 1);
  first.succeed(13.4, 41.8);
  assert.deepEqual(first.session.getSnapshot().target?.center, [13.4, 41.8]);

  const restarted = harness();
  restarted.session.setEnabled(true);
  restarted.session.setEnabled(false);
  restarted.session.setEnabled(true);
  restarted.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(restarted.calls.read, 0);
  assert.equal(restarted.session.getSnapshot().phase, "checking");
  restarted.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(restarted.calls.read, 1);

  const older = harness();
  const newer = harness();
  older.session.setEnabled(true);
  older.session.setEnabled(false);
  newer.session.setEnabled(true);
  older.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(older.calls.read, 0);
  assert.equal(newer.calls.read, 0);
  newer.resolveQuery("granted");
  await flushMicrotasks();
  assert.equal(newer.calls.read, 1);
  newer.succeed(13, 42);
  assert.deepEqual(newer.session.getSnapshot().target?.center, [13, 42]);
  assert.equal(older.session.getSnapshot().phase, "idle");
});

test("hook 은 enabled 가드 뒤에서만 브라우저 환경을 연다", () => {
  const source = readFileSync(fileURLToPath(new URL("../../src/hooks/useEntryLocation.ts", import.meta.url)), "utf8");
  const guard = source.indexOf("if (!enabled) return;");
  const browser = source.indexOf("readBrowserEntryLocationEnv()");
  assert.ok(guard >= 0);
  assert.ok(browser > guard);
  assert.equal(source.includes("watchPosition"), false);
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("setEnabled(false)"), true);
});

test("제품 파일은 위치 감시·저장·전송을 넣지 않는다", () => {
  const files = [
    "../../src/lib/geo/entryLocation.ts",
    "../../src/hooks/useEntryLocation.ts",
    "../../src/components/auth/EntryLocationDialog.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
    for (const banned of ["watchPosition", "localStorage", "sessionStorage", "sendBeacon", "console."]) {
      assert.equal(source.includes(banned), false, `${file} ${banned}`);
    }
  }
  const dialog = readFileSync(
    fileURLToPath(new URL("../../src/components/auth/EntryLocationDialog.tsx", import.meta.url)),
    "utf8",
  );
  // 대화상자는 콜백을 통해서만 위치를 요청한다.
  assert.equal(dialog.includes("navigator.geolocation"), false, "dialog navigator.geolocation");
  assert.equal(dialog.includes("getCurrentPosition"), false, "dialog getCurrentPosition");
  // 중간 alert 없이 요청하고 차단 상태에는 설정 안내를 표시한다(지시15b).
  assert.equal(dialog.includes("globalThis.alert"), false, "dialog globalThis.alert");
  assert.equal(dialog.includes('permission === "denied"'), true);
  assert.equal(dialog.includes("브라우저 사이트 설정에서 위치를 허용"), true);
});

test("대화상자 CSS 는 44px 버튼·스크롤·출처 여백을 둔다", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../../src/components/auth/EntryLocationDialog.css", import.meta.url)),
    "utf8",
  );
  assert.equal(css.includes("min-height: 44px"), true);
  assert.equal(css.includes("overflow: auto"), true);
  assert.equal(css.includes("bottom: 0"), true);
  assert.equal(css.includes("align-items: center"), true);
  assert.equal(css.includes("pointer-events: none"), true);
  assert.equal(css.includes("pointer-events: auto"), true);
  assert.equal(css.includes("inset:"), false);
  assert.equal(css.includes(".entry-location__icon"), true);
  assert.equal(css.includes("display: none"), false);
  assert.equal(css.includes(".entry-location__status"), true);
});

type ButtonNode = {
  props: {
    onClick?: () => void;
    children?: ReactNode;
    className?: string;
    "aria-label"?: string;
  };
};

function buttonsOf(node: ReactNode): ButtonNode[] {
  const found: ButtonNode[] = [];
  const visit = (current: ReactNode) => {
    if (current == null || typeof current === "boolean") return;
    if (typeof current === "string" || typeof current === "number") return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current.type === "function") {
      visit(current.type(current.props));
      return;
    }
    if (current.type === "button") found.push(current as ButtonNode);
    visit(current.props?.children);
  };
  visit(node);
  return found;
}

function labelOf(node: ReactNode): string {
  const parts: string[] = [];
  const visit = (current: ReactNode) => {
    if (current == null || typeof current === "boolean") return;
    if (typeof current === "string" || typeof current === "number") {
      parts.push(String(current));
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current.type === "function") {
      visit(current.type(current.props));
      return;
    }
    visit(current.props?.children);
  };
  visit(node);
  return parts.join("").replace(/\s+/g, " ").trim();
}

test("첫 위치 버튼은 중간 확인 없이 위치 요청 callback을 한 번 실행한다", () => {
  let requests = 0;
  let defaults = 0;
  const node = createElement(EntryLocationDialog, {
    phase: "choice", permission: "prompt",
    onChooseCurrent: () => { requests += 1; },
    onChooseRome: () => { defaults += 1; },
    onPosition: () => {},
  });
  const html = renderToStaticMarkup(node);
  assert.ok(html.includes(CURRENT_LABEL));
  assert.equal(html.includes("위치공유 필요"), false);
  assert.equal(html.includes("위치 공유를 허용하시겠어요?"), false);
  const buttons = buttonsOf(node);
  assert.equal(buttons.length, 2);
  buttons.find((button) => button.props["aria-label"] === CURRENT_LABEL)?.props.onClick?.();
  assert.equal(requests, 1);
  buttons.find((button) => labelOf(button) === ROME_LABEL)?.props.onClick?.();
  assert.equal(defaults, 1);
});

test("idle/ready는 선택창을 닫고 checking/locating은 기본 위치 선택을 유지한다", () => {
  for (const phase of ["idle", "ready", "checking", "locating"] as const) {
    const node = createElement(EntryLocationDialog, {
      phase, permission: "unknown", onChooseCurrent: () => {},
      onChooseRome: () => {}, onPosition: () => {},
    });
    const html = renderToStaticMarkup(node);
    if (phase === "idle" || phase === "ready") assert.equal(html, "");
    else assert.ok(html.includes(ROME_LABEL));
  }
});

for (const failure of ["failed", "timeout"] as const) {
  test(`허용 후 ${failure}: 로마 확정 없이 재시도하면 현재 위치로 이동`, async () => {
    const box = harness();
    box.session.setEnabled(true);
    box.resolveQuery("granted");
    await flushMicrotasks();
    box.fail(failure);
    assert.equal(box.session.getSnapshot().phase, "choice");
    assert.equal(box.session.getSnapshot().target, null);
    assert.ok(box.session.getSnapshot().notice);
    const staleSuccess = box.succeed;
    box.session.chooseCurrent();
    assert.equal(box.calls.read, 2);
    assert.equal(box.session.getSnapshot().phase, "locating");
    staleSuccess(12.5, 41.9);
    assert.equal(box.session.getSnapshot().phase, "locating");
    box.succeed(126.978, 37.5665);
    assert.deepEqual(box.session.getSnapshot().target?.center, [126.978, 37.5665]);
    assert.equal(box.session.getSnapshot().notice, null);
  });
}

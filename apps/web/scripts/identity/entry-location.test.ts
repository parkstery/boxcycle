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
  readBrowserEntryLocationEnv,
  type EntryLocationEnv,
  type EntryLocationPermission,
  type EntryLocationPhase,
  type EntryLocationReadOptions,
  type EntryLocationSession,
} from "../../src/lib/geo/entryLocation.ts";
import { MAP_FALLBACK_CENTER, MAP_FALLBACK_ZOOM } from "../../src/lib/map/mapBootCenter.ts";

await import("./auth-session-gate-tsx-register.mjs");
const { EntryLocationDialog } = await import("../../src/components/auth/EntryLocationDialog.tsx");

const SHARE =
  "위치를 공유하면 내 주변 지도에서 시작합니다. 공유하지 않아도 로마 콜로세움에서 시작할 수 있습니다.";
const CURRENT_LABEL = "내 위치 근처에서 시작";
const ROME_LABEL = "앱 기본 위치에서 시작";

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
    succeed: (lng, lat) => succeed(lng, lat),
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

test("실패·브라우저 timeout·invalid 는 콜로세움 ready 와 안내를 유지한다", async () => {
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
  assert.equal(failed.phase, "ready");
  assert.equal(failed.notice, ENTRY_LOCATION_NOTICE.failed);
  assert.deepEqual(failed.target?.center, romeCenter());

  const timedOut = await locate((box) => box.fail("timeout"));
  assert.equal(timedOut.notice, ENTRY_LOCATION_NOTICE.failed);
  assert.deepEqual(timedOut.target?.center, romeCenter());

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
    assert.equal(invalid.phase, "ready", `${lng},${lat}`);
    assert.equal(invalid.notice, ENTRY_LOCATION_NOTICE.invalid);
    assert.deepEqual(invalid.target?.center, romeCenter());
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

test("기승인 위치 watchdog 8초와 늦은 성공 콜백은 콜로세움을 유지한다", async () => {
  const box = harness();
  box.session.setEnabled(true);
  box.resolveQuery("granted");
  await flushMicrotasks();
  box.advance(ENTRY_GEOLOCATION_TIMEOUT_MS - 1);
  assert.equal(box.session.getSnapshot().phase, "locating");
  box.advance(1);
  const ready = box.session.getSnapshot();
  assert.equal(ready.phase, "ready");
  assert.equal(ready.notice, ENTRY_LOCATION_NOTICE.failed);
  assert.deepEqual(ready.target?.center, romeCenter());
  box.succeed(127, 37);
  assert.equal(box.session.getSnapshot().target, ready.target);
  assert.deepEqual(box.session.getSnapshot().target?.center, romeCenter());
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
});

test("대화상자 CSS 는 44px 버튼·스크롤·출처 여백을 둔다", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../../src/components/auth/EntryLocationDialog.css", import.meta.url)),
    "utf8",
  );
  assert.equal(css.includes("min-height: 44px"), true);
  assert.equal(css.includes("overflow: auto"), true);
  assert.equal(css.includes("bottom: 3.25rem"), true);
  assert.equal(css.includes("pointer-events: none"), true);
  assert.equal(css.includes("pointer-events: auto"), true);
  assert.equal(css.includes("inset:"), false);
});

type ButtonNode = { props: { onClick?: () => void; children?: ReactNode; className?: string } };

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

function dialog(phase: EntryLocationPhase, permission: EntryLocationPermission, calls = { rome: 0, current: 0 }) {
  return createElement(EntryLocationDialog, {
    phase,
    permission,
    onChooseRome: () => {
      calls.rome += 1;
    },
    onChooseCurrent: () => {
      calls.current += 1;
    },
  });
}

test("대화상자는 idle·ready 에서 비우고 권한별로 문구와 버튼을 가른다", () => {
  assert.equal(renderToStaticMarkup(dialog("idle", "unknown")), "");
  assert.equal(renderToStaticMarkup(dialog("ready", "granted")), "");

  const promptHtml = renderToStaticMarkup(dialog("choice", "prompt"));
  assert.equal(promptHtml.includes("어디에서 시작할까요?"), true);
  assert.equal(promptHtml.includes('aria-label="어디에서 시작할까요?"'), true);
  assert.equal(promptHtml.includes("<h2"), true);
  assert.equal(promptHtml.includes(SHARE), false);
  assert.equal(promptHtml.includes(CURRENT_LABEL), true);
  assert.equal(promptHtml.includes('내 위치 근처에서 시작<span class="entry-location__button-hint">(위치공유 필요)</span>'), true);
  assert.equal(promptHtml.includes(ROME_LABEL), true);
  assert.equal(promptHtml.includes("entry-location__button--primary"), true);

  const unknownHtml = renderToStaticMarkup(dialog("choice", "unknown"));
  assert.equal(unknownHtml.includes(SHARE), false);
  assert.equal(unknownHtml.includes(CURRENT_LABEL), true);

  const deniedHtml = renderToStaticMarkup(dialog("choice", "denied"));
  assert.equal(deniedHtml.includes("위치 공유가 차단되어 있습니다"), false);
  assert.equal(deniedHtml.includes("entry-location__body"), false);
  assert.equal(deniedHtml.includes(SHARE), false);
  assert.equal(deniedHtml.includes(CURRENT_LABEL), true);
  assert.equal(deniedHtml.includes(ROME_LABEL), true);
  assert.equal(deniedHtml.includes("entry-location__button--primary"), true);

  const checkingHtml = renderToStaticMarkup(dialog("checking", "unknown"));
  assert.equal(checkingHtml.includes("위치 권한을 확인하고 있습니다."), true);
  assert.equal(checkingHtml.includes(CURRENT_LABEL), false);
  assert.equal(checkingHtml.includes(ROME_LABEL), true);
  assert.equal(checkingHtml.includes(SHARE), false);

  const locatingHtml = renderToStaticMarkup(dialog("locating", "granted"));
  assert.equal(locatingHtml.includes("현재 위치를 확인하고 있습니다."), true);
  assert.equal(locatingHtml.includes(CURRENT_LABEL), false);
  assert.equal(locatingHtml.includes(ROME_LABEL), true);

  const calls = { rome: 0, current: 0 };
  const checkingButtons = buttonsOf(dialog("checking", "unknown", calls));
  assert.equal(checkingButtons.length, 1);
  assert.equal(labelOf(checkingButtons[0]), ROME_LABEL);
  checkingButtons[0].props.onClick?.();
  assert.equal(calls.rome, 1);
  assert.equal(calls.current, 0);

  const choiceButtons = buttonsOf(dialog("choice", "prompt", calls));
  const current = choiceButtons.find((button) => labelOf(button).startsWith(CURRENT_LABEL));
  const rome = choiceButtons.find((button) => labelOf(button) === ROME_LABEL);
  current?.props.onClick?.();
  rome?.props.onClick?.();
  assert.equal(calls.current, 1);
  assert.equal(calls.rome, 2);

  // 차단(denied) 선택 화면도 두 버튼이 모두 활성이고 콜백을 호출한다(지시08 ①).
  const deniedCalls = { rome: 0, current: 0 };
  const deniedButtons = buttonsOf(dialog("choice", "denied", deniedCalls));
  assert.equal(deniedButtons.length, 2);
  const deniedCurrent = deniedButtons.find((button) => labelOf(button).startsWith(CURRENT_LABEL));
  const deniedRome = deniedButtons.find((button) => labelOf(button) === ROME_LABEL);
  assert.ok(deniedCurrent);
  assert.ok(deniedRome);
  deniedCurrent?.props.onClick?.();
  deniedRome?.props.onClick?.();
  assert.equal(deniedCalls.current, 1);
  assert.equal(deniedCalls.rome, 1);
});

test("이 런타임에 지리 API가 없으면 브라우저 환경도 콜로세움으로 끝난다", () => {
  const env = readBrowserEntryLocationEnv();
  assert.equal(env.hasGeolocation(), false);
  const session = createEntryLocationSession(env, ENTRY_LOCATION_FALLBACK_TARGET);
  session.setEnabled(true);
  assert.equal(session.getSnapshot().phase, "ready");
  assert.equal(session.getSnapshot().notice, ENTRY_LOCATION_NOTICE.unsupported);
});

/**
 * 주행 중 화면 꺼짐 방지 — 제어기 계약(2026-10-23).
 * 브라우저 대신 가짜 navigator·document 로 잠금 획득·해제·재획득을 확인한다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createScreenWakeLock } from "../../src/hooks/useScreenWakeLock.ts";

function fakeEnv(opts: { supported?: boolean; reject?: boolean; hold?: boolean } = {}) {
  const calls = { request: 0, release: 0 };
  let releaseListener: (() => void) | null = null;
  let resolvePending: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: "visible",
    addEventListener: (_: "visibilitychange", l: () => void) => listeners.add(l),
    removeEventListener: (_: "visibilitychange", l: () => void) => listeners.delete(l),
  };
  const sentinel = {
    release: async () => {
      calls.release += 1;
    },
    addEventListener: (_: "release", l: () => void) => {
      releaseListener = l;
    },
  };
  const nav = opts.supported === false
    ? {}
    : {
        wakeLock: {
          request: (_: "screen") => {
            calls.request += 1;
            if (opts.reject) return Promise.reject(new Error("NotAllowedError"));
            if (opts.hold) return new Promise<typeof sentinel>((res) => { resolvePending = () => res(sentinel); });
            return Promise.resolve(sentinel);
          },
        },
      };
  return {
    nav,
    doc,
    calls,
    setVisibility(state: "visible" | "hidden") {
      doc.visibilityState = state;
      for (const l of listeners) l();
    },
    browserReleases() {
      releaseListener?.();
    },
    resolvePending() {
      resolvePending?.();
    },
    listenerCount: () => listeners.size,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("화면 꺼짐 방지", () => {
  it("주행이 시작되면 잠금을 걸고, 끝나면 푼다", async () => {
    const env = fakeEnv();
    const lock = createScreenWakeLock(env.nav, env.doc);
    lock.setActive(true);
    await flush();
    assert.equal(env.calls.request, 1);
    assert.equal(lock.isHeld(), true);
    lock.setActive(false);
    assert.equal(lock.isHeld(), false);
    assert.equal(env.calls.release, 1);
  });

  it("앱을 내렸다 다시 열면(브라우저가 푼 뒤) 다시 건다", async () => {
    const env = fakeEnv();
    const lock = createScreenWakeLock(env.nav, env.doc);
    lock.setActive(true);
    await flush();
    env.setVisibility("hidden");
    env.browserReleases();
    assert.equal(lock.isHeld(), false);
    env.setVisibility("visible");
    await flush();
    assert.equal(env.calls.request, 2);
    assert.equal(lock.isHeld(), true);
  });

  it("주행 중이 아니면 다시 보여도 걸지 않는다", async () => {
    const env = fakeEnv();
    createScreenWakeLock(env.nav, env.doc);
    env.setVisibility("visible");
    await flush();
    assert.equal(env.calls.request, 0);
  });

  it("API 가 없거나 거절돼도 예외 없이 넘어간다", async () => {
    const none = fakeEnv({ supported: false });
    const a = createScreenWakeLock(none.nav, none.doc);
    a.setActive(true);
    await flush();
    assert.equal(a.isHeld(), false);
    const rejected = fakeEnv({ reject: true });
    const b = createScreenWakeLock(rejected.nav, rejected.doc);
    b.setActive(true);
    await flush();
    assert.equal(rejected.calls.request, 1);
    assert.equal(b.isHeld(), false);
  });

  it("요청이 도는 사이 주행이 끝나면 받자마자 푼다", async () => {
    const env = fakeEnv({ hold: true });
    const lock = createScreenWakeLock(env.nav, env.doc);
    lock.setActive(true);
    lock.setActive(false);
    env.resolvePending();
    await flush();
    assert.equal(lock.isHeld(), false);
    assert.equal(env.calls.release, 1);
  });

  it("dispose 는 잠금과 visibility 구독을 모두 정리한다", async () => {
    const env = fakeEnv();
    const lock = createScreenWakeLock(env.nav, env.doc);
    lock.setActive(true);
    await flush();
    lock.dispose();
    assert.equal(lock.isHeld(), false);
    assert.equal(env.listenerCount(), 0);
  });
});

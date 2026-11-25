import assert from "node:assert/strict";
import { test } from "node:test";
import { FpsMeter, resolveFpsPanelEnabled } from "../src/lib/debug/fpsMeter.ts";

function feed(meter: FpsMeter, from: number, to: number, gap: number): void {
  for (let t = from; t <= to; t += gap) meter.note(t);
}

test("일정한 30FPS 10초는 평균·최저·p95 로 합격한다", () => {
  const meter = new FpsMeter();
  feed(meter, 0, 11_000, 1000 / 30);
  const r = meter.read(11_000);
  assert.ok(Math.abs((r.current ?? 0) - 30) < 0.5);
  assert.ok(Math.abs((r.avg ?? 0) - 30) < 0.5);
  assert.ok((r.minSecond ?? 0) >= 29);
  assert.ok(Math.abs((r.p95Ms ?? 0) - 33.3) < 0.5);
  assert.equal(r.pass, true);
});

test("평균이 높아도 한 구간이 멈추면 최저가 잡고 미달이다", () => {
  const meter = new FpsMeter();
  feed(meter, 0, 5_000, 20);
  feed(meter, 5_900, 11_000, 20);
  const r = meter.read(11_000);
  assert.ok((r.avg ?? 0) > 40);
  assert.ok((r.minSecond ?? 99) < 24);
  assert.equal(r.pass, false);
});

test("10초가 차기 전에는 판정하지 않고, 지도가 멈추면 숫자를 내지 않는다", () => {
  const meter = new FpsMeter();
  feed(meter, 0, 4_000, 20);
  assert.equal(meter.read(4_000).pass, null);
  assert.ok(meter.read(4_000).current);
  assert.equal(meter.read(6_000).current, null);
  meter.reset();
  assert.equal(meter.read(6_000).avg, null);
});

test("?fps=1 은 기억되고 ?fps=0 으로 끈다", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  assert.equal(resolveFpsPanelEnabled("", storage), false);
  assert.equal(resolveFpsPanelEnabled("?fps=1", storage), true);
  assert.equal(resolveFpsPanelEnabled("", storage), true);
  assert.equal(resolveFpsPanelEnabled("?fps=0", storage), false);
  assert.equal(resolveFpsPanelEnabled("", storage), false);
  assert.equal(resolveFpsPanelEnabled("?fps=1", null), true);
});

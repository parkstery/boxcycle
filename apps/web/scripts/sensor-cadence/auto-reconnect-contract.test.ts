import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLE_RECONNECT_MAX_MS,
  bleReconnectDelayMs,
  selectGrantedCadenceDevice,
} from "../../src/lib/bleAutoReconnect.ts";

describe("BLE 자동 재연결 백오프", () => {
  it("0.5s에서 시작해 10s 상한까지 증가한다", () => {
    assert.deepEqual(
      Array.from({ length: 8 }, (_, attempt) => bleReconnectDelayMs(attempt)),
      [500, 1000, 2000, 4000, 8000, 10_000, 10_000, 10_000],
    );
    assert.equal(bleReconnectDelayMs(Number.NaN), 500);
    assert.equal(bleReconnectDelayMs(-10), 500);
    assert.equal(bleReconnectDelayMs(100), BLE_RECONNECT_MAX_MS);
  });
});

describe("허용된 케이던스 장치 복원", () => {
  it("CYCPLUS 한 대가 명확하면 다른 허용 장치보다 우선한다", () => {
    const cycle = { name: "CYCPLUS C3 12695" };
    assert.equal(selectGrantedCadenceDevice([{ name: "Other" }, cycle]), cycle);
  });

  it("허용 장치가 한 대뿐이면 이름과 무관하게 복원한다", () => {
    const only = { name: "Standard CSC" };
    assert.equal(selectGrantedCadenceDevice([only]), only);
  });

  it("후보가 없거나 CYCPLUS가 여러 대면 임의 연결하지 않는다", () => {
    assert.equal(selectGrantedCadenceDevice([]), null);
    assert.equal(
      selectGrantedCadenceDevice([{ name: "CYCPLUS C3 A" }, { name: "CYCPLUS C3 B" }]),
      null,
    );
    assert.equal(selectGrantedCadenceDevice([{ name: "A" }, { name: "B" }]), null);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { cancelRideMomentSound, playRideMomentSound } from "../../src/lib/ride/rideMomentSound.ts";

test("AudioContext constructor failure is silent", () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: { AudioContext: class { constructor() { throw new Error("device unavailable"); } } },
    configurable: true,
  });
  try {
    assert.doesNotThrow(() => playRideMomentSound("start"));
  } finally {
    if (before) Object.defineProperty(globalThis, "window", before);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("slow resume after cancel does not start oscillators", async () => {
  const started: number[] = [];
  let resume!: () => void;
  class FakeCtx {
    state = "suspended";
    currentTime = 0;
    destination = {};
    resume() {
      return new Promise<void>((resolve) => { resume = resolve; });
    }
    createOscillator() {
      return {
        type: "sine",
        frequency: { value: 0 },
        connect() {},
        start() { started.push(1); },
        stop() {},
        onended: null as (() => void) | null,
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }
  }
  const before = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: { AudioContext: FakeCtx, speechSynthesis: { speaking: false } },
    configurable: true,
  });
  try {
    playRideMomentSound("start");
    cancelRideMomentSound();
    resume();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(started.length, 0);
  } finally {
    if (before) Object.defineProperty(globalThis, "window", before);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

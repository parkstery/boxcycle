/**
 * 지도 경로 선택 롱프레스 제스처 — 순수 로직·부착 하네스(모의 DOM)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAP_ROUTE_PICK_GESTURE_SUPPRESS_MS,
  MAP_ROUTE_PICK_LONG_PRESS_MS,
  MAP_ROUTE_PICK_MOVE_TOLERANCE_PX,
  attachMapRoutePickGesture,
  exceedsMoveTolerance,
  isMapboxCanvasTarget,
  pointerDeltaPx,
} from "../../src/components/map/mapRoutePickGesture.ts";

const MAP_VIEW_SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/components/map/MapView.tsx"),
  "utf8",
);

describe("mapRoutePickGesture pure", () => {
  it("mapbox canvas class 판별", () => {
    const canvas = {
      classList: { contains: (c: string) => c === "mapboxgl-canvas" },
    };
    assert.equal(isMapboxCanvasTarget(canvas as EventTarget), true);
    assert.equal(isMapboxCanvasTarget({} as EventTarget), false);
    assert.equal(isMapboxCanvasTarget(null), false);
  });

  it("이동 허용 10CSSpx", () => {
    assert.equal(
      exceedsMoveTolerance({ x: 0, y: 0 }, { x: 9, y: 0 }, MAP_ROUTE_PICK_MOVE_TOLERANCE_PX),
      false,
    );
    assert.equal(
      exceedsMoveTolerance({ x: 0, y: 0 }, { x: 10, y: 0 }, MAP_ROUTE_PICK_MOVE_TOLERANCE_PX),
      false,
    );
    assert.equal(
      exceedsMoveTolerance({ x: 0, y: 0 }, { x: 11, y: 0 }, MAP_ROUTE_PICK_MOVE_TOLERANCE_PX),
      true,
    );
    assert.equal(pointerDeltaPx({ x: 3, y: 4 }, { x: 0, y: 0 }), 5);
  });
});

type Listener = (event: MockPointerEvent) => void;

class MockPointerEvent {
  preventDefault() {}
  type: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  isPrimary: boolean;
  pointerType: string;
  target: EventTarget | null;
  constructor(
    type: string,
    init: {
      pointerId?: number;
      clientX?: number;
      clientY?: number;
      isPrimary?: boolean;
      pointerType?: string;
      target?: EventTarget | null;
    },
  ) {
    this.type = type;
    this.pointerId = init.pointerId ?? 1;
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.isPrimary = init.isPrimary ?? true;
    this.pointerType = init.pointerType ?? "mouse";
    this.target = init.target ?? null;
  }
}

class MockCanvas extends EventEmitter {
  className = "mapboxgl-canvas";
  classList = {
    contains: (name: string) => this.className.split(/\s+/).includes(name),
  };

  addEventListener(type: string, listener: Listener) {
    this.on(type, listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.off(type, listener);
  }

  setPointerCapture(_id: number) {}
  releasePointerCapture(_id: number) {}

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }

  dispatch(type: string, init: Partial<MockPointerEvent> & { pointerId?: number }) {
    const event = new MockPointerEvent(type, { ...init, target: this });
    this.emit(type, event);
    return event;
  }
}

describe("mapRoutePickGesture attach harness", () => {
  const cleanups: Array<() => void> = [];
  const docListeners = new Map<string, Set<Listener>>();
  const winListeners = new Map<string, Set<() => void>>();

  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
    docListeners.clear();
    winListeners.clear();
  });

  function installHarness(overrides?: Partial<Parameters<typeof attachMapRoutePickGesture>[0]>) {
    const canvas = new MockCanvas();
    let clock = 0;
    const now = () => clock;
    type Timer = { id: number; at: number; fn: () => void };
    const timers: Timer[] = [];
    let nextTimerId = 1;
    const scheduleTimeout = (fn: () => void, ms: number) => {
      const id = nextTimerId++;
      timers.push({ id, at: clock + ms, fn });
      return id as ReturnType<typeof setTimeout>;
    };
    const cancelScheduled = (id: ReturnType<typeof setTimeout>) => {
      const n = Number(id);
      const idx = timers.findIndex((t) => t.id === n);
      if (idx >= 0) timers.splice(idx, 1);
    };
    const flushTimers = () => {
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      while (timers.length && timers[0]!.at <= clock) {
        const t = timers.shift()!;
        t.fn();
      }
    };
    const events: string[] = [];
    const mapListeners = new Map<string, Set<(e?: unknown) => void>>();

    const map = {
      getCanvas: () => canvas as unknown as HTMLCanvasElement,
      unproject: (pt: [number, number]) => ({ lng: pt[0] * 0.01, lat: pt[1] * 0.01 }),
      on: (name: string, fn: (e?: unknown) => void) => {
        if (!mapListeners.has(name)) mapListeners.set(name, new Set());
        mapListeners.get(name)!.add(fn);
      },
      off: (name: string, fn: (e?: unknown) => void) => {
        mapListeners.get(name)?.delete(fn);
      },
      emit: (name: string, payload?: unknown) => {
        for (const fn of mapListeners.get(name) ?? []) fn(payload);
      },
    };

    const fakeDocument = {
      visibilityState: "visible" as DocumentVisibilityState,
      addEventListener: (type: string, fn: Listener, capture?: boolean) => {
        if (!capture) return;
        if (!docListeners.has(type)) docListeners.set(type, new Set());
        docListeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: Listener, capture?: boolean) => {
        if (!capture) return;
        docListeners.get(type)?.delete(fn);
      },
      dispatchPointer: (type: string, init: Partial<MockPointerEvent>) => {
        const event = new MockPointerEvent(type, init);
        for (const fn of docListeners.get(type) ?? []) fn(event);
      },
    };

    const fakeWindow = {
      addEventListener: (type: string, fn: () => void) => {
        if (!winListeners.has(type)) winListeners.set(type, new Set());
        winListeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: () => void) => {
        winListeners.get(type)?.delete(fn);
      },
      dispatchEvent: (ev: Event) => {
        for (const fn of winListeners.get(ev.type) ?? []) fn();
      },
    };

    const prevDocument = globalThis.document;
    const prevWindow = globalThis.window;
    (globalThis as { document?: unknown }).document = fakeDocument;
    (globalThis as { window?: unknown }).window = fakeWindow;

    const base = {
      map: map as never,
      now,
      getAutoRouteMapPick: () => null as "start" | "direction" | null,
      isRoutePickOverlayOpen: () => false,
      shouldBlockPick: () => false,
      onLongPressPick: () => events.push("long"),
      onDirectionShortTap: () => events.push("direction"),
      onShortTapNoPick: () => events.push("hint"),
      onActivityPinShortTap: () => false,
      scheduleTimeout,
      cancelScheduled,
      ...overrides,
    };

    const detach = attachMapRoutePickGesture(base);
    cleanups.push(() => {
      detach();
      (globalThis as { document?: unknown }).document = prevDocument;
      (globalThis as { window?: unknown }).window = prevWindow;
    });

    const advance = (ms: number) => {
      clock += ms;
      flushTimers();
    };

    return { canvas, map, events, advance, detach };
  }

  it("짧은 탭은 hint만, 롱프레스 1회", () => {
    const h = installHarness();
    h.canvas.dispatch("pointerdown", { clientX: 50, clientY: 50 });
    h.advance(100);
    h.canvas.dispatch("pointerup", { clientX: 50, clientY: 50 });
    assert.deepEqual(h.events, ["hint"]);

    h.events.length = 0;
    h.canvas.dispatch("pointerdown", { clientX: 80, clientY: 80 });
    h.advance(MAP_ROUTE_PICK_LONG_PRESS_MS);
    assert.deepEqual(h.events, ["long"]);
    h.canvas.dispatch("pointerup", { clientX: 80, clientY: 80 });
    assert.deepEqual(h.events, ["long"]);
  });

  it("10px 이상 이동 시 롱프레스 취소", () => {
    const h = installHarness();
    h.canvas.dispatch("pointerdown", { clientX: 20, clientY: 20 });
    h.canvas.dispatch("pointermove", { clientX: 35, clientY: 20, pointerId: 1 });
    h.advance(MAP_ROUTE_PICK_LONG_PRESS_MS + 50);
    h.canvas.dispatch("pointerup", { clientX: 35, clientY: 20 });
    assert.deepEqual(h.events, []);
  });

  it("direction armed 짧은 탭", () => {
    const h = installHarness({
      getAutoRouteMapPick: () => "direction",
    });
    h.canvas.dispatch("pointerdown", { clientX: 40, clientY: 40 });
    h.advance(80);
    h.canvas.dispatch("pointerup", { clientX: 40, clientY: 40 });
    assert.deepEqual(h.events, ["direction"]);
  });

  it("긴 touch의 메뉴→cancel 뒤 다음 첫 touch를 억제하지 않고 각1회 확정", () => {
    let busy=false;
    const h=installHarness({getAutoRouteMapPick:()=>"direction",shouldBlockPick:()=>busy});
    // 앱 timer가 먼저 실행되고 탐색 중에 native 메뉴/cancel이 도착하는 순서.
    h.canvas.dispatch("pointerdown",{clientX:40,clientY:40,pointerType:"touch"});
    h.advance(500);busy=true;
    h.canvas.dispatch("contextmenu",{clientX:40,clientY:40,pointerType:"touch"});
    h.canvas.dispatch("pointercancel",{clientX:40,clientY:40,pointerType:"touch"});
    busy=false;
    // 별도 대기/두 번째 탭 없이 다음 첫 press가 들어간다.
    h.canvas.dispatch("pointerdown",{clientX:80,clientY:40,pointerType:"touch"});
    h.advance(500);
    h.canvas.dispatch("contextmenu",{clientX:80,clientY:40,pointerType:"touch"});
    h.canvas.dispatch("pointercancel",{clientX:80,clientY:40,pointerType:"touch"});
    assert.deepEqual(h.events,["long","long"]);
    h.advance(1000);assert.equal(h.events.length,2);
  });

  it("native 메뉴가 timer보다 먼저 도착해도 touch 한 번만 확정, 이동/우클릭은 취소",()=>{
    const h=installHarness();
    h.canvas.dispatch("pointerdown",{clientX:40,clientY:40,pointerType:"touch"});
    h.advance(400);
    h.canvas.dispatch("contextmenu",{clientX:40,clientY:40,pointerType:"touch"});
    h.canvas.dispatch("pointercancel",{clientX:40,clientY:40,pointerType:"touch"});
    h.advance(1000);assert.deepEqual(h.events,["long"]);
    h.canvas.dispatch("pointerdown",{clientX:40,clientY:40,pointerType:"touch"});
    h.canvas.dispatch("pointermove",{clientX:60,clientY:40,pointerType:"touch"});
    h.canvas.dispatch("contextmenu",{pointerType:"touch"});
    h.canvas.dispatch("pointercancel",{pointerType:"touch"});
    h.advance(1000);assert.deepEqual(h.events,["long"]);
    h.canvas.dispatch("pointerdown",{clientX:40,clientY:40,pointerType:"mouse"});
    h.canvas.dispatch("contextmenu",{pointerType:"mouse"});
    h.advance(1000);assert.deepEqual(h.events,["long"]);
  });

  it("사용자 drag 직후 suppress", () => {
    const h = installHarness();
    h.map.emit("dragstart", { originalEvent: {} });
    h.canvas.dispatch("pointerdown", { clientX: 60, clientY: 60 });
    h.advance(MAP_ROUTE_PICK_LONG_PRESS_MS + 10);
    h.canvas.dispatch("pointerup", { clientX: 60, clientY: 60 });
    assert.deepEqual(h.events, []);

    h.map.emit("dragend", { originalEvent: {} });
    h.canvas.dispatch("pointerdown", { clientX: 60, clientY: 60 });
    h.advance(100);
    h.canvas.dispatch("pointerup", { clientX: 60, clientY: 60 });
    assert.deepEqual(h.events, []);
    h.advance(MAP_ROUTE_PICK_GESTURE_SUPPRESS_MS + 1);
    h.canvas.dispatch("pointerdown", { clientX: 60, clientY: 60 });
    h.advance(MAP_ROUTE_PICK_LONG_PRESS_MS);
    assert.deepEqual(h.events, ["long"]);
  });

  it("움직였다 원점 복귀·멀티터치·cleanup은 선택을 만들지 않는다", () => {
    const h = installHarness();
    h.canvas.dispatch("pointerdown", { clientX: 20, clientY: 20 });
    h.canvas.dispatch("pointermove", { clientX: 40, clientY: 20 });
    h.canvas.dispatch("pointermove", { clientX: 20, clientY: 20 });
    h.advance(600);
    h.canvas.dispatch("pointerup", { clientX: 20, clientY: 20 });
    assert.deepEqual(h.events, []);
    h.advance(301);
    h.canvas.dispatch("pointerdown", { clientX: 20, clientY: 20 });
    h.canvas.dispatch("pointerdown", { pointerId: 2, isPrimary: false });
    h.advance(600);
    assert.deepEqual(h.events, []);
    h.canvas.dispatch("pointerup", { clientX: 20, clientY: 20 });
    h.advance(301);
    h.canvas.dispatch("pointerdown", { clientX: 20, clientY: 20 });
    h.detach();
    h.advance(600);
    assert.deepEqual(h.events, []);
  });

  it("사용자 zoom은 종료 뒤까지 억제하고 프로그램 카메라 이동은 허용", () => {
    const h = installHarness({getAutoRouteMapPick: () => "direction"});
    h.map.emit("zoomstart", {originalEvent:{}});
    h.advance(900);
    h.canvas.dispatch("pointerdown", {clientX:20,clientY:20});
    h.canvas.dispatch("pointerup", {clientX:20,clientY:20});
    assert.deepEqual(h.events, []);
    h.map.emit("zoomend");
    h.advance(301);
    h.map.emit("zoomstart", {});
    h.canvas.dispatch("pointerdown", {clientX:20,clientY:20});
    h.advance(100);
    h.canvas.dispatch("pointerup", {clientX:20,clientY:20});
    assert.deepEqual(h.events, ["direction"]);
  });

  it("오버레이 열림 시 롱프레스 차단", () => {
    const h = installHarness({
      isRoutePickOverlayOpen: () => true,
    });
    h.canvas.dispatch("pointerdown", { clientX: 70, clientY: 70 });
    h.advance(MAP_ROUTE_PICK_LONG_PRESS_MS + 10);
    h.canvas.dispatch("pointerup", { clientX: 70, clientY: 70 });
    assert.deepEqual(h.events, []);
  });

  it("pointercancel·resize cleanup", () => {
    const h = installHarness();
    h.canvas.dispatch("pointerdown", { clientX: 10, clientY: 10 });
    h.canvas.dispatch("pointercancel", { clientX: 10, clientY: 10 });
    h.advance(MAP_ROUTE_PICK_LONG_PRESS_MS + 10);
    assert.deepEqual(h.events, []);

    h.canvas.dispatch("pointerdown", { clientX: 10, clientY: 10 });
    globalThis.window?.dispatchEvent(new Event("resize"));
    h.advance(MAP_ROUTE_PICK_LONG_PRESS_MS + 10);
    assert.deepEqual(h.events, []);
  });

  it("UI pointerdown 누수 — canvas에서 시작하지 않은 up 무시", () => {
    const h = installHarness();
    (globalThis.document as { dispatchPointer: (t: string, i: Partial<MockPointerEvent>) => void }).dispatchPointer(
      "pointerdown",
      { clientX: 1, clientY: 1, pointerId: 9 },
    );
    h.canvas.dispatch("pointerup", { clientX: 50, clientY: 50, pointerId: 9 });
    assert.deepEqual(h.events, []);
  });
});

describe("MapView route pick gesture contract", () => {
  it("map.on(click) 경로 선택 제거·attachMapRoutePickGesture 연결", () => {
    assert.doesNotMatch(MAP_VIEW_SRC, /map\.on\("click"/);
    assert.match(MAP_VIEW_SRC, /attachMapRoutePickGesture/);
    assert.match(MAP_VIEW_SRC, /map-view__route-pick-hint/);
    assert.match(MAP_VIEW_SRC, /onLongPressPick:\s*runLongPressRoutePick/);
    assert.match(MAP_VIEW_SRC, /onDirectionShortTap:/);
  });
});

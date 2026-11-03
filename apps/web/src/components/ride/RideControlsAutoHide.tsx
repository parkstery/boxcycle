import { useEffect, useRef, useState } from "react";
import "./RideControlsAutoHide.css";
import { RIDE_CONTROLS_HIDE_SOON_EVENT } from "./rideControlsHide";

/** Chief 11-02 D3: 손대지 않고 5초면 오른쪽 2열 4줄 묶음(⏸·⏹ 포함)을 숨긴다. v4부터 왼쪽 아래는 숨기지 않는다. */
const RIDE_CONTROLS_HIDE_MS = 5000;
const HINT_MS = 3500;
const HINT_SEEN_KEY = "rtw-ride-controls-hint-seen";
/**
 * 열려 있으면 숨기지 않는다 — 카메라 메뉴·창(설정·결과 등).
 * 펼친 경로 카드는 넣지 않는다(2026-11-03 Chief 「터치 토글·5초 자동 hide 가 모두 안 된다」): 11-03 부터 카드가
 * 지도가 비치는 줄 띠라 펼친 채 달리는데, 그동안 숨김·탭 토글이 통째로 멈췄다. 카드는 그대로 두고 버튼만 숨는다.
 */
const BUSY_SELECTOR = ".camera-view-menu__panel, [role='dialog'], .ride-control-bar__resume";
/** Chief 11-03: 왼쪽 원형 메뉴 버튼도 오른쪽 묶음과 함께 숨고 나온다(CSS 는 EdgePanelHandle.css). */
const CONTROLS_SELECTOR = ".map-hud__rail, .edge-panel-tab--left";
/** 탭 판정 — 이 거리·시간 안에 떼면 탭(그보다 크면 지도 끌기·길게 누르기). */
const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 500;
/** 여기 안을 누르면 「지도 탭」이 아니다(버튼·창·입력·지도 핀). 누른 것은 늘 보이게 한다. */
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [role='button'], [role='dialog'], [role='tab'], [role='slider'], [contenteditable], .mapboxgl-ctrl, .mapboxgl-marker, .mapboxgl-popup";

/** 닫힌 메뉴·창도 DOM 에 남아 있다(aria-hidden·inert) — 그건 열린 것으로 치지 않는다. */
function somethingOpen(): boolean {
  return [...document.querySelectorAll(BUSY_SELECTOR)].some((el) => !el.closest("[aria-hidden='true'], [inert]"));
}

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHintSeen(): void {
  try {
    localStorage.setItem(HINT_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * 주행 중(일시정지 제외)에만 동작한다. 5초 동안 손대지 않으면 숨고, 지도 빈 곳을 탭하면 보이기↔숨기기(Chief 11-03).
 * 버튼·창을 누르거나 키를 누르면 보이고 5초를 새로 센다. 지도 끌기·확대는 토글하지 않는다.
 * 누른 동작은 막지 않는다 — 지도 끌기·확대는 그대로 지도가 받는다.
 * 숨김 상태는 `body[data-ride-controls="hidden"]` 하나로 알리고 CSS 가 오른쪽 묶음·왼쪽 메뉴 버튼을 뺀다.
 */
export function RideControlsAutoHide({ active }: { active: boolean }) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const [hint, setHint] = useState(false);
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (!active) {
      setHidden(false);
      setHint(false);
    }
  }

  useEffect(() => {
    hiddenRef.current = false;
    if (!active) return;
    let timer = 0;
    let soon = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // 키보드로 버튼에 머물러 있으면 미룬다. 손가락·마우스로 누른 뒤 남은 포커스는 치지 않는다.
        const el = document.activeElement;
        const focused = el?.closest(CONTROLS_SELECTOR) && el.matches(":focus-visible");
        if (focused || somethingOpen()) {
          arm();
          return;
        }
        hiddenRef.current = true;
        setHidden(true);
        if (!readHintSeen()) {
          writeHintSeen();
          setHint(true);
        }
      }, RIDE_CONTROLS_HIDE_MS);
    };
    const wake = () => {
      window.clearTimeout(soon);
      hiddenRef.current = false;
      setHidden(false);
      arm();
    };
    const hideNow = () => {
      window.clearTimeout(soon);
      window.clearTimeout(timer);
      hiddenRef.current = true;
      setHidden(true);
    };
    const hideSoon = (event: Event) => {
      window.clearTimeout(soon);
      soon = window.setTimeout(hideNow, (event as CustomEvent<number>).detail);
    };
    /*
     * Chief 11-03: 지도 빈 곳을 짧게 탭하면 보이기↔숨기기(5초 자동 숨김은 그대로). 버튼·창을 누르면 늘 보이게 하고 5초를 새로 센다.
     * 지도 끌기·두 손가락 확대·길게 누르기는 토글하지 않고 5초만 새로 센다. 누른 동작 자체는 막지 않는다.
     */
    const taps = new Map<number, { x: number; y: number; t: number; map: boolean }>();
    let multi = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target instanceof Element ? e.target : null;
      const map = !target?.closest(INTERACTIVE_SELECTOR);
      if (taps.size > 0) multi = true;
      taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, map });
      if (!map) wake();
      else if (!hiddenRef.current) arm();
    };
    const onUp = (e: PointerEvent) => {
      const start = taps.get(e.pointerId);
      taps.delete(e.pointerId);
      if (!start) return;
      const wasMulti = multi;
      if (taps.size === 0) multi = false;
      if (!start.map || wasMulti) return;
      const tap = Math.hypot(e.clientX - start.x, e.clientY - start.y) <= TAP_SLOP_PX && e.timeStamp - start.t <= TAP_MAX_MS;
      if (!tap) {
        if (!hiddenRef.current) arm();
        return;
      }
      if (hiddenRef.current) wake();
      else if (!somethingOpen()) hideNow();
      else arm();
    };
    const onCancel = (e: PointerEvent) => {
      taps.delete(e.pointerId);
      if (taps.size === 0) multi = false;
    };
    // 휠 확대는 두 손가락 확대와 같다 — 보이는 동안만 5초를 새로 센다.
    const onWheel = () => {
      if (!hiddenRef.current) arm();
    };
    arm();
    window.addEventListener(RIDE_CONTROLS_HIDE_SOON_EVENT, hideSoon);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    window.addEventListener("keydown", wake, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(soon);
      window.removeEventListener(RIDE_CONTROLS_HIDE_SOON_EVENT, hideSoon);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      window.removeEventListener("keydown", wake, true);
      window.removeEventListener("wheel", onWheel, true);
    };
  }, [active]);

  useEffect(() => {
    if (hidden) document.body.dataset.rideControls = "hidden";
    else delete document.body.dataset.rideControls;
    return () => {
      delete document.body.dataset.rideControls;
    };
  }, [hidden]);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), HINT_MS);
    return () => window.clearTimeout(t);
  }, [hint]);

  return hint ? (
    <p className="ride-controls-hint" role="status">
      화면을 누르면 버튼이 나타나요
    </p>
  ) : null;
}

import { useEffect, useState } from "react";
import "./RideControlsAutoHide.css";

/** Chief 11-02 D3: 손대지 않고 5초면 오른쪽 조작 레일·왼쪽 아래 접힌 버튼 줄(⏸ 포함)을 숨긴다. */
const RIDE_CONTROLS_HIDE_MS = 5000;
const HINT_MS = 3500;
const HINT_SEEN_KEY = "rtw-ride-controls-hint-seen";
/** 열려 있으면 숨기지 않는다 — 카메라 메뉴·펼친 경로 카드·창(설정·결과 등). */
const BUSY_SELECTOR = ".camera-view-menu__panel, .route-dock-anchor--open, [role='dialog'], .ride-control-bar__resume";
const CONTROLS_SELECTOR = ".map-hud__rail, .route-dock-anchor";

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
 * 주행 중(일시정지 제외)에만 동작한다. 화면 어디든 누르거나 키를 누르면 다시 보이고 5초를 새로 센다.
 * 누른 동작은 막지 않는다 — 지도 끌기·확대는 그대로 지도가 받는다.
 * 숨김 상태는 `body[data-ride-controls="hidden"]` 하나로 알리고 CSS 가 레일·줄·순위 목록을 움직인다.
 */
export function RideControlsAutoHide({ active }: { active: boolean }) {
  const [hidden, setHidden] = useState(false);
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
    if (!active) return;
    let timer = 0;
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
        setHidden(true);
        if (!readHintSeen()) {
          writeHintSeen();
          setHint(true);
        }
      }, RIDE_CONTROLS_HIDE_MS);
    };
    const wake = () => {
      setHidden(false);
      arm();
    };
    arm();
    window.addEventListener("pointerdown", wake, true);
    window.addEventListener("keydown", wake, true);
    window.addEventListener("wheel", wake, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", wake, true);
      window.removeEventListener("keydown", wake, true);
      window.removeEventListener("wheel", wake, true);
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

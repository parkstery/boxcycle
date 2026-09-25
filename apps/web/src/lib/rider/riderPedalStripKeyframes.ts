import { RIDER_PEDAL_CELL_PX, RIDER_PEDAL_FRAME_COUNT } from "./riderPedalSpriteMeta";

const STYLE_ID = "boxcycle-rider-pedal-strip-keyframes";

/**
 * 프레임 수에 따른 `steps(N)`·키프레임을 한 번만 주입한다.
 * 보고서의 `ridingPedalStripKeyframes.ts`와 동일한 역할.
 */
export function ensureRiderPedalStripKeyframes(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const N = RIDER_PEDAL_FRAME_COUNT;
  const CELL = RIDER_PEDAL_CELL_PX;
  const totalW = N * CELL;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
@keyframes cycling-marker-riding-pedal-cycle {
  from { background-position: 0 0; }
  to { background-position: -${totalW}px 0; }
}
.cycling-sim-marker-pedal-sprite {
  width: ${CELL}px;
  height: ${CELL}px;
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-size: ${totalW}px ${CELL}px;
  background-position: 0 0;
  animation-name: cycling-marker-riding-pedal-cycle;
  animation-timing-function: steps(${N}, end);
  animation-iteration-count: infinite;
  animation-play-state: paused;
  user-select: none;
  -webkit-user-drag: none;
}
`;
  document.head.appendChild(style);
}

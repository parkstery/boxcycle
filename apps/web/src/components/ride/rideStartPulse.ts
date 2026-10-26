import "./RideMediaButton.css";

/**
 * Chief 2026-10-26: 경로 탐색이 끝나면 두 「주행」 버튼(경로 생성 창·우측 하단)이 같은 순간 다섯 번 펄싱한다.
 * 두 버튼은 App 의 펄스 번호(`useRideStartPulseKey`) 하나를 따라 이 함수로 펄스를 처음부터 다시 튼다.
 * 클래스가 남아 있으면 브라우저가 애니메이션을 다시 시작하지 않으므로, 지웠다 붙이고 다섯 번이 끝나면 지운다.
 */
const PULSE_CLASS = "ride-start-ready-pulse";
const clearsOnEnd = new WeakSet<HTMLElement>();

export function restartRideStartPulse(button: HTMLElement): void {
  if (!clearsOnEnd.has(button)) {
    clearsOnEnd.add(button);
    button.addEventListener("animationend", (event) => {
      if (event.animationName === PULSE_CLASS) button.classList.remove(PULSE_CLASS);
    });
  }
  button.classList.remove(PULSE_CLASS);
  void button.offsetWidth;
  button.classList.add(PULSE_CLASS);
}

/** 펄스 도중 눌러도 주행은 시작된다 — 누른 뒤에는 펄스만 멈춘다. */
export function stopRideStartPulse(button: HTMLElement): void {
  button.classList.remove(PULSE_CLASS);
}

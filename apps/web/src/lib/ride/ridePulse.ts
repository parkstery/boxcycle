/**
 * 주행 펄스 — 「내 위치 마커」와 HUD 「새 도로」가 **같은 박자·같은 위상**으로 뛰게 하는 단일 출처.
 *
 * 종전 「새 도로」는 값이 바뀔 때마다(`key={conquestLiveMeters}`) 0.35s 팝을 다시 틀었다.
 * 그래서 빠르게 달릴수록 값이 자주 갱신돼 주기가 짧아지고 촐랑거렸다 — 펄스가 아니라
 * 갱신 알림이었던 셈이다(2026-09-17 Chief). 이제는 속도와 무관한 고정 박자로 뛴다.
 *
 * 박자 값 자체는 CSS 변수 `--rtw-ride-pulse-period`(tokens.css)가 단일 출처이고,
 * 여기 상수는 그 값을 JS 쪽에서 쓰기 위한 사본이다 — 바꿀 때 둘을 함께 옮긴다.
 */
export const RIDE_PULSE_PERIOD_MS = 2200;

/**
 * 공통 시계(`performance.now()`)의 절대 격자에 위상을 못 박는 음수 `animation-delay`.
 *
 * CSS 애니메이션은 «요소에 적용된 순간»부터 돈다. 마커와 HUD 셀은 마운트 시각이 다르므로
 * 그냥 같은 duration 을 주면 박자는 같아도 위상이 어긋난 채 **고정**된다(운 나쁘면 정반대).
 * 음수 지연으로 「이미 이만큼 돌아간 상태」에서 시작시키면, 언제 마운트되든 같은 격자 위에 선다.
 * CSS 만으로는 시계를 읽을 수 없어 이 계산이 필요하다.
 */
export function ridePulseAnimationDelay(): string {
  const offsetMs = performance.now() % RIDE_PULSE_PERIOD_MS;
  return `-${(offsetMs / 1000).toFixed(3)}s`;
}

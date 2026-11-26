/** 센서 버튼 도안은 계기판과 메뉴에서 함께 사용한다. */
export function CadenceKnob({ led, pulsing }: { led: string; pulsing: boolean }) {
  return (
    <span className="hud-cadence__knob" aria-hidden>
      <svg className="hud-cadence__crank" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="13" r="5" />
        <circle cx="10" cy="13" r="1.5" />
        <path d="M10 13 17 6m-2-1h4M7 19h4" />
      </svg>
      <span className={`hud-cadence__led hud-cadence__led--${led}${pulsing ? " hud-cadence__led--pulse" : ""}`} />
    </span>
  );
}

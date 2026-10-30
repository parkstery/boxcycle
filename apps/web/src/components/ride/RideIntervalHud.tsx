import type { RideIntervalView } from "../../lib/ride/rideInterval";
import "./RideIntervalHud.css";

type Props = {
  view: RideIntervalView;
  paused: boolean;
  cadenceRpm: number | null;
};

/** 계기판 아래 왼쪽. 표시 전용: 빈 영역의 지도 제스처를 막지 않는다. */
export function RideIntervalHud({ view, paused, cadenceRpm }: Props) {
  const complete = view.phase === "complete";
  const label = paused && !complete ? "일시정지" : view.label;
  const validRpm = cadenceRpm != null && Number.isFinite(cadenceRpm);
  const time = view.remainingSec > 59
    ? `${Math.floor(view.remainingSec / 60)}:${String(view.remainingSec % 60).padStart(2, "0")}`
    : String(view.remainingSec);
  const roundText = view.totalRounds > 1 ? ` · ${view.round}/${view.totalRounds}라운드` : "";
  const next = complete
    ? view.nextLabel
    : paused
      ? "주행 재개 시 이어서"
      : !validRpm
        ? "페달 강도 직접 조절"
        : view.nextLabel;
  return (
    <section className="ride-interval-hud" data-phase={view.phase} data-paused={paused} role="group" aria-label="인터벌 안내">
      <div className="ride-interval-hud__head">
        <span className="ride-interval-hud__phase">{label}</span>
        {view.totalRounds > 1 ? <span className="ride-interval-hud__round">{view.round}/{view.totalRounds}라운드</span> : null}
      </div>
      <span className="ride-interval-hud__announcement" role="status">{label} · {view.repeat}/{view.totalRepeats}{roundText}{complete ? " · 자유 주행 계속" : ""}</span>
      <div className="ride-interval-hud__main">
        <span className="ride-interval-hud__time" role="timer" aria-label={complete ? "인터벌 완료" : `남은 시간 ${view.remainingSec}초`}>
          {complete ? "완료" : time}
        </span>
        {!complete && view.remainingSec <= 59 ? <span className="ride-interval-hud__unit">초</span> : null}
        {!complete ? <svg className="ride-interval-hud__progress" viewBox="0 0 44 44" role="img" aria-label={`${view.totalRepeats}회 중 ${view.repeat}회째`}>
          <title>반복 진행</title>
          {Array.from({ length: view.totalRepeats }, (_, index) => {
            const step = 360 / view.totalRepeats;
            const start = (-90 + index * step + 2) * Math.PI / 180;
            const end = (-90 + (index + 1) * step - 2) * Math.PI / 180;
            return <path key={index}
              d={`M ${22 + 17 * Math.cos(start)} ${22 + 17 * Math.sin(start)} A 17 17 0 ${step - 4 > 180 ? 1 : 0} 1 ${22 + 17 * Math.cos(end)} ${22 + 17 * Math.sin(end)}`}
              data-active={view.repeat === index + 1} data-done={index + 1 < view.repeat || view.phase === "cooldown"} />;
          })}
          <text className="ride-interval-hud__repeat" x="22" y="23" textAnchor="middle" dominantBaseline="middle">{view.repeat} / {view.totalRepeats}</text>
        </svg> : null}
      </div>
      <div className="ride-interval-hud__next">{next}</div>
    </section>
  );
}

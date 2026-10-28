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
        <span className="ride-interval-hud__repeat">{view.repeat} / {view.totalRepeats}{roundText}</span>
      </div>
      <span className="ride-interval-hud__announcement" role="status">{label} · {view.repeat}/{view.totalRepeats}{roundText}{complete ? " · 자유 주행 계속" : ""}</span>
      <div className="ride-interval-hud__main">
        <span className="ride-interval-hud__time" role="timer" aria-label={complete ? "인터벌 완료" : `남은 시간 ${view.remainingSec}초`}>
          {complete ? "완료" : time}
        </span>
        {!complete && view.remainingSec <= 59 ? <span className="ride-interval-hud__unit">초</span> : null}
      </div>
      {!complete ? <div className="ride-interval-hud__progress" aria-label={`${view.totalRepeats}회 중 ${view.repeat}회째`}>
        {Array.from({ length: view.totalRepeats }, (_, index) => <span key={index} data-active={view.repeat === index + 1} data-done={index + 1 < view.repeat || view.phase === "cooldown"} />)}
      </div> : null}
      <div className="ride-interval-hud__next">{next}</div>
    </section>
  );
}

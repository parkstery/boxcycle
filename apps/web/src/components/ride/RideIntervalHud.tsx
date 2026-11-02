import { formatRideIntervalClock, type RideIntervalView } from "../../lib/ride/rideInterval";
import "./RideIntervalHud.css";

type Props = {
  view: RideIntervalView;
  paused: boolean;
  cadenceRpm: number | null;
  /** Chief 11-02 v4 C단계: 접으면 단계·남은 시간·세트만 담은 알약. 누르면 다시 펼친다. */
  folded?: boolean;
  onToggleFold?: () => void;
};

const C = 22;
const R = 17;

function point(deg: number): string {
  const rad = (deg - 90) * Math.PI / 180;
  return `${C + R * Math.cos(rad)} ${C + R * Math.sin(rad)}`;
}

function segmentPath(index: number, total: number): string {
  const step = 360 / total;
  const start = index * step + 2;
  const end = (index + 1) * step - 2;
  return `M ${point(start)} A ${R} ${R} 0 ${step - 4 > 180 ? 1 : 0} 1 ${point(end)}`;
}

/**
 * 계기판 아래 왼쪽. 표시 전용: 빈 영역의 지도 제스처를 막지 않는다(누름은 접기 버튼·알약만 받는다).
 * Chief 11-01 D안: 바깥 도넛=반복 칸(진행 칸은 사이클 시간만큼 차오름), 안쪽 링=현재 단계 남은 시간, 아래 막대=전체 진도.
 */
export function RideIntervalHud({ view, paused, cadenceRpm, folded = false, onToggleFold }: Props) {
  const complete = view.phase === "complete";
  const label = paused && !complete ? "일시정지" : view.label;
  const validRpm = cadenceRpm != null && Number.isFinite(cadenceRpm);
  const time = view.remainingSec > 59 ? formatRideIntervalClock(view.remainingSec) : String(view.remainingSec);
  const roundText = view.totalRounds > 1 ? ` · ${view.round}/${view.totalRounds}세트` : "";
  const next = complete
    ? view.nextLabel
    : paused
      ? "주행 재개 시 이어서"
      : !validRpm
        ? "페달 강도 직접 조절"
        : view.nextLabel;
  const remainFrac = view.stepSec > 0 ? Math.min(1, Math.max(0, view.stepRemainingMs / (view.stepSec * 1000))) : 0;
  const totalPct = view.totalSec > 0 ? Math.min(100, (100 * view.elapsedMs) / (view.totalSec * 1000)) : 0;
  const cycling = view.phase === "work" || view.phase === "recovery";
  const hurry = !complete && !paused && view.remainingSec <= 3;
  const barSegments = view.segments.map((segment, index) => (
    <span key={index} data-phase={segment.phase} style={{ flexGrow: segment.seconds }} />
  ));
  const announcement = (
    <span className="ride-interval-hud__announcement" role="status">{label} · {view.repeat}/{view.totalRepeats}{roundText}{complete ? " · 자유 주행 계속" : ""}</span>
  );
  if (folded && onToggleFold) {
    return (
      <button type="button" className="ride-interval-hud ride-interval-hud--folded" data-phase={view.phase} data-paused={paused}
        aria-label="인터벌 패널 펼치기" aria-expanded={false} title="인터벌 패널 펼치기" onClick={onToggleFold}>
        <i className="ride-interval-hud__dot" aria-hidden="true" />
        <b className="ride-interval-hud__phase">{label}</b>
        <span className="ride-interval-hud__chip-time">{complete ? "완료" : time}</span>
        {view.totalRounds > 1 ? <em>{view.round}/{view.totalRounds}세트</em> : null}
        <span className="ride-interval-hud__chevron" aria-hidden="true">›</span>
        {announcement}
      </button>
    );
  }
  return (
    <section className="ride-interval-hud" data-phase={view.phase} data-paused={paused} data-hurry={hurry} role="group" aria-label="인터벌 안내">
      {onToggleFold ? (
        <button type="button" className="ride-interval-hud__fold" aria-label="인터벌 패널 접기" aria-expanded title="인터벌 패널 접기" onClick={onToggleFold}>
          <span aria-hidden="true">‹</span>
        </button>
      ) : null}
      <div className="ride-interval-hud__text">
        <span className="ride-interval-hud__round">{view.totalRounds > 1 ? `${view.round}/${view.totalRounds}세트` : ""}</span>
        <span className="ride-interval-hud__phase">{label}</span>
        <span className="ride-interval-hud__next">{next}</span>
        <span className="ride-interval-hud__total" data-long={view.totalSec >= 6000}>{formatRideIntervalClock(Math.floor(view.elapsedMs / 1000))} / {formatRideIntervalClock(view.totalSec)}</span>
      </div>
      {announcement}
      {complete ? (
        <span className="ride-interval-hud__time" role="timer" aria-label="인터벌 완료">완료</span>
      ) : (
        <svg className="ride-interval-hud__progress" viewBox="0 0 44 44" role="img" aria-label={`${view.totalRepeats}회 중 ${view.repeat}회째`}>
          <title>반복 진행</title>
          {Array.from({ length: view.totalRepeats }, (_, index) => (
            <path key={index} d={segmentPath(index, view.totalRepeats)} data-seg=""
              data-active={cycling && view.repeat === index + 1}
              data-done={view.phase === "rest" || view.phase === "cooldown" || (cycling && index + 1 < view.repeat)} />
          ))}
          {cycling ? (
            <path key={`fill-${view.round}-${view.repeat}`} className="ride-interval-hud__fill" d={segmentPath(view.repeat - 1, view.totalRepeats)}
              pathLength={1} strokeDasharray="1 1" style={{ strokeDashoffset: 1 - view.cycleProgress }} />
          ) : null}
          <g className="ride-interval-hud__inner">
            <circle className="ride-interval-hud__disc" cx={C} cy={C} r="9.3" />
            <circle className="ride-interval-hud__track" cx={C} cy={C} r="10.7" />
            <circle key={`remain-${view.step}`} className="ride-interval-hud__remain" cx={C} cy={C} r="10.7" transform={`rotate(-90 ${C} ${C})`}
              pathLength={1} strokeDasharray="1 1" style={{ strokeDashoffset: -(1 - remainFrac) }} />
          </g>
          <text className="ride-interval-hud__time" data-long={view.remainingSec > 59} x={C} y="22.6" textAnchor="middle" dominantBaseline="central"
            role="timer" aria-label={`남은 시간 ${view.remainingSec}초`}>{time}</text>
        </svg>
      )}
      <div className="ride-interval-hud__bar" aria-hidden="true">
        <div className="ride-interval-hud__bar-layer">{barSegments}</div>
        <div className="ride-interval-hud__bar-layer ride-interval-hud__bar-done" style={{ clipPath: `inset(0 ${100 - totalPct}% 0 0)` }}>{barSegments}</div>
        <i className="ride-interval-hud__bar-mark" style={{ left: `${totalPct}%` }} />
      </div>
    </section>
  );
}

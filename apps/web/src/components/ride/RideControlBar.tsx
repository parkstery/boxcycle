import { useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { sensorChipSlot } from "../../lib/route/sensorChipSlot";
import { CadenceHudChip, type CadenceChipBinding } from "../maphud/CadenceHudChip";
import "./RideControlBar.css";
import "./RideMediaButton.css";

export type RideControlBarProps = {
  stage: RideUiStage;
  routeLoading: boolean;
  routeSetupToken?: object | null;
  canStartRide: boolean;
  sensorAttention?: boolean;
  onStartRide: (fromStart?: boolean) => void;
  onPauseRide: () => void;
  onResumeRide: () => void;
  onEndRide: () => void;
  onModifyFromPause?: () => void;
  resumeRatio?: number | null;
  onAbandonResume?: (() => void) | null;
  editLocked?: boolean;
  cadence?: CadenceChipBinding | null;
  nextRideVisible?: boolean;
};
/** One fixed place for input preparation and transport; route addresses are independent. */
export function RideControlBar(props: RideControlBarProps) {
  const { stage, routeLoading, routeSetupToken = null, resumeRatio = null, cadence = null } = props;
  const [resumeOpen, setResumeOpen] = useState(false);
  const [pauseOptionsOpen, setPauseOptionsOpen] = useState(false);
  const [endedRoute, setEndedRoute] = useState<{ token: object | null } | null>(null);
  const [restartFromZero, setRestartFromZero] = useState(false);
  const [previousResume, setPreviousResume] = useState(resumeRatio);
  if (previousResume !== resumeRatio) {
    setPreviousResume(resumeRatio);
    setRestartFromZero(false);
    setResumeOpen(false);
  }
  const [cue, setCue] = useState<{ consumed: object | null; active: boolean }>({
    consumed: null,
    active: false,
  });
  if (routeSetupToken == null && cue.consumed != null) setCue({ consumed: null, active: false });
  else if (
    routeSetupToken != null &&
    routeSetupToken !== cue.consumed &&
    stage === "ready-to-start" &&
    !routeLoading
  ) {
    setCue({ consumed: routeSetupToken, active: true });
  } else if (cue.active && (stage !== "ready-to-start" || routeLoading)) {
    setCue({ ...cue, active: false });
  }

  const endedCurrentRoute = endedRoute !== null && endedRoute.token === routeSetupToken;
  const riding = stage === "riding" && !endedCurrentRoute;
  const paused = stage === "paused" && !endedCurrentRoute;
  const active = riding || paused;
  const ready = stage === "ready-to-start" && !endedCurrentRoute;
  const sensorVisible =
    sensorChipSlot({ stage, hasCadence: Boolean(cadence), expanded: true }) === "ride-control-bar";
  if (stage === "gate" || stage === "gate-nickname" || stage === "summary") return null;
  if (!ready && !active && !sensorVisible) return null;
  const startDisabled = !props.canStartRide || routeLoading || Boolean(props.editLocked);

  return (
    <div
      className={`ride-control-anchor${props.nextRideVisible ? " ride-control-anchor--with-next" : ""}`}
    >
      <div className="ride-control-bar" role="group" aria-label="주행 제어">
        {sensorVisible && cadence ? (
          <CadenceHudChip
            placement="dock"
            state={cadence.state}
            riding={active}
            open={cadence.open}
            onOpen={cadence.onOpen}
            attention={false}
          />
        ) : null}
        {ready && resumeRatio != null ? (
          <button
            type="button"
            className="ride-control-bar__resume-trigger"
            aria-label="이어 달리기 선택"
            aria-expanded={resumeOpen}
            onClick={() => setResumeOpen((v) => !v)}
          >
            {restartFromZero ? "처음부터" : `${Math.round(resumeRatio * 100)}%부터`} ▴
          </button>
        ) : null}
        {ready || paused ? (
          <button
            type="button"
            className={`ride-media-button ride-media-button--play ride-control-bar__primary${cue.active && ready ? " ride-control-bar__primary--cue" : ""}`}
            disabled={ready && startDisabled}
            aria-label={paused ? "재개" : "주행 시작"}
            onClick={() => {
              setResumeOpen(false);
              setPauseOptionsOpen(false);
              setCue((c) => ({ ...c, active: false }));
              if (paused) props.onResumeRide();
              else props.onStartRide(restartFromZero);
            }}
          >
            <span className="ride-media-button__icon" aria-hidden="true" />
          </button>
        ) : null}
        {riding ? (
          <button
            type="button"
            className="ride-media-button ride-media-button--pause"
            aria-label="일시정지"
            onClick={props.onPauseRide}
          >
            <span className="ride-media-button__icon" aria-hidden="true" />
          </button>
        ) : null}
        {active ? (
          <button
            type="button"
            className="ride-media-button ride-media-button--stop ride-control-bar__end"
            aria-label="주행 종료"
            onClick={() => {
              setEndedRoute({ token: routeSetupToken });
              setResumeOpen(false);
              setPauseOptionsOpen(false);
              props.onEndRide();
            }}
          >
            <span className="ride-media-button__icon" aria-hidden="true" />
          </button>
        ) : null}
        {paused && props.onModifyFromPause ? (
          <button
            type="button"
            aria-label="일시정지 옵션"
            aria-expanded={pauseOptionsOpen}
            onClick={() => setPauseOptionsOpen((v) => !v)}
          >
            ⋯
          </button>
        ) : null}
      </div>
      {paused && pauseOptionsOpen && props.onModifyFromPause ? (
        <div className="ride-control-bar__resume">
          <button
            type="button"
            onClick={() => {
              setPauseOptionsOpen(false);
              props.onModifyFromPause?.();
            }}
          >
            경로 변경
          </button>
          <button type="button" aria-label="일시정지 옵션 닫기" onClick={() => setPauseOptionsOpen(false)}>
            닫기
          </button>
        </div>
      ) : null}
      {ready && resumeRatio != null && resumeOpen ? (
        <div className="ride-control-bar__resume" role="group" aria-label="이어 달리기">
          <button
            type="button"
            className="ride-control-bar__resume-close"
            aria-label="이어 달리기 선택 닫기"
            onClick={() => setResumeOpen(false)}
          >
            ✕
          </button>
          <label>
            <input
              type="radio"
              name="ride-resume"
              checked={!restartFromZero}
              onChange={() => setRestartFromZero(false)}
            />
            {Math.round(resumeRatio * 100)}%부터 이어달리기
          </label>
          <label>
            <input
              type="radio"
              name="ride-resume"
              checked={restartFromZero}
              onChange={() => setRestartFromZero(true)}
            />
            처음부터
          </label>
          {props.onAbandonResume ? (
            <button
              type="button"
              aria-label="이어달리기 종료"
              onClick={() => {
                setResumeOpen(false);
                props.onAbandonResume?.();
              }}
            >
              이어달리기 종료
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

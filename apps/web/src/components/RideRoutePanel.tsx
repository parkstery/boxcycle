import type { RouteProfile } from "../services/mapboxDirections";
import { formatDuration } from "../services/mapboxDirections";
import type { RideSessionStatus } from "../hooks/useVirtualRideSession";
import type { StoredRideSession } from "../lib/rideSessionsStorage";
import "./RideRoutePanel.css";

export type FollowMode =
  | "free"
  | "keep"
  | "north"
  | "rear30"
  | "front30"
  | "rightFlat"
  | "leftFlat";

type RideRoutePanelProps = {
  startLabel: string;
  endLabel: string;
  profile: RouteProfile;
  onProfile: (p: RouteProfile) => void;
  routeSummary: string;
  routeLoading: boolean;
  onGenerateRoute: () => void;
  mapStyle: string;
  mapStyleOptions: { value: string; label: string }[];
  onMapStyle: (style: string) => void;
  followMode: FollowMode;
  onFollowMode: (mode: FollowMode) => void;
  enable3D: boolean;
  onEnable3D: (enabled: boolean) => void;
  mapZoom: number;
  onMapZoom: (zoom: number) => void;
  hasRoute: boolean;
  speedKmh: number;
  onSpeedKmh: (n: number) => void;
  sessionStatus: RideSessionStatus;
  onStartRide: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndRide: () => void;
  elapsedLabel: string;
  distanceKm: string;
  avgSpeedLabel: string;
  recentSessions: StoredRideSession[];
  basicStartLoading: boolean;
  basicStartHubJoined: boolean;
  userSignedIn: boolean;
  onEnterBasicStartHub: () => void;
  onLeaveBasicStartHub: () => void;
};

export function RideRoutePanel(props: RideRoutePanelProps) {
  const sessionLabel =
    props.sessionStatus === "idle"
      ? "대기"
      : props.sessionStatus === "running"
        ? "주행 중"
        : "일시정지";

  const canStart =
    props.sessionStatus === "idle" && props.hasRoute && !props.routeLoading;

  return (
    <aside className="ride-panel" aria-label="경로 및 라이딩">
      <h2 className="ride-panel__h">경로 설정</h2>
      <p className="ride-panel__help">지도 클릭 후 팝업에서 출발지/도착지를 선택하세요.</p>

      <div className="ride-panel__basic-start" aria-label="입문 상시 코스">
        <p className="ride-panel__basic-start-title">입문 코스 (상시)</p>
        <p className="ride-panel__basic-start-desc">
          스위스 그린델발트 인근 약 5km 코스를 불러옵니다. 로그인 시 같은 코스에 있는 주행자와 목록을
          공유합니다.
        </p>
        <div className="ride-panel__basic-start-btns">
          <button
            type="button"
            className="ride-panel__btn-secondary"
            disabled={
              props.routeLoading ||
              props.basicStartLoading ||
              props.sessionStatus !== "idle"
            }
            onClick={() => void props.onEnterBasicStartHub()}
          >
            {props.basicStartLoading ? "불러오는 중…" : "입문 코스 입장 (5km)"}
          </button>
          {props.userSignedIn && props.basicStartHubJoined ? (
            <button
              type="button"
              className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
              disabled={props.basicStartLoading}
              onClick={() => void props.onLeaveBasicStartHub()}
            >
              동행 목록에서 나가기
            </button>
          ) : null}
        </div>
        {!props.userSignedIn ? (
          <p className="ride-panel__basic-start-hint">로그인하면 동시 주행자 목록에 참여할 수 있습니다.</p>
        ) : null}
      </div>

      <div className="ride-panel__point-box">
        <p className="ride-panel__point-label">출발지</p>
        <p className="ride-panel__point-value">{props.startLabel}</p>
        <p className="ride-panel__point-label">도착지</p>
        <p className="ride-panel__point-value">{props.endLabel}</p>
      </div>

      <div className="ride-panel__modes">
        <span className="ride-panel__label-inline">이동 수단</span>
        <div className="ride-panel__mode-btns">
          <button
            type="button"
            className={`ride-panel__mode ${props.profile === "driving" ? "is-active" : ""}`}
            onClick={() => props.onProfile("driving")}
          >
            자동차
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.profile === "cycling" ? "is-active" : ""}`}
            onClick={() => props.onProfile("cycling")}
          >
            자전거
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.profile === "walking" ? "is-active" : ""}`}
            onClick={() => props.onProfile("walking")}
          >
            보행
          </button>
        </div>
      </div>

      <button
        type="button"
        className="ride-panel__btn-primary"
        disabled={props.routeLoading}
        onClick={() => void props.onGenerateRoute()}
      >
        {props.routeLoading ? "경로 계산 중…" : "경로 생성"}
      </button>
      <p className="ride-panel__summary" role="status">
        {props.routeSummary}
      </p>
      <label className="ride-panel__label">맵 스타일</label>
      <select
        className="ride-panel__input"
        value={props.mapStyle}
        onChange={(e) => props.onMapStyle(e.target.value)}
      >
        {props.mapStyleOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="ride-panel__modes">
        <span className="ride-panel__label-inline">카메라 추적</span>
        <div className="ride-panel__mode-btns">
          <button
            type="button"
            className={`ride-panel__mode ${props.followMode === "free" ? "is-active" : ""}`}
            onClick={() => props.onFollowMode("free")}
          >
            자유
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.followMode === "keep" ? "is-active" : ""}`}
            onClick={() => props.onFollowMode("keep")}
          >
            진행방향 유지
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.followMode === "north" ? "is-active" : ""}`}
            onClick={() => props.onFollowMode("north")}
          >
            북쪽 고정
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.followMode === "rear30" ? "is-active" : ""}`}
            onClick={() => props.onFollowMode("rear30")}
          >
            후방
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.followMode === "front30" ? "is-active" : ""}`}
            onClick={() => props.onFollowMode("front30")}
          >
            전방
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.followMode === "leftFlat" ? "is-active" : ""}`}
            onClick={() => props.onFollowMode("leftFlat")}
          >
            좌측
          </button>
          <button
            type="button"
            className={`ride-panel__mode ${props.followMode === "rightFlat" ? "is-active" : ""}`}
            onClick={() => props.onFollowMode("rightFlat")}
          >
            우측
          </button>
        </div>
      </div>

      <label className="ride-panel__label">
        <input
          type="checkbox"
          checked={props.enable3D}
          onChange={(e) => props.onEnable3D(e.target.checked)}
        />{" "}
        3D 뷰
      </label>
      <label className="ride-panel__label">
        맵 줌: <strong>{props.mapZoom.toFixed(1)}</strong>
      </label>
      <input
        type="range"
        min={3}
        max={20}
        step={0.1}
        value={props.mapZoom}
        onChange={(e) => props.onMapZoom(Number(e.target.value))}
        className="ride-panel__range"
      />

      <h2 className="ride-panel__h">라이딩 세션</h2>
      <label className="ride-panel__label">
        가상 속도: <strong>{props.speedKmh} km/h</strong>
      </label>
      <input
        type="range"
        min={5}
        max={50}
        step={1}
        value={props.speedKmh}
        onChange={(e) => props.onSpeedKmh(Number(e.target.value))}
        className="ride-panel__range"
      />

      <div className="ride-panel__metrics">
        <div>
          <span className="ride-panel__metric-label">상태</span>
          <strong>{sessionLabel}</strong>
        </div>
        <div>
          <span className="ride-panel__metric-label">경과</span>
          <strong>{props.elapsedLabel}</strong>
        </div>
        <div>
          <span className="ride-panel__metric-label">가상 거리</span>
          <strong>{props.distanceKm} km</strong>
        </div>
        <div>
          <span className="ride-panel__metric-label">평균 속도</span>
          <strong>{props.avgSpeedLabel} km/h</strong>
        </div>
      </div>

      <div className="ride-panel__session-btns">
        <button type="button" disabled={!canStart} onClick={props.onStartRide}>
          시작
        </button>
        <button
          type="button"
          disabled={props.sessionStatus !== "running"}
          onClick={props.onPause}
        >
          일시정지
        </button>
        <button
          type="button"
          disabled={props.sessionStatus !== "paused"}
          onClick={props.onResume}
        >
          재개
        </button>
        <button type="button" disabled={props.sessionStatus === "idle"} onClick={props.onEndRide}>
          종료
        </button>
      </div>

      <h2 className="ride-panel__h">최근 기록</h2>
      <ul className="ride-panel__sessions">
        {props.recentSessions.length === 0 ? (
          <li className="ride-panel__sessions-empty">저장된 기록이 없습니다.</li>
        ) : (
          props.recentSessions.slice(0, 8).map((s) => (
            <li key={s.id} className="ride-panel__session-item">
              <span>{formatDuration(s.elapsedSec)}</span>
              <span> · {(s.distanceMeters / 1000).toFixed(2)} km</span>
              <span className="ride-panel__session-date">
                {" "}
                · {new Date(s.endedAt).toLocaleString()}
              </span>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

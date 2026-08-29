import type { RouteProfile } from "../../services/mapboxDirections";
import type { DistanceAutoRouteStep } from "../../hooks/useDistanceAutoRoute";
import "./DistanceAutoRouteSheet.css";

const PROFILE_OPTIONS: { id: RouteProfile; label: string }[] = [
  { id: "cycling", label: "자전거" },
  { id: "driving", label: "자동차" },
  { id: "walking", label: "도보" },
];

export type DistanceAutoRouteSheetProps = {
  step: DistanceAutoRouteStep;
  targetKm: number;
  distancePresetsKm: readonly number[];
  profile: RouteProfile;
  statusMessage: string | null;
  isSearching: boolean;
  hasStart: boolean;
  onClose: () => void;
  onSetProfile: (p: RouteProfile) => void;
  onSetTargetKm: (km: number) => void;
  onConfirmStart: () => void;
  onConfirmProfile: () => void;
  onConfirmDistance: () => void;
};

export function DistanceAutoRouteSheet(props: DistanceAutoRouteSheetProps) {
  if (props.step === "closed") return null;

  return (
    <div
      className="distance-auto-route-sheet"
      role="dialog"
      aria-label="거리 기반 자동 경로"
    >
      <header className="distance-auto-route-sheet__head">
        <h2 className="distance-auto-route-sheet__title">거리 기반 자동 경로</h2>
        <button
          type="button"
          className="distance-auto-route-sheet__close"
          aria-label="닫기"
          onClick={props.onClose}
          disabled={props.isSearching}
        >
          ×
        </button>
      </header>

      <ol className="distance-auto-route-sheet__steps" aria-label="진행 단계">
        <li data-active={props.step === "pick_start"}>1. 출발</li>
        <li data-active={props.step === "pick_profile"}>2. 이동수단</li>
        <li data-active={props.step === "pick_distance" || props.step === "pick_direction"}>
          3. 목표 거리
        </li>
        <li data-active={props.step === "pick_direction" || props.step === "searching"}>
          4. 방향
        </li>
      </ol>

      {props.step === "pick_start" ? (
        <section className="distance-auto-route-sheet__body">
          <p>지도를 탭해 출발점을 정하세요.</p>
          {props.hasStart ? (
            <button type="button" className="distance-auto-route-sheet__primary" onClick={props.onConfirmStart}>
              출발 확정
            </button>
          ) : null}
        </section>
      ) : null}

      {props.step === "pick_profile" ? (
        <section className="distance-auto-route-sheet__body">
          <p>이동 수단을 선택하세요.</p>
          <div className="distance-auto-route-sheet__profiles" role="group" aria-label="이동 수단">
            {PROFILE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`distance-auto-route-sheet__chip${props.profile === opt.id ? " is-active" : ""}`}
                aria-pressed={props.profile === opt.id}
                onClick={() => props.onSetProfile(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button type="button" className="distance-auto-route-sheet__primary" onClick={props.onConfirmProfile}>
            다음
          </button>
        </section>
      ) : null}

      {props.step === "pick_distance" ? (
        <section className="distance-auto-route-sheet__body">
          <p>목표 거리(km) — 지도에 원이 표시됩니다.</p>
          <div className="distance-auto-route-sheet__presets">
            {props.distancePresetsKm.map((km) => (
              <button
                key={km}
                type="button"
                className={`distance-auto-route-sheet__chip${props.targetKm === km ? " is-active" : ""}`}
                onClick={() => props.onSetTargetKm(km)}
              >
                {km} km
              </button>
            ))}
          </div>
          <label className="distance-auto-route-sheet__slider-label">
            목표 거리
            <input
              type="range"
              min={1}
              max={50}
              step={0.5}
              value={props.targetKm}
              onChange={(e) => props.onSetTargetKm(Number(e.target.value))}
            />
            <span className="distance-auto-route-sheet__km">{props.targetKm.toFixed(1)} km</span>
          </label>
          <button type="button" className="distance-auto-route-sheet__primary" onClick={props.onConfirmDistance}>
            다음 — 방향 선택
          </button>
        </section>
      ) : null}

      {props.step === "pick_direction" || props.step === "searching" ? (
        <section className="distance-auto-route-sheet__body">
          <p>
            {props.isSearching
              ? "도로 스냅·실거리 계산 중…"
              : "가고 싶은 방향으로 지도를 탭하세요. 목표 거리에 가장 가까운 경로를 자동 선택합니다."}
          </p>
        </section>
      ) : null}

      {props.statusMessage ? (
        <p className="distance-auto-route-sheet__status" role="status">
          {props.statusMessage}
        </p>
      ) : null}
    </div>
  );
}

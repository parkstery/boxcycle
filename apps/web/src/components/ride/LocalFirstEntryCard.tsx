import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import type { LocalFirstRegion } from "../../lib/localFirstRegion";
import { LOCAL_FIRST_CAMERA_ZOOM, makeLocalFirstRegion, localFirstRegionLabel } from "../../lib/localFirstRegion";
import { installLocalFirstGeoProbe } from "../../lib/localFirstGeoProbe";
import { fetchMapboxReverseGeocodeRegionLabel } from "../../services/mapboxReverseGeocode";
import {
  READY_RIDE_DISTANCE_KM_OPTIONS,
  READY_RIDE_DEFAULT_DISTANCE_KM,
  formatReadyRideDistanceLabel,
} from "../../lib/readyRide";
import type { ReadyRideStatus } from "../../hooks/useReadyRide";
import "./LocalFirstEntryCard.css";

export type LocalFirstEntryCardProps = {
  region: LocalFirstRegion | null;
  mapboxAccessToken: string;
  /** 지명 검색 패널 열기(기존 PlaceSearchPanel) */
  onOpenRegionSearch: () => void;
  /** 지역 확정(검색·현재 위치) — App 이 카메라·localStorage 담당 */
  onConfirmRegion: (region: LocalFirstRegion) => void;
  /** 「다시 고르기」 */
  onClearRegion: () => void;
  /** 입문 경로 시작 — enterBasicHub 그대로 */
  onStartIntro: () => void;
  /** Ready Ride 생성(지시02) — 상태·핸들러는 App 이 useReadyRide 로 소유 */
  readyRideStatus: ReadyRideStatus;
  readyRideGeneratingLabel: string;
  readyRideSlow: boolean;
  readyRideFailMessage: string | null;
  onGenerateReadyRide: (targetDistanceKm: number) => void;
  onCancelReadyRide: () => void;
};

type Phase = "ready" | "locating" | "denied";

function blockMapPointer(e: PointerEvent | TouchEvent) {
  e.stopPropagation();
  e.preventDefault();
}

/**
 * Local First Recognition 카드 — 「어디에서 첫 라이딩을 할까요?」
 * 이전 주행이 없는 idle 에서만 표시되며 NextRideCard 와 동시에 뜨지 않는다.
 * Ready Ride 생성 버튼은 지시02.
 */
export function LocalFirstEntryCard({
  region,
  mapboxAccessToken,
  onOpenRegionSearch,
  onConfirmRegion,
  onClearRegion,
  onStartIntro,
  readyRideStatus,
  readyRideGeneratingLabel,
  readyRideSlow,
  readyRideFailMessage,
  onGenerateReadyRide,
  onCancelReadyRide,
}: LocalFirstEntryCardProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [failReason, setFailReason] = useState<string | null>(null);
  const [readyKm, setReadyKm] = useState<number>(READY_RIDE_DEFAULT_DISTANCE_KM);
  const geoAbortRef = useRef<AbortController | null>(null);
  const geoAvailable =
    typeof navigator !== "undefined" && typeof navigator.geolocation !== "undefined";

  useEffect(() => {
    installLocalFirstGeoProbe();
  }, []);

  useEffect(() => {
    return () => {
      geoAbortRef.current?.abort();
    };
  }, []);

  const handleUseCurrentLocation = () => {
    if (!geoAvailable || phase === "locating") return;
    setPhase("locating");
    setFailReason(null);
    geoAbortRef.current?.abort();
    const ac = new AbortController();
    geoAbortRef.current = ac;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (ac.signal.aborted) return;
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        void (async () => {
          try {
            const label = await fetchMapboxReverseGeocodeRegionLabel(
              lngLat,
              mapboxAccessToken,
              ac.signal,
            );
            if (ac.signal.aborted) return;
            const name = localFirstRegionLabel(label) || "현재 위치";
            onConfirmRegion(
              makeLocalFirstRegion({
                name,
                lngLat,
                source: "geolocation",
                zoom: LOCAL_FIRST_CAMERA_ZOOM,
              }),
            );
            setPhase("ready");
            setFailReason(null);
          } catch {
            if (ac.signal.aborted) return;
            setPhase("denied");
            setFailReason("지명을 확인하지 못했습니다");
          }
        })();
      },
      (err) => {
        if (ac.signal.aborted) return;
        setPhase("denied");
        if (err.code === err.PERMISSION_DENIED) setFailReason("위치 권한이 거부되었습니다");
        else if (err.code === err.TIMEOUT) setFailReason("위치 확인 시간이 초과되었습니다");
        else setFailReason("위치를 가져오지 못했습니다");
      },
      { timeout: 8000, maximumAge: 600_000 },
    );
  };

  const showS2 = phase === "denied" && !region;
  const showS1 = Boolean(region) && !showS2;

  return (
    <div
      className="local-first-anchor"
      aria-label="첫 라이딩 지역"
      onPointerDown={blockMapPointer}
      onTouchStart={blockMapPointer}
    >
      <div className="local-first__card hud-glass" role="group">
        {showS1 && region ? (
          <>
            <p className="local-first__title">
              {region.name} · 여기서 첫 Ready Ride
            </p>

            <div className="local-first__chips" role="group" aria-label="Ready Ride 거리">
              {READY_RIDE_DISTANCE_KM_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={
                    "local-first__chip" + (km === readyKm ? " local-first__chip--active" : "")
                  }
                  aria-pressed={km === readyKm}
                  disabled={readyRideStatus === "generating"}
                  onClick={() => setReadyKm(km)}
                >
                  {formatReadyRideDistanceLabel(km)}
                </button>
              ))}
            </div>

            {readyRideStatus === "generating" ? (
              <div className="local-first__generating" role="status">
                <span className="local-first__generating-label">{readyRideGeneratingLabel}</span>
                {readyRideSlow ? (
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--ghost"
                    onClick={onCancelReadyRide}
                  >
                    취소
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="local-first__actions">
                <button
                  type="button"
                  className="local-first__btn local-first__btn--primary"
                  onClick={() => onGenerateReadyRide(readyKm)}
                >
                  Ready Ride 시작
                </button>
                <button
                  type="button"
                  className="local-first__btn local-first__btn--ghost"
                  onClick={() => {
                    setPhase("ready");
                    setFailReason(null);
                    onClearRegion();
                  }}
                >
                  다시 고르기
                </button>
              </div>
            )}

            {readyRideStatus === "failed" && readyRideFailMessage ? (
              <div className="local-first__ready-fail">
                <p className="local-first__fail">{readyRideFailMessage}</p>
                <div className="local-first__actions">
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--primary"
                    onClick={() => onGenerateReadyRide(readyKm)}
                  >
                    다시
                  </button>
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--ghost"
                    onClick={() => {
                      setPhase("ready");
                      setFailReason(null);
                      onClearRegion();
                    }}
                  >
                    지역 다시 고르기
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : showS2 ? (
          <>
            <p className="local-first__title">위치를 확인하지 못했습니다</p>
            <p className="local-first__body">지역을 직접 고르세요</p>
            {failReason ? <p className="local-first__fail">{failReason}</p> : null}
            <div className="local-first__actions">
              <button
                type="button"
                className="local-first__btn local-first__btn--primary"
                onClick={() => {
                  setPhase("ready");
                  onOpenRegionSearch();
                }}
              >
                지역 선택
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="local-first__title">어디에서 첫 라이딩을 할까요?</p>
            <div className="local-first__actions">
              <button
                type="button"
                className="local-first__btn local-first__btn--primary"
                onClick={onOpenRegionSearch}
              >
                지역 선택
              </button>
              {geoAvailable ? (
                <button
                  type="button"
                  className="local-first__btn local-first__btn--ghost"
                  disabled={phase === "locating"}
                  onClick={handleUseCurrentLocation}
                >
                  {phase === "locating" ? "확인 중…" : "현재 위치"}
                </button>
              ) : null}
            </div>
          </>
        )}

        <div className="local-first__intro">
          <button type="button" className="local-first__btn local-first__btn--intro" onClick={onStartIntro}>
            또는 입문 경로로 시작
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import type { LocalFirstRegion } from "../../lib/localFirstRegion";
import { LOCAL_FIRST_CAMERA_ZOOM, makeLocalFirstRegion, localFirstRegionLabel } from "../../lib/localFirstRegion";
import { installLocalFirstGeoProbe } from "../../lib/localFirstGeoProbe";
import { fetchMapboxReverseGeocodeRegionLabel } from "../../services/mapboxReverseGeocode";
import {
  READY_RIDE_DISTANCE_KM_OPTIONS,
  READY_RIDE_DEFAULT_DISTANCE_KM,
  formatReadyRideDistanceChip,
} from "../../lib/readyRide";
import type { ReadyRideLastResult, ReadyRideStatus } from "../../hooks/useReadyRide";
import "./LocalFirstEntryCard.css";

export type LocalFirstEntryCardProps = {
  region: LocalFirstRegion | null;
  mapboxAccessToken: string;
  onOpenRegionSearch: () => void;
  onConfirmRegion: (region: LocalFirstRegion) => void;
  onClearRegion: () => void;
  onStartIntro: () => void;
  readyRideStatus: ReadyRideStatus;
  readyRideGeneratingLabel: string;
  readyRideSlow: boolean;
  readyRideFailMessage: string | null;
  readyRideLastResult: ReadyRideLastResult | null;
  onGenerateReadyRide: (targetDistanceKm: number) => void;
  onAnotherReadyRide: (targetDistanceKm: number) => void;
  onCancelReadyRide: () => void;
  /**
   * Ready Ride 경로가 Go 게이트에 있으면 「시작」·「지역」은 감추고
   * 거리 칩 행의 「다른」만 남긴다(지시03 §B3 · 지시10 D3/D4).
   */
  hasActiveGeneratedRoute?: boolean;
};

type Phase = "ready" | "locating" | "denied";

function blockMapPointer(e: PointerEvent | TouchEvent) {
  e.stopPropagation();
  e.preventDefault();
}

/**
 * Local First Recognition 카드 — 지시10 공간 밀도(D1~D7).
 * RouteDock 거리 칩과 같은 밀도: 숫자만 + 제목에 (km) 한 번.
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
  readyRideLastResult,
  onGenerateReadyRide,
  onAnotherReadyRide,
  onCancelReadyRide,
  hasActiveGeneratedRoute = false,
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

    const GEO_OPTS: PositionOptions = {
      timeout: 30_000,
      maximumAge: 600_000,
      enableHighAccuracy: false,
    };

    const requestPosition = () => {
      if (ac.signal.aborted) return;
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
          if (err.code === err.PERMISSION_DENIED) {
            setPhase("denied");
            setFailReason("위치 권한이 거부되었습니다");
            return;
          }
          if (err.code === err.TIMEOUT) {
            if (import.meta.env.DEV) {
              console.info("[local-first-geo] TIMEOUT — retry while locating");
            }
            requestPosition();
            return;
          }
          setPhase("denied");
          setFailReason("위치를 가져오지 못했습니다");
        },
        GEO_OPTS,
      );
    };

    requestPosition();
  };

  const cancelLocating = () => {
    geoAbortRef.current?.abort();
    geoAbortRef.current = null;
    setPhase("ready");
    setFailReason(null);
  };

  const showS2 = phase === "denied" && !region;
  const showS1 = Boolean(region) && !showS2;
  const showAnotherChip =
    (hasActiveGeneratedRoute || Boolean(readyRideLastResult)) &&
    readyRideStatus !== "generating" &&
    readyRideStatus !== "failed";

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
              <span className="local-first__place">{region.name}</span>
              <span className="local-first__subtitle">
                첫 Ready Ride <span className="local-first__title-unit">(km)</span>
              </span>
            </p>

            <div className="local-first__chips" role="group" aria-label="Ready Ride 거리 km">
              {READY_RIDE_DISTANCE_KM_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={
                    "local-first__chip" + (km === readyKm ? " local-first__chip--active" : "")
                  }
                  aria-pressed={km === readyKm}
                  aria-label={`${km} km`}
                  disabled={readyRideStatus === "generating"}
                  onClick={() => setReadyKm(km)}
                >
                  {formatReadyRideDistanceChip(km)}
                </button>
              ))}
              {showAnotherChip ? (
                <button
                  type="button"
                  className="local-first__chip local-first__chip--aux"
                  aria-label="다른 경로"
                  onClick={() => onAnotherReadyRide(readyKm)}
                >
                  다른
                </button>
              ) : null}
            </div>

            {readyRideStatus === "generating" ? (
              <div className="local-first__generating" role="status">
                <span className="local-first__generating-label">{readyRideGeneratingLabel}</span>
                {readyRideSlow ? (
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--ghost local-first__btn--compact"
                    onClick={onCancelReadyRide}
                  >
                    취소
                  </button>
                ) : null}
              </div>
            ) : hasActiveGeneratedRoute ? null : readyRideStatus !== "failed" ? (
              <div className="local-first__actions">
                <button
                  type="button"
                  className="local-first__btn local-first__btn--primary local-first__btn--compact"
                  onClick={() => onGenerateReadyRide(readyKm)}
                >
                  시작
                </button>
                <button
                  type="button"
                  className="local-first__btn local-first__btn--ghost local-first__btn--compact"
                  onClick={() => {
                    setPhase("ready");
                    setFailReason(null);
                    onClearRegion();
                  }}
                >
                  지역
                </button>
              </div>
            ) : null}

            {readyRideStatus === "failed" && readyRideFailMessage ? (
              <div className="local-first__ready-fail">
                <p className="local-first__fail">{readyRideFailMessage}</p>
                <div className="local-first__actions">
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--primary local-first__btn--compact"
                    onClick={() => onGenerateReadyRide(readyKm)}
                  >
                    다시
                  </button>
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--ghost local-first__btn--compact"
                    onClick={() => {
                      setPhase("ready");
                      setFailReason(null);
                      onClearRegion();
                    }}
                  >
                    지역
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
                className="local-first__btn local-first__btn--primary local-first__btn--compact"
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
              {geoAvailable ? (
                phase === "locating" ? (
                  <>
                    <button
                      type="button"
                      className="local-first__btn local-first__btn--primary"
                      disabled
                      aria-busy="true"
                    >
                      위치 확인 중…
                    </button>
                    <button
                      type="button"
                      className="local-first__btn local-first__btn--ghost local-first__btn--compact"
                      onClick={cancelLocating}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--primary local-first__btn--compact"
                    onClick={handleUseCurrentLocation}
                  >
                    현재 위치
                  </button>
                )
              ) : null}
              {phase !== "locating" ? (
                <button
                  type="button"
                  className={
                    "local-first__btn local-first__btn--compact" +
                    (geoAvailable ? " local-first__btn--ghost" : " local-first__btn--primary")
                  }
                  onClick={onOpenRegionSearch}
                >
                  지역 선택
                </button>
              ) : null}
            </div>
          </>
        )}

        <div className="local-first__intro">
          <button type="button" className="local-first__link" onClick={onStartIntro}>
            입문 경로
          </button>
        </div>
      </div>
    </div>
  );
}

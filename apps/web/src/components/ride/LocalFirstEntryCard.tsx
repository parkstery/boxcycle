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
import type { ReadyRideLastResult, ReadyRideStatus } from "../../hooks/useReadyRide";
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
  /** 마지막 생성 결과(폐합/편도) — 지시03 §B2·§B3 */
  readyRideLastResult: ReadyRideLastResult | null;
  onGenerateReadyRide: (targetDistanceKm: number) => void;
  /** 「다른 경로」 — 직전 시작 방위를 제외한 다음 후보 */
  onAnotherReadyRide: (targetDistanceKm: number) => void;
  onCancelReadyRide: () => void;
  /**
   * Ready Ride 로 생성한 경로가 이미 Go 게이트에 얹혀 있다(stage === "ready-to-start").
   * 이 경우 카드는 재생성·지역 재선택 UI 를 감추고 「다른 경로」만 남긴다 — 「Ready Ride 시작」·
   * 「다시 고르기」는 이미 아래 RouteDock 의 실제 Go 버튼·경로 지우기와 중복·충돌한다(지시03 §B3).
   */
  hasActiveGeneratedRoute?: boolean;
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
      // 지시06 A-3 — 데스크톱 Wi-Fi 측위는 10~20초가 흔하다. 8초는 너무 짧았다.
      timeout: 30_000,
      maximumAge: 600_000,
      enableHighAccuracy: false,
    };

    const requestPosition = () => {
      if (ac.signal.aborted) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // 늦게 도착한 성공도 살린다 — 사용자가 취소했거나 카드가 사라진 뒤만 버린다.
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
          // 진짜 거부만 S2. 타임아웃은 실패 단정하지 않고 재시도(대기 유지).
          if (err.code === err.PERMISSION_DENIED) {
            setPhase("denied");
            setFailReason("위치 권한이 거부되었습니다");
            return;
          }
          if (err.code === err.TIMEOUT) {
            if (import.meta.env.DEV) {
              console.info("[local-first-geo] TIMEOUT — retry while locating");
            }
            // phase 는 locating 유지. 취소 버튼으로만 빠져나간다.
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
            ) : hasActiveGeneratedRoute ? (
              // 이미 Go 게이트에 경로가 얹혀 있다 — 「Ready Ride 시작」·「다시 고르기」는 아래
              // RouteDock 의 실제 주행 시작·경로 지우기와 중복·충돌하므로 「다른 경로」만 남긴다.
              readyRideStatus !== "failed" ? (
                <div className="local-first__actions">
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--primary"
                    onClick={() => onAnotherReadyRide(readyKm)}
                  >
                    다른 경로
                  </button>
                </div>
              ) : null
            ) : readyRideStatus !== "failed" ? (
              // 실패 시엔 이 행 대신 아래 §B3 실패 블록만 보인다 — 「실패 문구」와 이 행이
              // 동시에 뜨면 사용자가 뭘 눌러야 할지 헷갈린다(지시02 F 캡처에서 실제로 겹쳤다).
              <div className="local-first__actions">
                <button
                  type="button"
                  className="local-first__btn local-first__btn--primary"
                  onClick={() => onGenerateReadyRide(readyKm)}
                >
                  Ready Ride 시작
                </button>
                {readyRideLastResult ? (
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--ghost"
                    onClick={() => onAnotherReadyRide(readyKm)}
                  >
                    다른 경로
                  </button>
                ) : null}
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
            ) : null}

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
              {geoAvailable ? (
                phase === "locating" ? (
                  <>
                    <button
                      type="button"
                      className="local-first__btn local-first__btn--primary"
                      disabled
                      aria-busy="true"
                    >
                      위치를 확인하는 중…
                    </button>
                    <button
                      type="button"
                      className="local-first__btn local-first__btn--ghost"
                      onClick={cancelLocating}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="local-first__btn local-first__btn--primary"
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
                    "local-first__btn" +
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
          <button type="button" className="local-first__btn local-first__btn--intro" onClick={onStartIntro}>
            또는 입문 경로로 시작
          </button>
        </div>
      </div>
    </div>
  );
}

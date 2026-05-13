import { useEffect, useState } from "react";
import { formatDuration } from "../services/mapboxDirections";
import {
  loadRecentRideSessionsFromFirestore,
} from "../lib/firestoreRides";
import {
  loadRideSessions,
  type StoredRideSession,
} from "../lib/rideSessionsStorage";
import "./RideHistoryPanel.css";

export type RideHistoryPanelProps = {
  /**
   * 영구 주행 기록을 표시한다.
   * - 로그인 사용자: Firestore `rides` 컬렉션 (최근 50건)
   * - 게스트 / 미로그인: localStorage 의 최근 기록
   */
  userId: string | null;
  /** 게스트 안내 표시(미로그인 또는 익명) */
  guestNotice: boolean;
  /** 사용자 경로 화면으로 돌아갈 때 호출 */
  onClose: () => void;
};

/**
 * 주행 기록(rides) — 완주된 사용자 경로의 영구 누적 기록.
 * 같은 경로를 N회 주행했다면 N개의 기록이 시간순으로 쌓인다.
 * 가벼운 50건 단위 로드(인덱스 `userId ASC, endedAt DESC` 사용).
 */
export function RideHistoryPanel(props: RideHistoryPanelProps) {
  const [rides, setRides] = useState<StoredRideSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    /**
     * 모든 setState 호출은 IIFE 로 옮겨 `react-hooks/set-state-in-effect` 룰을 통과.
     * 의도된 동작(외부 시스템 → React 동기화)을 비동기 영역에서 일괄 수행한다.
     */
    void (async () => {
      if (!props.userId) {
        if (!cancelled) {
          setRides(loadRideSessions());
          setError(null);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setError(null);
        setLoading(true);
      }
      try {
        const rows = await loadRecentRideSessionsFromFirestore(props.userId, 50);
        if (!cancelled) setRides(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setRides(loadRideSessions());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.userId]);

  return (
    <section className="ride-history" aria-label="주행 기록">
      <div className="ride-history__head">
        <h2 className="ride-history__h">주행 기록</h2>
        <button
          type="button"
          className="ride-history__close"
          aria-label="주행 기록 닫고 경로 화면으로 돌아가기"
          title="경로 화면으로 돌아가기"
          onClick={props.onClose}
        >
          닫기
        </button>
      </div>

      {props.guestNotice ? (
        <p className="ride-history__notice">
          게스트는 이 브라우저의 최근 기록만 표시됩니다. Google 계정으로 로그인하면 클라우드에서 모든
          기기의 기록이 누적됩니다.
        </p>
      ) : null}

      {error ? (
        <p className="ride-history__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="ride-history__empty">불러오는 중…</p>
      ) : rides.length === 0 ? (
        <p className="ride-history__empty">
          아직 주행 기록이 없습니다. 경로를 완주하면 자동으로 여기에 누적됩니다.
        </p>
      ) : (
        <ul className="ride-history__list">
          {rides.map((r) => {
            const date = new Date(r.endedAt);
            const dateLabel = Number.isNaN(date.getTime())
              ? "(시각 미상)"
              : date.toLocaleString();
            const km = (r.distanceMeters / 1000).toFixed(2);
            const ratioPct =
              typeof r.completionRatio === "number"
                ? Math.round(r.completionRatio * 100)
                : null;
            const isCompleted = ratioPct !== null && ratioPct >= 95;
            const titleName = r.routeName ?? "(이름 없는 경로)";
            return (
              <li key={r.id} className="ride-history__item">
                <div className="ride-history__row1">
                  <strong className="ride-history__name" title={titleName}>
                    {titleName}
                  </strong>
                  {ratioPct !== null ? (
                    <span
                      className={`ride-history__badge ${
                        isCompleted ? "ride-history__badge--ok" : "ride-history__badge--partial"
                      }`}
                    >
                      {isCompleted ? "완주" : `${ratioPct}%`}
                    </span>
                  ) : null}
                </div>
                <p className="ride-history__row2">
                  <span className="ride-history__date">{dateLabel}</span>
                </p>
                <p className="ride-history__row3">
                  <span>{km} km</span>
                  <span> · {formatDuration(r.elapsedSec)}</span>
                  <span> · {r.avgSpeedKmh.toFixed(1)} km/h</span>
                  {ratioPct !== null ? <span> · 완주율 {ratioPct}%</span> : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="ride-history__back"
        onClick={props.onClose}
      >
        경로 화면으로 돌아가기
      </button>
    </section>
  );
}

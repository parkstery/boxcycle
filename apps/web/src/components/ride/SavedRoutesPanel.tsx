import { useMemo, useState } from "react";
import type { SavedRoute } from "../../lib/firestoreSavedRoutes";
import {
  encodeCanonicalRouteGeometryProfile,
  fingerprintFromCanonicalSync,
} from "../../lib/routeFingerprint";
import { formatDuration } from "../../services/mapboxDirections";
import "./SavedRoutesPanel.css";

type CompletionFilter = "all" | "completed" | "pending";

/** 진행률(0~1)을 방어적으로 클램프. 로컬·옛 데이터가 범위를 벗어나도 안전. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** 만료까지 남은 일수(올림). null 이면 만료 정보 없음(완주 또는 옛 데이터). */
function daysUntilExpiry(expiresAtIso: string | null, now: number = Date.now()): number | null {
  if (!expiresAtIso) return null;
  const t = Date.parse(expiresAtIso);
  if (!Number.isFinite(t)) return null;
  const ms = t - now;
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export type SavedRoutesPanelProps = {
  routes: SavedRoute[];
  loading: boolean;
  /** 게스트(localStorage 만 사용) 안내 표시 여부 */
  guestNotice: boolean;
  /** 세션이 idle 일 때만 불러오기·삭제 허용 */
  sessionIdle: boolean;
  /** 공개 등록 심사 중인 savedRouteId (Firestore 신청 기준) */
  pendingPublicRouteIds?: ReadonlySet<string>;
  /** 이미 퍼블릭 코스로 승인·등록된 원본 savedRouteId (`courses.sourceSavedRouteId`) */
  publishedPublicSavedRouteIds?: ReadonlySet<string>;
  /** 퍼블릭 게시 코스와 동일한 경로 지문(카탈로그 밖 코스까지 DB 조회) */
  publishedPublicRouteFingerprints?: ReadonlySet<string>;
  /** 로그인 사용자: 완주 경로 퍼블릭 등록 모달 열기(게스트는 동일 라벨 비활성 버튼만 표시) */
  onOpenPublicRequest?: (route: SavedRoute) => void;
  onLoadRoute: (route: SavedRoute) => void;
  onRenameRoute: (route: SavedRoute, newName: string) => Promise<void> | void;
  onDeleteRoute: (route: SavedRoute) => Promise<void> | void;
  /** 미완료 쿼터 초과로 유도됐을 때 상단에 표시할 안내(없으면 미표시) */
  quotaNotice?: string | null;
  onDismissQuotaNotice?: () => void;
  /** 값이 바뀔 때마다 완주 필터를 「대기」로 전환(미완료 초과 유도용). 0=무동작 */
  focusPendingSignal?: number;
};

export function SavedRoutesPanel(props: SavedRoutesPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CompletionFilter>("all");

  // 미완료 쿼터 초과 유도 시 「대기」 필터로 전환해 정리 대상 경로만 보여준다.
  // effect 대신 이전 신호값과 비교(React 권장) — cascading render·set-state-in-effect 회피.
  const focusPendingSignal = props.focusPendingSignal ?? 0;
  const [prevFocusPendingSignal, setPrevFocusPendingSignal] = useState(focusPendingSignal);
  if (focusPendingSignal !== prevFocusPendingSignal) {
    setPrevFocusPendingSignal(focusPendingSignal);
    if (focusPendingSignal > 0) setFilter("pending");
  }

  const filtered = useMemo(() => {
    if (filter === "completed") return props.routes.filter((r) => r.completed === 1);
    if (filter === "pending") return props.routes.filter((r) => r.completed !== 1);
    return props.routes;
  }, [props.routes, filter]);

  const completedCount = useMemo(
    () => props.routes.filter((r) => r.completed === 1).length,
    [props.routes],
  );
  const pendingCount = props.routes.length - completedCount;

  function startRename(route: SavedRoute) {
    setError(null);
    setRenamingId(route.id);
    setRenameDraft(route.name);
  }
  function cancelRename() {
    setRenamingId(null);
    setRenameDraft("");
  }
  async function commitRename(route: SavedRoute) {
    if (busyId) return;
    setBusyId(route.id);
    setError(null);
    try {
      await props.onRenameRoute(route, renameDraft);
      setRenamingId(null);
      setRenameDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }
  async function commitDelete(route: SavedRoute) {
    if (busyId) return;
    if (!confirm(`「${route.name}」 경로를 삭제할까요?`)) return;
    setBusyId(route.id);
    setError(null);
    try {
      await props.onDeleteRoute(route);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="saved-routes" aria-label="사용자 경로">
      {props.quotaNotice ? (
        <div className="saved-routes__quota-notice" role="alert">
          <p className="saved-routes__quota-notice-msg">{props.quotaNotice}</p>
          <p className="saved-routes__quota-notice-hint">
            아래 진행 중 경로 중 하나를 완주하거나 삭제하면 새 경로를 저장할 수 있어요.
          </p>
          {props.onDismissQuotaNotice ? (
            <button
              type="button"
              className="saved-routes__quota-notice-close"
              aria-label="안내 닫기"
              title="Dismiss"
              onClick={props.onDismissQuotaNotice}
            >
              확인
            </button>
          ) : null}
        </div>
      ) : null}

      {props.guestNotice ? (
        <p className="saved-routes__notice">
          Google 로그인 시 다른 기기에서도 사용할 수 있습니다
        </p>
      ) : null}

      {props.routes.length > 0 ? (
        <div
          className="saved-routes__filter"
          role="tablist"
          aria-label="사용자 경로 완주 여부 필터"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`saved-routes__filter-btn ${filter === "all" ? "is-active" : ""}`}
            title="Show all"
            onClick={() => setFilter("all")}
          >
            전체 ({props.routes.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "completed"}
            className={`saved-routes__filter-btn ${filter === "completed" ? "is-active" : ""}`}
            title="Completed only"
            onClick={() => setFilter("completed")}
          >
            완주 ({completedCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "pending"}
            className={`saved-routes__filter-btn ${filter === "pending" ? "is-active" : ""}`}
            title="Pending only"
            onClick={() => setFilter("pending")}
          >
            대기 ({pendingCount})
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="saved-routes__error" role="alert">
          {error}
        </p>
      ) : null}

      {props.loading ? (
        <p className="saved-routes__empty">불러오는 중…</p>
      ) : props.routes.length === 0 ? (
        <p className="saved-routes__empty">
          사용자 경로가 없습니다. 「경로」 탭에서 경로를 만든 뒤 「내 경로로 저장」으로 목록에 올려 보세요.
          미주행 7일 후 자동 삭제 · 완주 시 영구 보존
        </p>
      ) : filtered.length === 0 ? (
        <p className="saved-routes__empty">
          {filter === "completed"
            ? "아직 완주한 사용자 경로가 없습니다."
            : "대기 중인 사용자 경로가 없습니다."}
        </p>
      ) : (
        <ul className="saved-routes__list">
          {filtered.map((route) => {
            const isRenaming = renamingId === route.id;
            const isBusy = busyId === route.id;
            const routeFp = fingerprintFromCanonicalSync(
              encodeCanonicalRouteGeometryProfile(route.geometry, route.profile),
            );
            const alreadyPublishedPublic =
              (props.publishedPublicSavedRouteIds?.has(route.id) ?? false) ||
              (props.publishedPublicRouteFingerprints?.has(routeFp) ?? false);
            return (
              <li key={route.id} className="saved-routes__item">
                {isRenaming ? (
                  <div className="saved-routes__rename">
                    <input
                      className="saved-routes__rename-input"
                      type="text"
                      maxLength={40}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      autoFocus
                    />
                    <div className="saved-routes__row-actions">
                      <button
                        type="button"
                        className="saved-routes__btn saved-routes__btn--primary"
                        disabled={isBusy}
                        title="Save name"
                        onClick={() => void commitRename(route)}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        className="saved-routes__btn"
                        disabled={isBusy}
                        title="Cancel"
                        onClick={cancelRename}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="saved-routes__head">
                      <strong className="saved-routes__name" title={route.name}>
                        {route.name}
                      </strong>
                      <div className="saved-routes__head-tags">
                        {(() => {
                          if (route.completed === 1) {
                            return (
                              <span
                                className="saved-routes__badge saved-routes__badge--ok"
                                title={
                                  route.completedAtIso
                                    ? `Completed: ${new Date(route.completedAtIso).toLocaleString()}`
                                    : "Completed · kept permanently"
                                }
                              >
                                완주
                              </span>
                            );
                          }
                          const d = daysUntilExpiry(route.expiresAtIso);
                          if (d === null) {
                            return (
                              <span
                                className="saved-routes__badge saved-routes__badge--pending"
                                title="Pending completion"
                              >
                                대기
                              </span>
                            );
                          }
                          if (d <= 0) {
                            return (
                              <span
                                className="saved-routes__badge saved-routes__badge--soon"
                                title="Expires soon if not ridden"
                              >
                                만료 임박
                              </span>
                            );
                          }
                          return (
                            <span
                              className={`saved-routes__badge ${
                                d <= 2
                                  ? "saved-routes__badge--soon"
                                  : "saved-routes__badge--pending"
                              }`}
                              title={`Auto-delete in ${d} day(s) if not ridden`}
                            >
                              {`대기 · D-${d}`}
                            </span>
                          );
                        })()}
                        <span className="saved-routes__profile">
                          {route.profile === "cycling"
                            ? "자전거"
                            : route.profile === "driving"
                              ? "자동차"
                              : "보행"}
                        </span>
                      </div>
                    </div>
                    <p className="saved-routes__meta">
                      {(route.distanceMeters / 1000).toFixed(2)} km ·{" "}
                      {formatDuration(route.durationSec)} ·{" "}
                      <span className="saved-routes__date">
                        {new Date(route.updatedAtIso).toLocaleString()}
                      </span>
                    </p>
                    {route.completed !== 1
                      ? (() => {
                          const pct = Math.round(clamp01(route.lastProgressRatio) * 100);
                          return (
                            <div
                              className="saved-routes__progress"
                              title={`주행 진행률 ${pct}% · 98% 이상 주행 시 완주`}
                            >
                              <div
                                className="saved-routes__progress-track"
                                role="progressbar"
                                aria-label="주행 진행률"
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <div
                                  className="saved-routes__progress-fill"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="saved-routes__progress-label">{pct}%</span>
                            </div>
                          );
                        })()
                      : null}
                    <div className="saved-routes__row-actions">
                      {route.completed === 1 ? (
                        props.guestNotice ? (
                          <button
                            type="button"
                            className="saved-routes__btn saved-routes__btn--accent"
                            disabled
                            title="로그인을 하면 퍼블릭 신청 기능을 쓸 수 있습니다."
                          >
                            퍼블릭신청
                          </button>
                        ) : props.onOpenPublicRequest ? (
                          props.pendingPublicRouteIds?.has(route.id) ? (
                            <span
                              className="saved-routes__badge saved-routes__badge--pending"
                              title="관리자 심사 대기 중"
                            >
                              공개 심사 중
                            </span>
                          ) : alreadyPublishedPublic ? (
                            <button
                              type="button"
                              className="saved-routes__btn saved-routes__btn--accent"
                              disabled
                              title="이미 퍼블릭 경로입니다"
                            >
                              퍼블릭신청
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="saved-routes__btn saved-routes__btn--accent"
                              disabled={isBusy || !props.sessionIdle}
                              title={
                                props.sessionIdle
                                  ? "퍼블릭 등록 신청"
                                  : "주행 종료 후 사용 가능"
                              }
                              onClick={() => props.onOpenPublicRequest?.(route)}
                            >
                              퍼블릭신청
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            className="saved-routes__btn saved-routes__btn--accent"
                            disabled
                            title="퍼블릭 신청을 사용할 수 없습니다"
                          >
                            퍼블릭신청
                          </button>
                        )
                      ) : null}
                      <button
                        type="button"
                        className="saved-routes__btn saved-routes__btn--primary"
                        disabled={isBusy || !props.sessionIdle}
                        title={
                          props.sessionIdle ? "Load route on map" : "Available when idle"
                        }
                        onClick={() => props.onLoadRoute(route)}
                      >
                        불러오기
                      </button>
                      <button
                        type="button"
                        className="saved-routes__btn"
                        disabled={isBusy || !props.sessionIdle}
                        title={props.sessionIdle ? "Rename" : "Available when idle"}
                        onClick={() => startRename(route)}
                      >
                        이름 변경
                      </button>
                      <button
                        type="button"
                        className="saved-routes__btn saved-routes__btn--danger"
                        disabled={isBusy || !props.sessionIdle}
                        title={props.sessionIdle ? "Delete route" : "Available when idle"}
                        onClick={() => void commitDelete(route)}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

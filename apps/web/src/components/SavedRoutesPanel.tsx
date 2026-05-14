import { useMemo, useState } from "react";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import { formatDuration } from "../services/mapboxDirections";
import "./SavedRoutesPanel.css";

type CompletionFilter = "all" | "completed" | "pending";

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
  /** 로그인 사용자: 완주 경로 퍼블릭 신청 모달 열기(게스트는 동일 라벨 비활성 버튼만 표시) */
  onOpenPublicRequest?: (route: SavedRoute) => void;
  onLoadRoute: (route: SavedRoute) => void;
  onRenameRoute: (route: SavedRoute, newName: string) => Promise<void> | void;
  onDeleteRoute: (route: SavedRoute) => Promise<void> | void;
};

export function SavedRoutesPanel(props: SavedRoutesPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CompletionFilter>("all");

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
      {props.guestNotice ? (
        <p className="saved-routes__notice">
          게스트는 이 브라우저에만 저장됩니다. Google 계정으로 로그인하면 클라우드로 옮겨져 다른
          기기에서도 보입니다.
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
            onClick={() => setFilter("all")}
          >
            전체 ({props.routes.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "completed"}
            className={`saved-routes__filter-btn ${filter === "completed" ? "is-active" : ""}`}
            onClick={() => setFilter("completed")}
          >
            완주 ({completedCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "pending"}
            className={`saved-routes__filter-btn ${filter === "pending" ? "is-active" : ""}`}
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
          저장된 경로는 7일 안에 주행하지 않으면 자동 삭제됩니다(주행 완료 시 영구 보존).
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
                        onClick={() => void commitRename(route)}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        className="saved-routes__btn"
                        disabled={isBusy}
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
                                    ? `완주: ${new Date(route.completedAtIso).toLocaleString()}`
                                    : "완주 경로 · 영구 보존"
                                }
                              >
                                완주
                              </span>
                            );
                          }
                          const d = daysUntilExpiry(route.expiresAtIso);
                          if (d === null) {
                            return (
                              <span className="saved-routes__badge saved-routes__badge--pending">
                                대기
                              </span>
                            );
                          }
                          if (d <= 0) {
                            return (
                              <span className="saved-routes__badge saved-routes__badge--soon">
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
                              title={`주행하지 않으면 ${d}일 후 자동 삭제`}
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
                    <div className="saved-routes__row-actions">
                      {route.completed === 1 ? (
                        props.guestNotice ? (
                          <button
                            type="button"
                            className="saved-routes__btn saved-routes__btn--accent"
                            disabled
                            title="Google 계정으로 로그인하면 퍼블릭 신청을 할 수 있습니다"
                          >
                            퍼블릭 신청
                          </button>
                        ) : props.onOpenPublicRequest ? (
                          props.pendingPublicRouteIds?.has(route.id) ? (
                            <span
                              className="saved-routes__badge saved-routes__badge--pending"
                              title="관리자 승인 대기 중입니다"
                            >
                              공개 심사 중
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="saved-routes__btn saved-routes__btn--accent"
                              disabled={isBusy || !props.sessionIdle}
                              title={
                                props.sessionIdle
                                  ? "완주 경로를 다른 이용자에게 공개하도록 신청합니다"
                                  : "주행 종료 후 신청할 수 있습니다"
                              }
                              onClick={() => props.onOpenPublicRequest?.(route)}
                            >
                              퍼블릭 신청
                            </button>
                          )
                        ) : null
                      ) : null}
                      <button
                        type="button"
                        className="saved-routes__btn saved-routes__btn--primary"
                        disabled={isBusy || !props.sessionIdle}
                        title={
                          props.sessionIdle
                            ? "이 경로를 지도에 불러옵니다"
                            : "주행 종료 후 불러올 수 있습니다"
                        }
                        onClick={() => props.onLoadRoute(route)}
                      >
                        불러오기
                      </button>
                      <button
                        type="button"
                        className="saved-routes__btn"
                        disabled={isBusy || !props.sessionIdle}
                        onClick={() => startRename(route)}
                      >
                        이름 변경
                      </button>
                      <button
                        type="button"
                        className="saved-routes__btn saved-routes__btn--danger"
                        disabled={isBusy || !props.sessionIdle}
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

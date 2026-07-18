import { useMemo, useState } from "react";
import type { SavedRoute } from "../../lib/firestoreSavedRoutes";
import {
  encodeCanonicalRouteGeometryProfile,
  fingerprintFromCanonicalSync,
} from "../../lib/routeFingerprint";
import type { RouteProfile } from "../../services/mapboxDirections";
import "./SavedRoutesPanel.css";

type CompletionFilter = "all" | "completed" | "pending";
type SortKey = "recent" | "distance" | "name";

const PROFILE_LABEL: Record<RouteProfile, string> = {
  cycling: "자전거",
  driving: "자동차",
  walking: "보행",
};

/**
 * 이동 수단(프로필) 아이콘 — currentColor 단색 라인. 의미 보완을 위해 title/aria-label 동반.
 * 24x24 뷰박스, 1.8 stroke. 자전거·자동차·보행 3종.
 */
function RouteProfileIcon({ profile }: { profile: RouteProfile }) {
  const label = PROFILE_LABEL[profile];
  const common = {
    className: "saved-routes__profile-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: "img" as const,
    "aria-label": label,
  };
  if (profile === "cycling") {
    return (
      <svg {...common}>
        <title>{label}</title>
        <circle cx="5.5" cy="17" r="3.5" />
        <circle cx="18.5" cy="17" r="3.5" />
        <path d="M5.5 17l4-8h5l-3 8m0 0h-2m8-8h-3l-1.5 3" />
        <circle cx="14.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (profile === "driving") {
    return (
      <svg {...common}>
        <title>{label}</title>
        <path d="M3 13l1.6-4.2A2 2 0 016.5 7.5h11a2 2 0 011.9 1.3L21 13v5a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
        <path d="M3 13h18" />
        <circle cx="7" cy="16" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="17" cy="16" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <title>{label}</title>
      <circle cx="13" cy="4" r="1.7" fill="currentColor" stroke="none" />
      <path d="M13 7.5l-1 4 2.5 2.5 1 5" />
      <path d="M12 11.5l-3 1M13 11.5l1.5 2.5" />
      <path d="M12 11.5L10 20" />
    </svg>
  );
}

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

/** 검색어·이름 정규화(소문자·트림). 부분일치 판정에 공통 사용. */
function normalizeForSearch(s: string): string {
  return s.trim().toLowerCase();
}

/** ISO 시각 → "2026. 7. 17 07:12" (초·오전/오후 없이 한 줄). 파싱 실패 시 빈 문자열. */
function formatSavedDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const date = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
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

/** 선택된 경로에 대해 「공개」 툴바 버튼의 활성 여부·안내를 판정. */
type PublicActionState =
  | { kind: "unavailable"; title: string } // 게스트·핸들러 없음: 비활성
  | { kind: "in-review"; title: string } // 심사 중: 비활성
  | { kind: "already-public"; title: string } // 이미 퍼블릭: 비활성
  | { kind: "ready"; title: string }; // 신청 가능: 활성

export function SavedRoutesPanel(props: SavedRoutesPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CompletionFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  // 미완료 쿼터 초과 유도 시 「대기」 필터로 전환해 정리 대상 경로만 보여준다.
  // effect 대신 이전 신호값과 비교(React 권장) — cascading render·set-state-in-effect 회피.
  const focusPendingSignal = props.focusPendingSignal ?? 0;
  const [prevFocusPendingSignal, setPrevFocusPendingSignal] = useState(focusPendingSignal);
  if (focusPendingSignal !== prevFocusPendingSignal) {
    setPrevFocusPendingSignal(focusPendingSignal);
    if (focusPendingSignal > 0) setFilter("pending");
  }

  const filtered = useMemo(() => {
    const q = normalizeForSearch(queryText);
    const base = props.routes.filter((r) => {
      if (filter === "completed" && r.completed !== 1) return false;
      if (filter === "pending" && r.completed === 1) return false;
      if (q && !normalizeForSearch(r.name).includes(q)) return false;
      return true;
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sortKey === "distance") return b.distanceMeters - a.distanceMeters;
      if (sortKey === "name") return a.name.localeCompare(b.name, "ko");
      // recent: updatedAt 내림차순(최근이 위)
      return Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso);
    });
    return sorted;
  }, [props.routes, filter, queryText, sortKey]);

  const completedCount = useMemo(
    () => props.routes.filter((r) => r.completed === 1).length,
    [props.routes],
  );
  const pendingCount = props.routes.length - completedCount;

  // 선택된 경로 — 목록에서 사라졌으면(필터·검색·삭제) 선택 없음으로 취급.
  const selectedRoute = useMemo(
    () => (selectedId ? (filtered.find((r) => r.id === selectedId) ?? null) : null),
    [filtered, selectedId],
  );

  // 선택 경로에 대한 「공개」 툴바 버튼 판정(기존 카드별 분기 로직을 선택 기반으로 이관).
  const publicActionState: PublicActionState = useMemo(() => {
    if (!selectedRoute) return { kind: "unavailable", title: "경로를 선택하세요" };
    if (props.guestNotice || !props.onOpenPublicRequest)
      return { kind: "unavailable", title: "로그인을 하면 공개 신청 기능을 쓸 수 있습니다." };
    if (props.pendingPublicRouteIds?.has(selectedRoute.id))
      return { kind: "in-review", title: "관리자 심사 대기 중" };
    const routeFp = fingerprintFromCanonicalSync(
      encodeCanonicalRouteGeometryProfile(selectedRoute.geometry, selectedRoute.profile),
    );
    const alreadyPublishedPublic =
      (props.publishedPublicSavedRouteIds?.has(selectedRoute.id) ?? false) ||
      (props.publishedPublicRouteFingerprints?.has(routeFp) ?? false);
    if (alreadyPublishedPublic)
      return { kind: "already-public", title: "이미 퍼블릭 경로입니다" };
    if (!props.sessionIdle)
      return { kind: "ready", title: "주행 종료 후 사용 가능" };
    return { kind: "ready", title: "공개 등록 신청" };
  }, [
    selectedRoute,
    props.guestNotice,
    props.onOpenPublicRequest,
    props.pendingPublicRouteIds,
    props.publishedPublicSavedRouteIds,
    props.publishedPublicRouteFingerprints,
    props.sessionIdle,
  ]);

  // 툴바 버튼 활성 조건 — 선택 있음 + (해당 액션은 idle 필요).
  const hasSelection = selectedRoute !== null;
  const actionsEnabled = hasSelection && props.sessionIdle && busyId === null;
  const publicEnabled = actionsEnabled && publicActionState.kind === "ready";

  function toggleSelect(route: SavedRoute) {
    // 다른 카드를 rename 중이었다면 접는다.
    if (renamingId && renamingId !== route.id) cancelRename();
    setError(null);
    setSelectedId((prev) => (prev === route.id ? null : route.id));
  }

  function startRename(route: SavedRoute) {
    setError(null);
    setSelectedId(route.id);
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
      setSelectedId(null);
      if (renamingId === route.id) cancelRename();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function onToolbarPublic() {
    if (!selectedRoute || !publicEnabled) return;
    props.onOpenPublicRequest?.(selectedRoute);
  }
  function onToolbarOpen() {
    if (!selectedRoute || !actionsEnabled) return;
    props.onLoadRoute(selectedRoute);
  }
  function onToolbarRename() {
    if (!selectedRoute || !actionsEnabled) return;
    startRename(selectedRoute);
  }
  function onToolbarDelete() {
    if (!selectedRoute || !actionsEnabled) return;
    void commitDelete(selectedRoute);
  }

  const hasRoutes = props.routes.length > 0;

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

      {hasRoutes ? (
        <div className="saved-routes__controls">
          <input
            type="search"
            className="saved-routes__search"
            value={queryText}
            placeholder="경로 이름 검색"
            aria-label="경로 이름 검색"
            onChange={(e) => setQueryText(e.target.value)}
          />

          <div className="saved-routes__control-row">
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

            <label className="saved-routes__sort-label">
              <span className="saved-routes__sort-caption">정렬</span>
              <select
                className="saved-routes__sort"
                value={sortKey}
                aria-label="정렬 기준"
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="recent">최근순</option>
                <option value="distance">거리순</option>
                <option value="name">이름순</option>
              </select>
            </label>
          </div>

          <div className="saved-routes__toolbar" role="toolbar" aria-label="선택한 경로 작업">
            <button
              type="button"
              className="saved-routes__tool saved-routes__tool--accent"
              disabled={!publicEnabled}
              title={publicActionState.title}
              onClick={onToolbarPublic}
            >
              공개
            </button>
            <button
              type="button"
              className="saved-routes__tool saved-routes__tool--primary"
              disabled={!actionsEnabled}
              title={
                !hasSelection
                  ? "경로를 선택하세요"
                  : props.sessionIdle
                    ? "지도에 경로 불러오기"
                    : "주행 종료 후 사용 가능"
              }
              onClick={onToolbarOpen}
            >
              열기
            </button>
            <button
              type="button"
              className="saved-routes__tool"
              disabled={!actionsEnabled}
              title={!hasSelection ? "경로를 선택하세요" : "이름 변경"}
              onClick={onToolbarRename}
            >
              이름
            </button>
            <button
              type="button"
              className="saved-routes__tool saved-routes__tool--danger"
              disabled={!actionsEnabled}
              title={!hasSelection ? "경로를 선택하세요" : "경로 삭제"}
              onClick={onToolbarDelete}
            >
              삭제
            </button>
          </div>
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
          {normalizeForSearch(queryText)
            ? "검색 결과가 없습니다."
            : filter === "completed"
              ? "아직 완주한 사용자 경로가 없습니다."
              : "대기 중인 사용자 경로가 없습니다."}
        </p>
      ) : (
        <ul className="saved-routes__list" role="listbox" aria-label="사용자 경로 목록">
          {filtered.map((route) => {
            const isRenaming = renamingId === route.id;
            const isBusy = busyId === route.id;
            const isSelected = selectedId === route.id;
            return (
              <li
                key={route.id}
                className={`saved-routes__item ${isSelected ? "is-selected" : ""}`}
              >
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
                  // 버튼 대신 div: 행 내부에 블록 요소(head/meta/progress)를 담기 때문.
                  // <button> 안에 블록 콘텐츠를 넣으면 브라우저가 DOM 을 재구성해 레이아웃이 깨진다.
                  <div
                    className="saved-routes__row"
                    role="option"
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => toggleSelect(route)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelect(route);
                      }
                    }}
                  >
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
                        <span
                          className="saved-routes__profile"
                          title={PROFILE_LABEL[route.profile]}
                        >
                          <RouteProfileIcon profile={route.profile} />
                        </span>
                      </div>
                    </div>
                    <p className="saved-routes__meta">
                      {(route.distanceMeters / 1000).toFixed(2)} km ·{" "}
                      <span className="saved-routes__date">
                        {formatSavedDateTime(route.updatedAtIso)}
                      </span>
                    </p>
                    {isSelected && route.completed !== 1
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
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

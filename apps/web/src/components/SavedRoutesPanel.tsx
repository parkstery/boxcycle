import { useState } from "react";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import { formatDuration } from "../services/mapboxDirections";
import "./SavedRoutesPanel.css";

export type SavedRoutesPanelProps = {
  routes: SavedRoute[];
  loading: boolean;
  /** 게스트(localStorage 만 사용) 안내 표시 여부 */
  guestNotice: boolean;
  /** 세션이 idle 일 때만 불러오기·삭제 허용 */
  sessionIdle: boolean;
  onLoadRoute: (route: SavedRoute) => void;
  onRenameRoute: (route: SavedRoute, newName: string) => Promise<void> | void;
  onDeleteRoute: (route: SavedRoute) => Promise<void> | void;
};

export function SavedRoutesPanel(props: SavedRoutesPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <section className="saved-routes" aria-label="저장된 경로">
      {props.guestNotice ? (
        <p className="saved-routes__notice">
          게스트는 이 브라우저에만 저장됩니다. Google 계정으로 로그인하면 클라우드로 옮겨져 다른
          기기에서도 보입니다.
        </p>
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
          저장된 경로가 없습니다. 「경로」 탭에서 경로 생성 후 「현재 경로 저장」 을 눌러 보세요.
        </p>
      ) : (
        <ul className="saved-routes__list">
          {props.routes.map((route) => {
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
                      <span className="saved-routes__profile">
                        {route.profile === "cycling"
                          ? "자전거"
                          : route.profile === "driving"
                            ? "자동차"
                            : "보행"}
                      </span>
                    </div>
                    <p className="saved-routes__meta">
                      {(route.distanceMeters / 1000).toFixed(2)} km ·{" "}
                      {formatDuration(route.durationSec)} ·{" "}
                      <span className="saved-routes__date">
                        {new Date(route.updatedAtIso).toLocaleString()}
                      </span>
                    </p>
                    <div className="saved-routes__row-actions">
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

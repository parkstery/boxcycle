import type { User } from "firebase/auth";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TrailPresenceStatus } from "../../app/useTrailLifecycle";
import { useDialogFocus } from "../ui/useDialogFocus";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../../lib/trail/repo/firestoreTrail";
import {
  canUserManageTrail,
  type TrailInstance,
  type TrailVisibility,
} from "../../lib/trail/repo/firestoreTrailInstance";
import { TRAILHEAD_LABEL, TRAIL_LABEL } from "../../lib/terms/productTerms";
import { formatTrailDisplayNumber } from "../../lib/trail/trailDisplayNumber";
import { listOpenTrailsForDisplay } from "./trailGlance";
import "./TrailHubPanel.css";

export type TrailHubPanelProps = {
  user: User | null | undefined;
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  openTrails: TrailInstance[];
  openTrailsLoading: boolean;
  openTrailsError: string | null;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  onSetVisibility: (visibility: TrailVisibility) => void;
  visibilityBusy?: boolean;
  /** running·paused — Trail 합류 비활성 */
  rideSessionActive?: boolean;
  /** Chief 11-02: 지금 달리는 Trail 목록은 지도 오른쪽 목록(Trail 탭)에서 본다. 메뉴엔 개수와 여는 줄만. */
  onShowTrailList?: () => void;
  /**
   * 주행하지 않고 Trail 에서 나와 Trailhead 로 돌아간다(11-04 Chief 「trail에 참여한 사용자가 주행을 하지 않고
   * 다시 trail을 빠져나오는 기능이 없다」). 폰 가로에선 HUD 「Trailhead로」 패널이 숨겨져 창구가 없었다.
   */
  onLeaveTrail?: () => void;
  /** 대기·주행 중·일시정지 — 「현재 Trail N」 옆 상태 표시(2026-11-05 Chief 시안 ②④) */
  trailStatus?: TrailPresenceStatus;
  /** 주행 중·일시정지에서 「나가기」 확인 → 주행을 끝내고 Trailhead 로 */
  onEndRideAndLeave?: () => void;
  /** 「최근 내가 달린 Trail」 개수(10분) — 「지금 달리는 Trail N개 · 최근 M」 */
  recentCount?: number;
};

const STATUS_LABEL: Record<TrailPresenceStatus, string | null> = {
  trailhead: null,
  waiting: "대기",
  riding: "주행 중",
  paused: "일시정지",
};

function LeaveRideConfirm(props: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref);
  return createPortal(
    <div className="oc-modal-overlay trail-leave-confirm-overlay" onClick={props.onCancel}>
      <div
        ref={ref}
        className="trail-leave-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="trail-leave-confirm-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            props.onCancel();
          }
        }}
      >
        <h2 id="trail-leave-confirm-title" className="trail-leave-confirm__title">
          주행을 끝내고 {TRAIL_LABEL} 에서 나갈까요?
        </h2>
        <p className="trail-leave-confirm__msg">
          지금까지 달린 기록은 저장돼요. 이 {TRAIL_LABEL} 은 10분 동안 「최근 내가 달린 {TRAIL_LABEL}」 에 남아 이어서 달릴 수 있어요.
        </p>
        <div className="trail-leave-confirm__btns">
          <button type="button" className="trail-leave-confirm__btn" onClick={props.onCancel}>
            계속 달리기
          </button>
          <button type="button" className="trail-leave-confirm__btn trail-leave-confirm__btn--primary" onClick={props.onConfirm}>
            종료하고 나가기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TrailHubPanel(props: TrailHubPanelProps) {
  const active = sanitizeTrailId(props.activeTrailId);
  const onTrailhead = active === DEFAULT_TRAIL_ID;

  const listedTrails = useMemo(
    () => listOpenTrailsForDisplay(props.openTrails, props.activeTrailId, props.currentTrail, Boolean(props.rideSessionActive)),
    [props.openTrails, props.activeTrailId, props.currentTrail, props.rideSessionActive],
  );

  const canToggleVisibility = canUserManageTrail(props.currentTrail, props.user);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const status = props.trailStatus ?? (props.rideSessionActive ? "riding" : onTrailhead ? "trailhead" : "waiting");
  const statusLabel = onTrailhead ? null : STATUS_LABEL[status];
  const rideActive = status === "riding" || status === "paused";
  const canLeave = !onTrailhead && (rideActive ? Boolean(props.onEndRideAndLeave) : Boolean(props.onLeaveTrail));

  return (
    <section className="trail-hub" aria-label={`${TRAILHEAD_LABEL} · ${TRAIL_LABEL}`}>
      <div className="trail-hub__context">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 18c0-8 14-3 14-11" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /></svg>
        <span>현재</span>
        <strong>{onTrailhead ? TRAILHEAD_LABEL : `${TRAIL_LABEL} ${formatTrailDisplayNumber(props.currentTrail?.displayNumber)}`}</strong>
        {statusLabel ? <span className="trail-hub__status" data-status={status}>{statusLabel}</span> : null}
        {canLeave ? (
          <button
            type="button"
            className="trail-hub__leave"
            aria-label={`${TRAIL_LABEL} 나가기`}
            title={`${TRAIL_LABEL}에서 나와 ${TRAILHEAD_LABEL}로`}
            onClick={() => (rideActive ? setConfirmOpen(true) : props.onLeaveTrail?.())}
          >
            나가기
          </button>
        ) : null}
      </div>
      {status === "paused" ? (
        <p className="trail-hub__hint">10분 동안 멈춰 있으면 주행을 끝내요. {TRAIL_LABEL} 에는 남아요.</p>
      ) : null}
      {confirmOpen ? (
        <LeaveRideConfirm
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            props.onEndRideAndLeave?.();
          }}
        />
      ) : null}
      {canToggleVisibility ? (
        <div className="trail-hub__row trail-hub__row--visibility">
          <span className="trail-hub__vis-label">이 Trail 공개</span>
          <div className="trail-hub__visibility" role="group" aria-label="Trail 공개 설정">
            <button
              type="button"
              className={
                props.currentTrail?.visibility === "open"
                  ? "trail-hub__vis-btn trail-hub__vis-btn--on"
                  : "trail-hub__vis-btn"
              }
              disabled={props.visibilityBusy}
              title="이 Trail을 공개로 전환"
              onClick={() => props.onSetVisibility("open")}
            >
              공개
            </button>
            <button
              type="button"
              className={
                props.currentTrail?.visibility === "private"
                  ? "trail-hub__vis-btn trail-hub__vis-btn--on"
                  : "trail-hub__vis-btn"
              }
              disabled={props.visibilityBusy}
              title="이 Trail을 비공개로 전환"
              onClick={() => props.onSetVisibility("private")}
            >
              비공개
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="trail-hub__show-list"
        onClick={props.onShowTrailList}
        disabled={!props.onShowTrailList}
      >
        <span>지금 달리는 {TRAIL_LABEL}</span>
        <strong>{props.openTrailsLoading && listedTrails.length === 0 ? "…" : `${listedTrails.length}개`}</strong>
        {props.recentCount ? <span className="trail-hub__recent-count">· 최근 {props.recentCount}</span> : null}
        <span aria-hidden>›</span>
      </button>
    </section>
  );
}

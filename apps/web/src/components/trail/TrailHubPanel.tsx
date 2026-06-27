import type { User } from "firebase/auth";
import { useMemo } from "react";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../../lib/firestoreTrail";
import {
  canUserManageTrail,
  type TrailInstance,
  type TrailVisibility,
} from "../../lib/firestoreTrailInstance";
import { compareOpenTrailsForListing, isActiveOpenTrailListing } from "../../lib/firestoreOpenTrailListings";
import { formatTrailDisplayNumber } from "../../lib/trailDisplayNumber";
import { readTrailDisplayNumberCache } from "../../lib/trailDisplayNumberCache";
import { TRAILHEAD_LABEL, TRAIL_LABEL } from "../../lib/productTerms";
import "./TrailHubPanel.css";

export type TrailHubPanelProps = {
  user: User | null | undefined;
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  openTrails: TrailInstance[];
  openTrailsLoading: boolean;
  openTrailsError: string | null;
  onGoTrailhead: () => void;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  onSetVisibility: (visibility: TrailVisibility) => void;
  visibilityBusy?: boolean;
  /** running·paused — Trailhead 이동 비활성 */
  rideSessionActive?: boolean;
};

type TrailRowParts = {
  num: string;
  region: string;
  km: string | null;
  riders: number | null;
  isPrivate: boolean;
};

function trailRowParts(t: TrailInstance): TrailRowParts {
  return {
    num: formatTrailDisplayNumber(t.displayNumber),
    region: t.regionLabel?.trim() || "—",
    km:
      t.distanceKm != null && Number.isFinite(t.distanceKm) ? `${t.distanceKm.toFixed(1)}km` : null,
    riders:
      t.liveRiderCount != null && Number.isFinite(t.liveRiderCount) ? t.liveRiderCount : null,
    isPrivate: t.visibility === "private",
  };
}

/** 컴팩트 라인: ● 번호 · 지명 … 거리 · LIVE 인원 */
function TrailRowContent({ t }: { t: TrailInstance }) {
  const { num, region, km, riders, isPrivate } = trailRowParts(t);
  return (
    <>
      <span
        className={`trail-hub__dot${isPrivate ? " trail-hub__dot--private" : ""}`}
        aria-hidden
      />
      <span className="trail-hub__num">{num}</span>
      <span className="trail-hub__region" title={region}>
        {region}
      </span>
      {km ? <span className="trail-hub__km">{km}</span> : null}
      {riders != null ? (
        <span className="trail-hub__riders" title={`주행 중 ${riders}명`}>
          <span className="trail-hub__riders-pulse" aria-hidden />
          {riders}
        </span>
      ) : null}
    </>
  );
}

function trailRowLabel(t: TrailInstance): string {
  const { num, region, km, riders, isPrivate } = trailRowParts(t);
  const parts = [`Trail ${num}`, region];
  if (km) parts.push(km);
  if (riders != null) parts.push(`주행 중 ${riders}명`);
  parts.push(isPrivate ? "비공개" : "공개");
  return parts.join(", ");
}

export function TrailHubPanel(props: TrailHubPanelProps) {
  const active = sanitizeTrailId(props.activeTrailId);
  const onTrailhead = active === DEFAULT_TRAIL_ID;
  const currentLabel = props.currentTrail
    ? formatTrailDisplayNumber(props.currentTrail.displayNumber)
    : onTrailhead
      ? TRAILHEAD_LABEL
      : formatTrailDisplayNumber(readTrailDisplayNumberCache(active));

  /** 주행 중 Trail만 — openTrailListings 활성 라이더 기준 */
  const listedTrails = useMemo(() => {
    const open = props.openTrails
      .filter(
        (t) =>
          t.status === "open" &&
          t.visibility === "open" &&
          isActiveOpenTrailListing(t),
      )
      .sort(compareOpenTrailsForListing);
    if (props.rideSessionActive) {
      if (
        !onTrailhead &&
        props.currentTrail?.id === active &&
        !open.some((t) => t.id === active)
      ) {
        return [props.currentTrail, ...open];
      }
      return open;
    }
    return open.filter((t) => t.id !== active);
  }, [props.openTrails, props.rideSessionActive, onTrailhead, active, props.currentTrail]);

  const canToggleVisibility = canUserManageTrail(props.currentTrail, props.user);

  return (
    <section className="trail-hub" aria-label={`${TRAILHEAD_LABEL} · ${TRAIL_LABEL}`}>
      <div className="trail-hub__row">
        <span
          className="trail-hub__current-id--compact"
          title={
            onTrailhead
              ? TRAILHEAD_LABEL
              : props.currentTrail?.regionLabel?.trim() || active
          }
        >
          {onTrailhead ? TRAILHEAD_LABEL : `Trail ${currentLabel}`}
        </span>
        <button
          type="button"
          className="trail-hub__trailhead-btn"
          disabled={onTrailhead || Boolean(props.rideSessionActive)}
          title={`${TRAILHEAD_LABEL}로 이동`}
          onClick={props.onGoTrailhead}
        >
          {TRAILHEAD_LABEL}로
        </button>
        {canToggleVisibility ? (
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
        ) : null}
      </div>

      <div className="trail-hub__list-head">
        <span className="trail-hub__kicker">Trail</span>
        {props.openTrailsLoading ? <span className="trail-hub__meta">불러오는 중…</span> : null}
      </div>
      {props.openTrailsError ? (
        <p className="trail-hub__err" title={props.openTrailsError}>
          {props.openTrailsError}
        </p>
      ) : null}
      {props.openTrailsLoading && listedTrails.length === 0 ? (
        <p className="trail-hub__empty">불러오는 중…</p>
      ) : listedTrails.length > 0 ? (
        <ul className="trail-hub__list">
          {listedTrails.map((t) => {
            const isCurrent = t.id === active;
            const showActiveRow = isCurrent && props.rideSessionActive;
            return (
              <li key={t.id}>
                {showActiveRow ? (
                  <div
                    className="trail-hub__row-card trail-hub__row-card--active"
                    aria-current="true"
                    aria-label={trailRowLabel(t)}
                  >
                    <TrailRowContent t={t} />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="trail-hub__row-card trail-hub__row-card--join"
                    disabled={props.rideSessionActive}
                    title="이 Trail에 합류"
                    aria-label={`${trailRowLabel(t)} — 합류`}
                    onClick={() => props.onJoinTrail(t.id, t.publicationId)}
                  >
                    <TrailRowContent t={t} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="trail-hub__empty">없음</p>
      )}
    </section>
  );
}

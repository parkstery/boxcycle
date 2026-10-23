import type { SyntheticEvent } from "react";
import {
  computeLeaderboardLiveRank,
  type LeaderboardLiveRow,
} from "./leaderboardLiveRank";
import type { LeaderboardResponse } from "../../services/leaderboardApi";
import "./LeaderboardGlance.css";

export type LeaderboardGlanceViewProps = {
  mode: "map" | "riding";
  isGuest: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onOpenFullLeaderboard: () => void;
  onRegister?: () => void;
  /** map 모드 — 서버 응답 */
  mapData: LeaderboardResponse | null;
  /** riding 모드 — 주행 시작 스냅샷 */
  rideSnapshot: LeaderboardResponse | null;
  liveRows: LeaderboardLiveRow[];
  myBaseKm: number;
  addedKm: number;
  pedalQualified: boolean;
};

function formatKmOne(valueKm: number): string {
  const t = Math.round(valueKm * 10) / 10;
  return t % 1 === 0 ? t.toFixed(1) : t.toFixed(1);
}

function RankChipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 14V9h4v5M6 14V4h4v10M10 14V7h4v7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function stopMapTouch(e: SyntheticEvent) {
  e.stopPropagation();
}

function buildGlanceModel(props: LeaderboardGlanceViewProps) {
  const {
    mode,
    isGuest,
    mapData,
    rideSnapshot,
    liveRows,
    myBaseKm,
    addedKm,
    pedalQualified,
  } = props;

  const me = mode === "riding" ? rideSnapshot?.me : mapData?.me;
  const ranked = me?.status === "ranked" ? me.rank : null;
  const projected = me?.status === "guest" ? me.projectedRank : null;

  const live =
    mode === "riding" && pedalQualified
      ? computeLeaderboardLiveRank(liveRows, myBaseKm, addedKm)
      : null;
  const liveRank = live?.rank ?? null;

  let chipA11y = "순위";
  if (mode === "riding") {
    if (liveRank != null) chipA11y = `주행 중 ${liveRank}위`;
  } else if (isGuest) {
    if (projected != null) chipA11y = `예상 ${projected}위`;
  } else if (ranked != null) {
    chipA11y = `이번 주 ${ranked}위`;
  }

  const listRows: LeaderboardLiveRow[] =
    mode === "riding" && live
      ? live.rows
      : mapData
        ? mapData.top.slice(0, 20).map((e) => ({
            rank: e.rank,
            nickname: e.nickname,
            valueKm: e.valueKm,
            isMe: e.isMe,
            liveTrailId: e.liveTrailId,
          }))
        : [];

  const gapFooter =
    mode === "riding" && live && pedalQualified
      ? live.aheadRank != null && live.gapToNextKm != null
        ? { label: `${live.aheadRank}위까지`, km: live.gapToNextKm }
        : null
      : mapData?.me.status === "ranked" &&
          mapData.me.rank != null &&
          mapData.me.rank > 1 &&
          mapData.me.gapToNextKm != null
        ? { label: "1위까지", km: mapData.me.gapToNextKm }
        : null;

  const ridingNoSensor = mode === "riding" && !pedalQualified;

  return { me, mode, chipA11y, listRows, gapFooter, ridingNoSensor };
}

export function LeaderboardGlanceChip(props: LeaderboardGlanceViewProps) {
  const { panelOpen, onTogglePanel } = props;
  const { chipA11y } = buildGlanceModel(props);
  return (
    <button
      type="button"
      className={`lb-glance__chip${panelOpen ? " lb-glance__chip--open" : ""}`}
      aria-expanded={panelOpen}
      aria-controls="lb-glance-panel"
      aria-label={chipA11y}
      title={chipA11y}
      onPointerDown={stopMapTouch}
      onTouchStart={stopMapTouch}
      onClick={onTogglePanel}
    >
      <RankChipIcon />
    </button>
  );
}

export function LeaderboardGlancePanel(props: LeaderboardGlanceViewProps) {
  const {
    panelOpen,
    onOpenFullLeaderboard,
    onRegister,
    isGuest,
  } = props;
  const { mode, me, listRows, gapFooter, ridingNoSensor } = buildGlanceModel(props);
  const showPanel = panelOpen && (mode === "map" || mode === "riding");
  if (!showPanel) return null;

  return (
        <section
          id="lb-glance-panel"
          className="lb-glance__panel"
          aria-label={mode === "riding" ? "주행 중 순위" : "이번 주 순위"}
          onPointerDown={stopMapTouch}
          onTouchStart={stopMapTouch}
        >
          {mode === "riding" ? (
            <header className="lb-glance__panel-head lb-glance__outline lb-glance__outline--label">
              이번 주 순위 · 달리는 동안 갱신
            </header>
          ) : (
            <header className="lb-glance__panel-head">
              <span className="lb-glance__outline lb-glance__outline--label">
                순위 · 주행 거리 · 이번 주
              </span>
              <button
                type="button"
                className="lb-glance__outline lb-glance__outline--link"
                onClick={onOpenFullLeaderboard}
              >
                전체 보기 ›
              </button>
            </header>
          )}

          {listRows.length > 0 ? (
            <ol className="lb-glance__list">
              {listRows.map((row) => {
                const top3 = row.rank >= 1 && row.rank <= 3;
                return (
                  <li
                    key={`${row.rank}-${row.nickname}`}
                    className={`lb-glance__row${row.isMe ? " lb-glance__row--me" : ""}`}
                    aria-current={row.isMe ? "true" : undefined}
                  >
                    <span
                      className={[
                        "lb-glance__outline",
                        "lb-glance__rank",
                        top3 ? "lb-glance__outline--accent" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {row.rank}
                    </span>
                    <span
                      className={[
                        "lb-glance__outline",
                        "lb-glance__name",
                        row.isMe ? "lb-glance__outline--hero" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {row.isMe ? (
                        <>
                          {row.nickname}
                          <span className="lb-glance__me-tag">나</span>
                        </>
                      ) : (
                        row.nickname
                      )}
                    </span>
                    <span className="lb-glance__live-slot" aria-hidden>
                      {row.liveTrailId ? <span className="lb-glance__live-dot" /> : null}
                    </span>
                    <span
                      className={[
                        "lb-glance__outline",
                        "lb-glance__km",
                        row.isMe ? "lb-glance__outline--hero" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {formatKmOne(row.valueKm)}{" "}
                      <span className="lb-glance__km-unit">km</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {ridingNoSensor ? (
            <p className="lb-glance__outline lb-glance__footer">
              센서 없이 달리는 중 · 순위 제외
            </p>
          ) : gapFooter ? (
            <p className="lb-glance__outline lb-glance__footer">
              {gapFooter.label}{" "}
              <span className="lb-glance__outline lb-glance__outline--hero lb-glance__gap-km">
                {formatKmOne(gapFooter.km)} km
              </span>
            </p>
          ) : null}

          {mode === "map" && isGuest && onRegister ? (
            <button type="button" className="lb-glance__text-btn" onClick={onRegister}>
              회원 등록하면 그대로 순위에 올라가요
            </button>
          ) : null}
          {mode === "map" && !isGuest && me?.status === "unranked" ? (
            <p className="lb-glance__outline lb-glance__hint">센서로 달리면 순위에 올라가요</p>
          ) : null}
        </section>
  );
}

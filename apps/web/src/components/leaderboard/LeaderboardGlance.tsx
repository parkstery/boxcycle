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

function stopMapTouch(e: SyntheticEvent) {
  e.stopPropagation();
}

function buildGlanceModel(props: LeaderboardGlanceViewProps) {
  const {
    mode,
    mapData,
    rideSnapshot,
    liveRows,
    myBaseKm,
    addedKm,
    pedalQualified,
  } = props;

  const me = mode === "riding" ? rideSnapshot?.me : mapData?.me;

  const live =
    mode === "riding" && pedalQualified
      ? computeLeaderboardLiveRank(liveRows, myBaseKm, addedKm, 10)
      : null;

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

  return { me, mode, listRows, gapFooter, ridingNoSensor };
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

  return (
        <section
          id="lb-glance-panel"
          className="lb-glance__panel"
          hidden={!showPanel}
          aria-hidden={!showPanel}
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

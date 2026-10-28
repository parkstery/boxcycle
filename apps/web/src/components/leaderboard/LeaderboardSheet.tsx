import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  fetchLeaderboard,
  type LeaderboardBoard,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type LeaderboardEntry,
} from "../../services/leaderboardApi";
import { useDialogFocus } from "../ui/useDialogFocus";
import { useEscapeKeyClose } from "../ui/useEscapeKeyClose";
import { settleUnlessCancelled } from "../ui/settleUnlessCancelled";
import "./LeaderboardSheet.css";

type LeaderboardSheetProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  /** 게스트 「회원 등록」 — App 의 Google 연결(인증 훅은 App 에 하나뿐이다) */
  onRegister?: () => void;
  /** 「같이 달리기」 — App 의 Trail 합류 */
  onJoinTrail?: (trailId: string) => void;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: LeaderboardResponse };

const BOARD_LABELS: Record<LeaderboardBoard, string> = {
  distance: "주행 거리",
  pioneer: "개척",
};

const PERIOD_LABELS: Record<LeaderboardPeriod, { label: string; short: string }> = {
  week: { label: "이번 주", short: "주" },
  month: { label: "이번 달", short: "달" },
  all: { label: "전체", short: "전체" },
};

const PERIOD_ORDER: LeaderboardPeriod[] = ["week", "month", "all"];

function getNextPeriod(current: LeaderboardPeriod): LeaderboardPeriod {
  const idx = PERIOD_ORDER.indexOf(current);
  return PERIOD_ORDER[(idx + 1) % PERIOD_ORDER.length];
}

function fmtKm(v: number): string {
  // 자릿수를 맞춰 줄 사이 숫자가 흔들리지 않게 늘 소수 1자리(182.0, 140.3)
  return v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

type PioneerUseRow = {
  rank: number;
  nickname: string;
  isMe: boolean;
  uses: { riders: number; km: number } | null;
};

function collectPioneerUseRows(
  me: LeaderboardResponse["me"] | null | undefined,
  groups: LeaderboardEntry[][],
): PioneerUseRow[] {
  const byRank = new Map<number, PioneerUseRow>();
  for (const group of groups) {
    for (const entry of group) {
      if (byRank.has(entry.rank)) continue;
      byRank.set(entry.rank, {
        rank: entry.rank,
        nickname: entry.nickname,
        isMe: Boolean(entry.isMe),
        uses: entry.uses,
      });
    }
  }
  if (me?.status === "ranked" && me.rank != null) {
    const existing = byRank.get(me.rank);
    if (existing) {
      existing.isMe = true;
      if (me.uses) existing.uses = me.uses;
    } else {
      byRank.set(me.rank, { rank: me.rank, nickname: "나", isMe: true, uses: me.uses });
    }
  }
  return [...byRank.values()].sort((a, b) => a.rank - b.rank);
}

function renderRankBadge(rank: number, isTop3: boolean, isMe: boolean): ReactNode {
  const cls = isMe
    ? "leaderboard-sheet__rank-badge is-me"
    : isTop3
    ? "leaderboard-sheet__rank-badge is-top3"
    : "leaderboard-sheet__rank-badge";
  return <span className={cls}>{rank}</span>;
}

export function LeaderboardSheet({ open, ...rest }: LeaderboardSheetProps) {
  if (!open) return null;
  return <LeaderboardPanel {...rest} />;
}

function LeaderboardPanel({ onClose, user, onRegister, onJoinTrail }: Omit<LeaderboardSheetProps, "open">) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, panelRef);
  useEscapeKeyClose(true, onClose);

  const [board, setBoard] = useState<LeaderboardBoard>("distance");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!user) return;
    return settleUnlessCancelled(fetchLeaderboard(user, board, period), setState);
  }, [user, board, period]);

  const handleTabClick = (nextBoard: LeaderboardBoard) => {
    if (nextBoard === board) return;
    setBoard(nextBoard);
    // 개척 탭 기본 기간 = 이번 달, 주행 거리 탭 기본 기간 = 이번 주
    setPeriod(nextBoard === "pioneer" ? "month" : "week");
  };

  const handlePeriodClick = () => {
    setPeriod((p) => getNextPeriod(p));
  };

  const view: LoadState = user ? state : { kind: "error", message: "로그인이 필요합니다." };
  const data = view.kind === "ready" ? view.data : null;

  const me = data?.me;
  const top = data?.top ?? [];
  const around = me?.around ?? [];
  const visibleTop = top.slice(0, 10);
  const extraTop = top.slice(10);
  const aroundVisible = around.filter((entry) => !top.some((row) => row.rank === entry.rank));
  const hasMore = extraTop.length > 0 || aroundVisible.length > 0;
  const rankedCompact = view.kind === "ready" && me?.status === "ranked";
  const pioneerUseRows = collectPioneerUseRows(me, [visibleTop, extraTop, aroundVisible]);
  const showPioneerUses = board === "pioneer" && (Boolean(me?.uses) || pioneerUseRows.length > 0);

  return (
    <div className="leaderboard-sheet" role="dialog" aria-label="리더보드">
      <button
        type="button"
        className="leaderboard-sheet__scrim"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className={`leaderboard-sheet__panel${rankedCompact ? " leaderboard-sheet__panel--ranked" : ""}`}
        ref={panelRef}
      >
        <div className="leaderboard-sheet__top">
          <nav className="leaderboard-sheet__tabs" aria-label="순위 종류">
            <button
              type="button"
              className={`leaderboard-sheet__tab${board === "distance" ? " is-active" : ""}`}
              aria-pressed={board === "distance"}
              onClick={() => handleTabClick("distance")}
            >
              주행 거리
            </button>
            <button
              type="button"
              className={`leaderboard-sheet__tab${board === "pioneer" ? " is-active" : ""}`}
              aria-pressed={board === "pioneer"}
              onClick={() => handleTabClick("pioneer")}
            >
              개척
            </button>
          </nav>
          <button
            type="button"
            className="leaderboard-sheet__period-btn"
            onClick={handlePeriodClick}
            aria-label={`기간 변경 (현재: ${PERIOD_LABELS[period].label})`}
          >
            {PERIOD_LABELS[period].label} ▾
          </button>
          <span className="leaderboard-sheet__scope">
            <span className="leaderboard-sheet__scope-label">세계</span>
          </span>
          <button
            type="button"
            className="leaderboard-sheet__close"
            aria-label="리더보드 닫기"
            title="닫기"
            onClick={onClose}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#2A2E37" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <div className="leaderboard-sheet__me-area">
          {view.kind === "loading" ? (
            <p className="leaderboard-sheet__loading" role="status">불러오는 중…</p>
          ) : view.kind === "error" ? (
            <p className="leaderboard-sheet__error" role="alert">{view.message}</p>
          ) : me ? (
            <>
              {me.status === "guest" ? (
                <div className="leaderboard-sheet__guest">
                  <span className="leaderboard-sheet__guest-label">{PERIOD_LABELS[period].label} 내 기록</span>
                  <span className="leaderboard-sheet__guest-value">
                    {fmtKm(me.valueKm)} <span className="leaderboard-sheet__unit">km</span>
                  </span>
                  <p className="leaderboard-sheet__guest-desc">
                    회원 등록하면 지금까지의 기록이 그대로 순위에 올라갑니다
                  </p>
                  {me.projectedRank != null && (
                    <p className="leaderboard-sheet__guest-hint">
                      지금이라면 <b>{me.projectedRank}위</b>쯤이에요
                    </p>
                  )}
                  <button
                    type="button"
                    className="leaderboard-sheet__signup-btn"
                    onClick={onRegister}
                  >
                    Google 계정으로 회원 등록
                  </button>
                </div>
              ) : me.status === "unranked" ? (
                <div className="leaderboard-sheet__unranked">
                  <span className="leaderboard-sheet__me-label">
                    {board === "distance" ? "내 순위" : "내 개척 순위"}
                  </span>
                  <span className="leaderboard-sheet__unranked-rank">순위 없음</span>
                  <p className="leaderboard-sheet__unranked-desc">
                    {board === "distance"
                      ? `${PERIOD_LABELS[period].label} 센서 주행이 있으면 순위에 올라요`
                      : `${PERIOD_LABELS[period].label} 새 도로를 달리면 순위에 올라요`}
                  </p>
                </div>
              ) : (
                <div className="leaderboard-sheet__ranked">
                  <span className="leaderboard-sheet__me-label">
                    {board === "distance" ? "내 순위" : "내 개척 순위"} <strong>{me.rank}위</strong>
                  </span>
                  <strong className="leaderboard-sheet__ranked-value">
                    {fmtKm(me.valueKm)} <span className="leaderboard-sheet__unit">{board === "distance" ? "km" : "km 새 도로"}</span>
                  </strong>
                  {me.gapToNextKm != null && (
                    <p className="leaderboard-sheet__gap">
                      {me.rank && me.rank > 1 ? `${me.rank - 1}위까지 ` : ""}{fmtKm(me.gapToNextKm)} km
                    </p>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {showPioneerUses ? (
          <details className="leaderboard-sheet__uses-fold">
            <summary>내 길 이용 · 새 도로</summary>
            {me?.uses ? (
              <p className="leaderboard-sheet__uses">
                내 길을 <b>{me.uses.riders}명</b>이 <b>{fmtKm(me.uses.km)} km</b> 달렸어요
              </p>
            ) : null}
            {pioneerUseRows.length > 0 ? (
              <ul className="leaderboard-sheet__uses-list" aria-label="참가자 길 이용">
                {pioneerUseRows.map((row) => (
                  <li key={row.rank} className="leaderboard-sheet__uses-item">
                    <span className="leaderboard-sheet__uses-name">
                      {row.rank} {row.nickname}{row.isMe ? " 나" : ""}
                    </span>
                    <span className="leaderboard-sheet__uses-stat">
                      {row.uses ? `${row.uses.riders}명 · ${fmtKm(row.uses.km)} km` : "이용 없음"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}

        <ol className="leaderboard-sheet__list" role="list" aria-label={`${BOARD_LABELS[board]} 상위 순위`}>
          {visibleTop.map((entry, idx) => (
            <LeaderboardRow
              key={`top-${idx}`}
              entry={entry}
              board={board}
              isTop3={entry.rank <= 3}
              onJoinTrail={onJoinTrail}
            />
          ))}
          {top.length === 0 && around.length === 0 && view.kind === "ready" && (
            <li className="leaderboard-sheet__empty">기록이 없습니다</li>
          )}
        </ol>

        {hasMore ? (
          <details className="leaderboard-sheet__more">
            <summary>10위 이후 · 내 주변</summary>
            <ol className="leaderboard-sheet__more-list" role="list" aria-label={`${BOARD_LABELS[board]} 추가 순위`}>
              {extraTop.map((entry, idx) => (
                <LeaderboardRow
                  key={`extra-${idx}`}
                  entry={entry}
                  board={board}
                  isTop3={false}
                  onJoinTrail={onJoinTrail}
                />
              ))}
              {aroundVisible.length > 0 && extraTop.length > 0 ? (
                <li className="leaderboard-sheet__ellipsis" aria-hidden="true">⋯</li>
              ) : extraTop.length === 0 && aroundVisible.length > 0 && visibleTop.length > 0
                && aroundVisible[0].rank > visibleTop[visibleTop.length - 1].rank + 1 ? (
                <li className="leaderboard-sheet__ellipsis" aria-hidden="true">⋯</li>
              ) : null}
              {aroundVisible.map((entry, idx) => (
                <LeaderboardRow
                  key={`around-${idx}`}
                  entry={entry}
                  board={board}
                  isTop3={false}
                  isMe={entry.isMe}
                  onJoinTrail={onJoinTrail}
                />
              ))}
            </ol>
          </details>
        ) : null}

        <p className="leaderboard-sheet__footnote">
          {board === "distance"
            ? "케이던스 센서 주행 · 월요일 0시 초기화"
            : "새 도로 = 처음 달린 실제 도로 · 같은 길 반복은 세지 않음"}
        </p>
      </div>
    </div>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  board: LeaderboardBoard;
  isTop3: boolean;
  isMe?: boolean;
  onJoinTrail?: (trailId: string) => void;
}

function LeaderboardRow({
  entry,
  isTop3,
  isMe = false,
  onJoinTrail,
}: LeaderboardRowProps) {
  const { rank, nickname, valueKm, uses, liveTrailId, isMe: entryIsMe } = entry;
  const me = isMe || entryIsMe;
  const usesLabel = uses ? `${uses.riders}명 · ${fmtKm(uses.km)} km` : null;
  const rowLabel = `${rank}위 ${nickname}${me ? " 나" : ""} ${fmtKm(valueKm)} km${usesLabel ? ` · 내 길 이용 ${usesLabel}` : ""}`;

  return (
    <li
      className={`leaderboard-sheet__row${me ? " is-me" : ""}`}
      aria-current={me ? "true" : undefined}
      aria-label={rowLabel}
    >
      {renderRankBadge(rank, isTop3, me)}
      <span
        className={`leaderboard-sheet__name${me ? " is-me" : ""}`}
        title={nickname}
      >
        {nickname}{me && <span className="leaderboard-sheet__me-badge">나</span>}
      </span>
      {liveTrailId != null && !me && (
        <button
          type="button"
          className="leaderboard-sheet__join-btn"
          disabled={!onJoinTrail}
          aria-label="같이 달리기"
          title="같이 달리기"
          onClick={() => onJoinTrail?.(liveTrailId)}
        >
          <span className="leaderboard-sheet__join-dot" aria-hidden="true" />
        </button>
      )}
      <span className="leaderboard-sheet__value" title={usesLabel ?? undefined}>
        {fmtKm(valueKm)} <span className="leaderboard-sheet__unit">km</span>
      </span>
    </li>
  );
}

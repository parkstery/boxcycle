import { useEffect, useRef, useState } from "react";
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

function renderRankBadge(rank: number, isTop3: boolean, isMe: boolean): React.ReactNode {
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

  return (
    <div className="leaderboard-sheet" role="dialog" aria-label="리더보드">
      <button
        type="button"
        className="leaderboard-sheet__scrim"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="leaderboard-sheet__panel" ref={panelRef}>
        <div className="leaderboard-sheet__left">
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

          <div className="leaderboard-sheet__period-row">
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
                      {fmtKm(me.valueKm)} <span className="leaderboard-sheet__unit">KM</span>
                    </span>
                    <p className="leaderboard-sheet__guest-desc">
                      회원 등록하면 지금까지의 기록이<br />그대로 순위에 올라갑니다
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
                    <div className="leaderboard-sheet__unranked-value">
                      <span className="leaderboard-sheet__unranked-rank">순위 없음</span>
                    </div>
                    <p className="leaderboard-sheet__unranked-desc">
                      {board === "distance"
                        ? `${PERIOD_LABELS[period].label} 센서 주행이 있으면 순위에 올라요`
                        : `${PERIOD_LABELS[period].label} 새 도로를 달리면 순위에 올라요`}
                    </p>
                  </div>
                ) : (
                  <div className="leaderboard-sheet__ranked">
                    <span className="leaderboard-sheet__me-label">
                      {board === "distance" ? "내 순위" : "내 개척 순위"}
                    </span>
                    <div className="leaderboard-sheet__ranked-main">
                      <span className="leaderboard-sheet__rank-number">{me.rank}</span>
                      <span className="leaderboard-sheet__rank-suffix">위</span>
                    </div>
                    <span className="leaderboard-sheet__ranked-value">
                      {fmtKm(me.valueKm)} <span className="leaderboard-sheet__unit">{board === "distance" ? "KM" : "KM 새 도로"}</span>
                    </span>
                    {me.gapToNextKm != null && (
                      <p className="leaderboard-sheet__gap">
                        {me.rank && me.rank > 1 ? `${me.rank - 1}위까지 ` : ""}<b>{fmtKm(me.gapToNextKm)} km</b> 남았어요
                      </p>
                    )}
                    {me.uses && board === "pioneer" && (
                      <p className="leaderboard-sheet__uses">
                        내 길을 <b>{me.uses.riders}명</b>이 <b>{fmtKm(me.uses.km)} km</b> 달렸어요
                      </p>
                    )}
                    {board === "distance" && (
                      <p className="leaderboard-sheet__footnote">케이던스 센서로 달린 주행만 · 월요일 0시 초기화</p>
                    )}
                    {board === "pioneer" && (
                      <p className="leaderboard-sheet__footnote">새 도로 = 처음 달린 실제 도로 · 같은 길 반복은 세지 않음</p>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div className="leaderboard-sheet__right">
          <header className="leaderboard-sheet__list-header">
            <span className="leaderboard-sheet__list-title">
              {board === "distance" ? "순위" : "개척 순위"}
            </span>
            {board === "pioneer" && (
              <>
                <span className="leaderboard-sheet__col-uses">내 길 이용</span>
                <span className="leaderboard-sheet__col-new">새 도로</span>
              </>
            )}
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
          </header>

          <ol className="leaderboard-sheet__list" role="list" aria-label={`${BOARD_LABELS[board]} 상위 순위`}>
            {top.map((entry, idx) => (
              <LeaderboardRow
                key={`top-${idx}`}
                entry={entry}
                board={board}
                isTop3={entry.rank <= 3}
                onJoinTrail={onJoinTrail}
              />
            ))}
            {(top.length > 0 && around.length > 0 && around[0].rank > top[top.length - 1].rank + 1) ? (
              <li className="leaderboard-sheet__ellipsis" aria-hidden="true">⋯</li>
            ) : null}
            {around.map((entry, idx) => (
              <LeaderboardRow
                key={`around-${idx}`}
                entry={entry}
                board={board}
                isTop3={false}
                isMe={entry.isMe}
                onJoinTrail={onJoinTrail}
              />
            ))}
            {top.length === 0 && around.length === 0 && view.kind === "ready" && (
              <li className="leaderboard-sheet__empty">기록이 없습니다</li>
            )}
          </ol>
        </div>
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
  board,
  isTop3,
  isMe = false,
  onJoinTrail,
}: LeaderboardRowProps) {
  const { rank, nickname, valueKm, uses, liveTrailId, isMe: entryIsMe } = entry;
  const me = isMe || entryIsMe;

  return (
    <li className={`leaderboard-sheet__row${me ? " is-me" : ""}`} aria-current={me ? "true" : undefined}>
      {renderRankBadge(rank, isTop3, me)}
      <span className={`leaderboard-sheet__name${me ? " is-me" : ""}`}>
        {nickname}{me && <span className="leaderboard-sheet__me-badge">나</span>}
      </span>
      {board === "pioneer" && (
        <span className="leaderboard-sheet__uses-cell">
          {uses ? `${uses.riders}명 · ${fmtKm(uses.km)} km` : "—"}
        </span>
      )}
      {liveTrailId != null && !me && (
        <button
          type="button"
          className="leaderboard-sheet__join-btn"
          disabled={!onJoinTrail}
          onClick={() => onJoinTrail?.(liveTrailId)}
        >
          <span className="leaderboard-sheet__join-dot" aria-hidden="true" />
          같이 달리기
        </button>
      )}
      <span className="leaderboard-sheet__value">
        {fmtKm(valueKm)} <span className="leaderboard-sheet__unit">KM</span>
      </span>
    </li>
  );
}

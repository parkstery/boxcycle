import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  fetchAdminDashboard,
  type AdminDashboardResponse,
  type AdminMetricsBlock,
  type AdminRecentBlock,
} from "../../services/adminDashboardApi";
import { useDialogFocus } from "../ui/useDialogFocus";
import { useEscapeKeyClose } from "../ui/useEscapeKeyClose";
import "./AdminDashboardSheet.css";
import { settleUnlessCancelled } from "../ui/settleUnlessCancelled";

type AdminDashboardSheetProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: AdminDashboardResponse };

const DASH = "—";

function fmtPct(v: number | null): string {
  return v == null ? DASH : `${Math.round(v * 10) / 10}`;
}

/** 0~1 비율 → % 숫자 */
function fmtRatio(v: number | null): string {
  return v == null ? DASH : `${Math.round(v * 1000) / 10}`;
}

function fmtInt(v: number): string {
  return v.toLocaleString("ko-KR");
}

function fmtKm(v: number): string {
  return (Math.round(v * 10) / 10).toLocaleString("ko-KR");
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

const METRIC_ROWS: { label: string; pick: (b: AdminMetricsBlock) => string }[] = [
  { label: "첫 주행 완료율 (%)", pick: (b) => fmtPct(b.firstRideCompletionRatePct) },
  { label: "72시간 안 재주행 (%)", pick: (b) => fmtPct(b.secondRideWithin72hRatePct) },
  { label: "다른 날 재사용 (%)", pick: (b) => fmtPct(b.otherDayReuseRatePct) },
  { label: "새 도로 비율 (%)", pick: (b) => fmtRatio(b.newRoadClaimRatio) },
  { label: "계정 수", pick: (b) => fmtInt(b.accounts) },
  { label: "주행 수", pick: (b) => fmtInt(b.validRides) },
];

const RECENT_ROWS: { label: string; key: "today" | "last7Days" }[] = [
  { label: "오늘", key: "today" },
  { label: "최근 7일", key: "last7Days" },
];

function recentCells(r: AdminRecentBlock): string[] {
  return [fmtInt(r.signups), fmtInt(r.rides), fmtKm(r.distanceKm)];
}

/** 관리자 지표 — 사용자 지표·최근 현황·점검 숫자. 사용자 정보 시트의 「관리」에서 연다. */
export function AdminDashboardSheet({ open, onClose, user }: AdminDashboardSheetProps) {
  // 열 때마다 새로 마운트 — 이전 상태가 남아 낡은 숫자를 비추지 않게 한다
  if (!open) return null;
  return <AdminDashboardPanel onClose={onClose} user={user} />;
}

function AdminDashboardPanel({ onClose, user }: { onClose: () => void; user: User | null }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, panelRef);
  useEscapeKeyClose(true, onClose);

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => {
    setState({ kind: "loading" });
    setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!user) return;
    return settleUnlessCancelled(fetchAdminDashboard(user), setState);
  }, [user, reloadTick]);

  const view: LoadState = user
    ? state
    : { kind: "error", message: "로그인이 필요합니다." };
  const data = view.kind === "ready" ? view.data : null;
  const pending = data?.health.pendingPublicRouteRequests ?? 0;

  return (
    <div className="admin-dashboard-sheet" role="dialog" aria-label="관리자 지표">
      <button
        type="button"
        className="admin-dashboard-sheet__scrim"
        aria-label="닫기"
        title="Close"
        onClick={onClose}
      />
      <div className="admin-dashboard-sheet__panel" ref={panelRef}>
        <div className="admin-dashboard-sheet__head">
          <h2 className="admin-dashboard-sheet__title">관리자 지표</h2>
          <button
            type="button"
            className="admin-dashboard-sheet__close"
            aria-label="관리자 지표 닫기"
            title="닫기"
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {view.kind === "loading" ? (
          <p className="admin-dashboard-sheet__note" role="status">
            불러오는 중…
          </p>
        ) : null}
        {view.kind === "error" ? (
          <p className="admin-dashboard-sheet__note admin-dashboard-sheet__note--error" role="alert">
            {view.message}
          </p>
        ) : null}

        {data ? (
          <div className="admin-dashboard-sheet__body">
            <section className="admin-dashboard-sheet__block" aria-label="사용자 지표">
              <h3 className="admin-dashboard-sheet__kicker">사용자 지표</h3>
              <table className="admin-dashboard-sheet__table">
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">전체</th>
                    <th scope="col">게스트</th>
                    <th scope="col">Google</th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.pick(data.metrics.all)}</td>
                      <td>{row.pick(data.metrics.guest)}</td>
                      <td>{row.pick(data.metrics.provider)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="admin-dashboard-sheet__side">
              <section className="admin-dashboard-sheet__block" aria-label="최근">
                <h3 className="admin-dashboard-sheet__kicker">최근 (KST)</h3>
                <table className="admin-dashboard-sheet__table">
                  <thead>
                    <tr>
                      <th scope="col" />
                      <th scope="col">가입</th>
                      <th scope="col">주행</th>
                      <th scope="col">거리 (km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_ROWS.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{row.label}</th>
                        {recentCells(data.recent[row.key]).map((c, i) => (
                          <td key={i}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="admin-dashboard-sheet__block" aria-label="점검">
                <h3 className="admin-dashboard-sheet__kicker">점검</h3>
                <p
                  className={`admin-dashboard-sheet__health${pending > 0 ? " is-warn" : ""}`}
                  role={pending > 0 ? "alert" : undefined}
                >
                  처리 안 된 공개 경로 신청 <strong>{fmtInt(pending)}</strong>건
                </p>
              </section>
            </div>
          </div>
        ) : null}

        <div className="admin-dashboard-sheet__foot">
          <p className="admin-dashboard-sheet__foot-text">
            {data
              ? `내부 계정 ${fmtInt(data.excludedAccounts)}개 제외 · 주행 인정 기준 ${fmtInt(
                  data.rule.minRideDistanceMeters,
                )}m·${fmtInt(data.rule.minRideDurationSec)}초 · 갱신 ${fmtClock(data.generatedAt)}`
              : ""}
          </p>
          <button
            type="button"
            className="admin-dashboard-sheet__refresh"
            disabled={view.kind === "loading"}
            title="Refresh"
            onClick={reload}
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
}

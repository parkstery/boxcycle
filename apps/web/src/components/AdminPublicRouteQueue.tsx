import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { getUserPublicLabelsByUid } from "../lib/firestoreUser";
import {
  approvePublicRouteRequest,
  loadPendingPublicRouteRequests,
  rejectPublicRouteRequest,
  type PublicRouteRequest,
} from "../lib/publicRouteRequests";
import "./AdminPublicRouteQueue.css";

export type AdminPublicRouteQueueProps = {
  reviewer: User;
  onQueueChanged: () => void;
};

export function AdminPublicRouteQueue(props: AdminPublicRouteQueueProps) {
  const [rows, setRows] = useState<PublicRouteRequest[]>([]);
  const [applicantLabels, setApplicantLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadPendingPublicRouteRequests();
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (rows.length === 0) {
      setApplicantLabels({});
      return;
    }
    let cancelled = false;
    void getUserPublicLabelsByUid(rows.map((r) => r.applicantUid)).then((labels) => {
      if (!cancelled) setApplicantLabels(Object.fromEntries(labels));
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  async function onApprove(req: PublicRouteRequest) {
    if (busyId) return;
    if (!window.confirm(`「${req.publicTitle}」 신청을 승인하고 공개 코스를 생성할까요?`)) return;
    setBusyId(req.id);
    setError(null);
    try {
      await approvePublicRouteRequest(props.reviewer, req);
      await reload();
      props.onQueueChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(req: PublicRouteRequest) {
    if (busyId) return;
    const reason = window.prompt("거절 사유를 입력하세요 (필수):", "");
    if (reason === null) return;
    if (!reason.trim()) {
      setError("거절 사유를 입력해야 합니다.");
      return;
    }
    setBusyId(req.id);
    setError(null);
    try {
      await rejectPublicRouteRequest(props.reviewer, req, reason);
      await reload();
      props.onQueueChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-prq" aria-label="공개 경로 신청 심사">
      <div className="admin-prq__head">
        <h2 className="admin-prq__title">공개 경로 심사 대기</h2>
        <button
          type="button"
          className="admin-prq__refresh"
          disabled={loading}
          title="Refresh queue"
          onClick={() => void reload()}
        >
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>
      {error ? (
        <p className="admin-prq__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && rows.length === 0 ? (
        <p className="admin-prq__empty">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="admin-prq__empty">대기 중인 신청이 없습니다.</p>
      ) : (
        <ul className="admin-prq__list">
          {rows.map((req) => {
            const busy = busyId === req.id;
            return (
              <li key={req.id} className="admin-prq__item">
                <div className="admin-prq__item-head">
                  <strong>{req.publicTitle}</strong>
                  <span className="admin-prq__meta">
                    신청자 {applicantLabels[req.applicantUid] ?? "불러오는 중…"} · 저장 경로{" "}
                    {req.savedRouteNameSnapshot}
                  </span>
                </div>
                {req.publicSummary ? <p className="admin-prq__summary">{req.publicSummary}</p> : null}
                <p className="admin-prq__tags">
                  태그: {req.experienceTags.join(", ")} · {(req.snapshotDistanceMeters / 1000).toFixed(2)} km
                </p>
                <div className="admin-prq__actions">
                  <button
                    type="button"
                    className="admin-prq__btn admin-prq__btn--ok"
                    disabled={busy}
                    title="Approve and publish"
                    onClick={() => void onApprove(req)}
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    className="admin-prq__btn admin-prq__btn--no"
                    disabled={busy}
                    title="Reject with reason"
                    onClick={() => void onReject(req)}
                  >
                    거절
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

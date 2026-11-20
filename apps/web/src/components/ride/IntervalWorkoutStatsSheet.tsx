import { useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseConfigured } from "../../lib/firebase/app";
import { INTERVAL_INTENSITIES } from "../../lib/ride/intervalWorkout";
import { loadRideSessionsInRangeFromFirestore } from "../../lib/ride/repo/firestoreRides";
import type { StoredRideSession } from "../../lib/ride/rideSessionsStorage";
import {
  aggregateIntervalWorkoutStatsInRange,
  getRideStatsPeriodRange,
  shiftRideStatsReference,
  type RideStatsPeriod,
} from "../../lib/ride/rideStatsAggregate";
import { useDialogFocus } from "../ui/useDialogFocus";
import "./IntervalWorkoutStatsSheet.css";

type Props = {
  userId: string | null;
  fallbackSessions: readonly StoredRideSession[];
  onClose: () => void;
};

type LoadState = {
  key: string;
  rows: StoredRideSession[];
  error: boolean;
  localOnly: boolean;
};

function duration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return minutes > 0 ? `${minutes}분${remainder ? ` ${remainder}초` : ""}` : `${remainder}초`;
}

const STATUS_LABELS = {
  completed: "프로그램 완료",
  stopped: "중도 종료",
  reconfigured: "설정 변경",
  disabled: "인터벌 해제",
} as const;

/** 사용자 정보 판 내부 상세. 운동 통계는 지역 선택과 독립이며, 주행 종료일 기준으로 묶는다. */
export function IntervalWorkoutStatsSheet({ userId, fallbackSessions, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  useDialogFocus(true, panelRef);
  const [period, setPeriod] = useState<RideStatsPeriod>("week");
  const [reference, setReference] = useState(() => new Date());
  const [retry, setRetry] = useState(0);
  const range = useMemo(() => getRideStatsPeriodRange(period, reference), [period, reference]);
  const requestKey = `${userId ?? ""}:${range.start.getTime()}:${range.endExclusive.getTime()}:${retry}`;
  const [loadState, setLoadState] = useState<LoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!userId) {
        if (!cancelled) setLoadState({ key: requestKey, rows: [], error: false, localOnly: false });
        return;
      }
      if (!isFirebaseConfigured()) {
        // 소유자를 확인할 수 없는 옛 로컬 자료를 다른 계정의 통계로 올리지 않는다.
        const rows = fallbackSessions.filter((row) => row.ownerUid === userId);
        if (!cancelled) setLoadState({ key: requestKey, rows, error: false, localOnly: true });
        return;
      }
      try {
        const rows = await loadRideSessionsInRangeFromFirestore(userId, range.start, range.endExclusive);
        if (!cancelled) setLoadState({ key: requestKey, rows, error: false, localOnly: false });
      } catch {
        // 실패를 0회로 보여주거나 직전 계정·기간의 결과로 대체하지 않는다.
        if (!cancelled) setLoadState({ key: requestKey, rows: [], error: true, localOnly: false });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, requestKey, range.start, range.endExclusive, fallbackSessions]);

  const currentLoad = loadState?.key === requestKey ? loadState : null;
  const rows = currentLoad?.rows;
  const stats = useMemo(
    () => aggregateIntervalWorkoutStatsInRange(rows ?? [], range.start, range.endExclusive),
    [rows, range.start, range.endExclusive],
  );
  const currentPeriodStart = getRideStatsPeriodRange(period).start.getTime();
  const isCurrentPeriod = range.start.getTime() >= currentPeriodStart;

  return (
    <section ref={panelRef} className="interval-workout-stats" aria-label="인터벌 운동 기록">
      <header className="interval-workout-stats__head">
        <h2>인터벌 기록</h2>
        <button type="button" onClick={onClose} aria-label="인터벌 기록 닫기">돌아가기</button>
      </header>
      <nav className="interval-workout-stats__period" aria-label="인터벌 통계 기간">
        <div role="tablist" aria-label="인터벌 기간 단위">
          {([{ id: "week", label: "주간" }, { id: "month", label: "월간" }, { id: "quarter", label: "분기" }] as const).map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={period === item.id}
              onClick={() => { setPeriod(item.id); setReference(new Date()); }}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" aria-label="이전 인터벌 통계 기간" onClick={() => setReference(shiftRideStatsReference(period, reference, -1))}>‹</button>
        <span>{period === "week" ? `${range.start.getFullYear()}년 ${range.labelKo}` : range.labelKo}</span>
        <button type="button" aria-label="다음 인터벌 통계 기간" disabled={isCurrentPeriod}
          onClick={() => setReference(shiftRideStatsReference(period, reference, 1))}>›</button>
      </nav>

      <div className="interval-workout-stats__body" aria-busy={currentLoad == null}>
        {!userId ? <p>인증된 계정에서 운동 기록을 확인할 수 있어요.</p>
          : !currentLoad ? <p role="status">운동 기록을 불러오는 중이에요.</p>
            : currentLoad.error ? <p role="alert">운동 기록을 불러오지 못했어요. <button type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></p>
              : <>
                {currentLoad.localOnly ? <p className="interval-workout-stats__note" role="status">이 기기에 저장된 일부 기록만 표시해요.</p> : null}
                <p className="interval-workout-stats__note">주행 종료일·기기 시간대 기준 · 모든 지역의 운동 · 강도는 사용자 선택 기준</p>
                {stats.started > 0 ? <>
                  <dl className="interval-workout-stats__summary">
                    <div><dt>시작 / 완료</dt><dd>{stats.started}회 / {stats.completed}회</dd></div>
                    <div><dt>수행시간 · 운동한 날</dt><dd>{duration(stats.elapsedSec)} · {stats.activityDays}일</dd></div>
                    <div><dt>페달 확인시간</dt><dd>{stats.activeUnknownCount === stats.started ? "확인 불가" : duration(stats.activeSec)}{stats.activeUnknownCount > 0 || stats.signalGapCount > 0 ? " · 일부 미확인" : ""}</dd></div>
                    <div><dt>선택 강도 기준 추정 열량</dt><dd>{stats.caloriesUnknownCount === stats.started ? "미산정" : `${Math.round(stats.caloriesEstimate)} kcal`}{stats.caloriesUnknownCount > 0 && stats.caloriesUnknownCount < stats.started ? " · 일부 미산정" : ""}</dd></div>
                  </dl>
                  <p className="interval-workout-stats__intensities">
                    {INTERVAL_INTENSITIES.map((item) => <span key={item.id}>{item.label} {duration(stats.intensitySeconds[item.id])}</span>)}
                  </p>
                  <p className="interval-workout-stats__note">강도별 시간은 준비·회복을 포함한 프로그램 수행시간이에요.</p>
                  <ul className="interval-workout-stats__list" aria-label="기간 내 인터벌 수행 목록">
                    {stats.entries.map(({ key, endedAt, workout }) => (
                      <li key={key}>
                        <div><time dateTime={endedAt}>{new Date(endedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time><strong>{STATUS_LABELS[workout.status]}</strong></div>
                        <p>{INTERVAL_INTENSITIES.find((item) => item.id === workout.intensity)?.label} · {duration(workout.elapsedSec)} / 계획 {duration(workout.plannedSec)} · {workout.caloriesEstimate == null ? "열량 미산정" : `추정 ${Math.round(workout.caloriesEstimate)} kcal`}{workout.signalGap ? " · 센서 누락" : ""}</p>
                        {workout.feedback ? <p>체감: {{ easier: "목표보다 편했어요", "as-planned": "목표와 비슷했어요", harder: "목표보다 힘들었어요" }[workout.feedback]}</p> : null}
                      </li>
                    ))}
                  </ul>
                </> : <p>이 기간에 기록된 인터벌 수행이 없어요.</p>}
                {stats.unclassifiedRideCount > 0 ? <p className="interval-workout-stats__note">인터벌 구분이 없는 주행 {stats.unclassifiedRideCount}건은 집계하지 않았어요. 과거 수행 여부는 확인할 수 없어요.</p> : null}
                <p className="interval-workout-stats__note">완료는 프로그램 진행 완료이며, 목표 강도 달성을 인증하는 수치는 아니에요.</p>
              </>}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTINENT_LABELS, homeCountryLabel, listHomeCountryOptions } from "../../lib/identity/homeCountry";
import {
  DISTANCE_BUCKETS,
  TIME_BUCKETS,
  countTrailsByCountry,
  defaultTrailFinderScope,
  estimateTrailMinutes,
  filterTrailFinderRows,
  formatTrailMinutes,
  groupTrailFinderRows,
  type DistanceBucket,
  type TimeBucket,
  type TrailFinderRow,
  type TrailFinderScope,
  type TrailFinderSort,
} from "../../lib/trail/trailFinder";
import { countTrailFinderListings, fetchTrailFinderListings, TRAIL_FINDER_PAGE } from "../../lib/trail/repo/trailFinderListings";
import { useDialogFocus } from "../ui/useDialogFocus";
import "./TrailFinderSheet.css";

type Props = {
  onClose: () => void;
  homeCountry: string | null;
  /** 예상 시간 계산 — 내 평균 속도(km/h) */
  avgKmh: number;
  onJoinTrail: (trailId: string, publicationId?: string | null) => void;
  /** 주행 중이면 합류 단추를 막는다 */
  rideSessionActive: boolean;
};

const CONTINENTS = ["AS", "EU", "NA", "SA", "OC", "AF"] as const;
const GROUP_STEP = 6;
const nf = (n: number) => String(n).padStart(3, "0");

function scopeKey(s: TrailFinderScope) {
  return s.type === "world" ? "world" : `${s.type}:${s.code}`;
}

function scopeTrail(scope: TrailFinderScope, continentOfCountry: string | null): string[] {
  if (scope.type === "world") return ["세계"];
  if (scope.type === "continent") return ["세계", CONTINENT_LABELS[scope.code] ?? scope.code];
  return ["세계", ...(continentOfCountry ? [CONTINENT_LABELS[continentOfCountry] ?? continentOfCountry] : []), homeCountryLabel(scope.code)];
}

/**
 * Trail 찾기(2026-11-05 Chief 시안 ⑦⑧, F1~F4) — 왼쪽 조건(범위·거리·예상 시간), 오른쪽 결과(같은 경로 묶음).
 * 목록 = 지금 주행 중인 Trail(D6). 범위는 서버 조회, 거리·시간·검색은 받은 목록 안에서 거른다.
 */
export function TrailFinderSheet(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref);
  const [scope, setScope] = useState<TrailFinderScope>(() => defaultTrailFinderScope(props.homeCountry));
  const [sort, setSort] = useState<TrailFinderSort>("riders");
  const [distance, setDistance] = useState<DistanceBucket>("all");
  const [time, setTime] = useState<TimeBucket>("all");
  const [view, setView] = useState<"list" | "scope">("list");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [shownGroups, setShownGroups] = useState(GROUP_STEP);
  const [pageSize, setPageSize] = useState(TRAIL_FINDER_PAGE);

  const reqKey = `${scopeKey(scope)}|${sort}|${pageSize}`;
  const [result, setResult] = useState<{ key: string; rows: TrailFinderRow[]; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchTrailFinderListings(scope, sort, pageSize)
      .then((rows) => !cancelled && setResult({ key: reqKey, rows, error: null }))
      .catch((e: unknown) => !cancelled && setResult({ key: reqKey, rows: [], error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [reqKey, scope, sort, pageSize]);
  const loading = result?.key !== reqKey;
  const rows = useMemo(() => (loading ? [] : (result?.rows ?? [])), [loading, result]);

  const filtered = useMemo(() => filterTrailFinderRows(rows, { distance, time, avgKmh: props.avgKmh }), [rows, distance, time, props.avgKmh]);
  const groups = useMemo(() => groupTrailFinderRows(filtered, sort), [filtered, sort]);
  const continentOfHome = useMemo(
    () => (scope.type === "country" ? (rows.find((r) => r.geoCountry === scope.code)?.geoContinent ?? null) : null),
    [rows, scope],
  );

  const close = props.onClose;
  return createPortal(
    <div className="oc-modal-overlay tf-overlay" onClick={close}>
      <div
        ref={ref}
        className="tf-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tf-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          if (view === "scope") setView("list");
          else close();
        }}
      >
        {view === "scope" ? (
          <TrailFinderScopePicker
            current={scope}
            homeCountry={props.homeCountry}
            onPick={(s) => {
              setScope(s);
              setShownGroups(GROUP_STEP);
              setPageSize(TRAIL_FINDER_PAGE);
              setView("list");
            }}
            onBack={() => setView("list")}
          />
        ) : (
          <>
            <div className="tf-pane">
              <span className="tf-label">범위</span>
              <button type="button" className="tf-scope-btn" onClick={() => setView("scope")} aria-label={`범위 바꾸기 — 지금 ${scopeTrail(scope, continentOfHome).join(" › ")}`}>
                {scopeTrail(scope, continentOfHome).slice(0, -1).length ? (
                  <span className="tf-scope-path">{scopeTrail(scope, continentOfHome).slice(0, -1).join(" › ")} ›</span>
                ) : null}
                <span className="tf-scope-cur">{scopeTrail(scope, continentOfHome).at(-1)}</span>
                <span className="tf-grow" />
                <span aria-hidden="true">▾</span>
              </button>
              <span className="tf-label">거리</span>
              <div className="tf-chips tf-chips--5" role="group" aria-label="거리">
                {DISTANCE_BUCKETS.map((b) => (
                  <button key={b.id} type="button" className="tf-chip" aria-pressed={distance === b.id} onClick={() => setDistance(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
              <span className="tf-label">예상 시간 · 내 평균 {Math.round(props.avgKmh)} km/h</span>
              <div className="tf-chips tf-chips--4" role="group" aria-label="예상 시간">
                {TIME_BUCKETS.map((b) => (
                  <button key={b.id} type="button" className="tf-chip" aria-pressed={time === b.id} onClick={() => setTime(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
              <span className="tf-grow" />
              <span className="tf-caption">지금 달리는 Trail 만 보여요. 처음 열면 내 대표 국가 · 사람 많은 순이에요.</span>
            </div>
            <div className="tf-main">
              <div className="tf-head">
                <h2 id="tf-title" className="tf-title">Trail 찾기</h2>
                <span className="tf-count">{loading ? "불러오는 중…" : `${filtered.length}개`}</span>
                <span className="tf-grow" />
                <button type="button" className="tf-pill" onClick={() => setSort(sort === "riders" ? "new" : "riders")} aria-label={`정렬 바꾸기 — 지금 ${sort === "riders" ? "사람 많은 순" : "새로 열린 순"}`}>
                  {sort === "riders" ? "사람 많은 순" : "새로 열린 순"} ▾
                </button>
                <button type="button" className="tf-icon-btn" aria-label="닫기" onClick={close}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="tf-list" role="list" aria-label="Trail 목록">
                {!loading && result?.error ? <p className="tf-empty">{result.error}</p> : null}
                {!loading && !result?.error && groups.length === 0 ? (
                  <div className="tf-empty">
                    <p>
                      {rows.length === 0 ? `${scopeTrail(scope, continentOfHome).at(-1)}에 지금 달리는 Trail 이 없어요.` : "조건에 맞는 Trail 이 없어요."}
                    </p>
                    {scope.type !== "world" ? (
                      <button type="button" className="tf-pill" onClick={() => setScope({ type: "world" })}>
                        세계로 넓히기
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {groups.slice(0, shownGroups).map((g) => {
                  const multi = g.trails.length > 1;
                  const open = expanded.has(g.key);
                  const min = estimateTrailMinutes(g.distanceKm, props.avgKmh);
                  const one = g.trails[0];
                  return (
                    <div key={g.key} role="listitem" className="tf-group">
                      <div className="tf-row">
                        <span className="tf-name">
                          <strong>{g.title}</strong>
                          <span className="tf-sub">
                            {multi ? `Trail ${g.trails.length}개 · ${g.riderCount}명` : `${nf(one.displayNumber)} · ${g.riderCount}명`}
                          </span>
                        </span>
                        <span className="tf-km">
                          {g.distanceKm != null ? g.distanceKm.toFixed(1) : "—"} <span className="tf-unit">km</span>
                        </span>
                        <span className="tf-min">{formatTrailMinutes(min)}</span>
                        {multi ? (
                          <button type="button" className="tf-link" aria-expanded={open} onClick={() => setExpanded((s) => toggle(s, g.key))}>
                            {open ? "접기 ▴" : "펼치기 ▾"}
                          </button>
                        ) : (
                          <JoinButton disabled={props.rideSessionActive} label={g.title} onJoin={() => props.onJoinTrail(one.id, one.publicationId)} />
                        )}
                      </div>
                      {multi && open
                        ? g.trails.map((t) => (
                            <div key={t.id} className="tf-row tf-row--child">
                              <span className="tf-name">
                                <span className="tf-num">{nf(t.displayNumber)}</span> · {t.riderCount}명
                              </span>
                              <JoinButton disabled={props.rideSessionActive} label={`${g.title} ${nf(t.displayNumber)}`} onJoin={() => props.onJoinTrail(t.id, t.publicationId)} />
                            </div>
                          ))
                        : null}
                    </div>
                  );
                })}
                {groups.length > shownGroups || (rows.length >= pageSize && groups.length <= shownGroups) ? (
                  <button
                    type="button"
                    className="tf-more"
                    onClick={() => {
                      if (groups.length > shownGroups) setShownGroups((n) => n + GROUP_STEP);
                      else setPageSize((n) => n + TRAIL_FINDER_PAGE);
                    }}
                  >
                    {groups.length > shownGroups ? `${Math.min(GROUP_STEP, groups.length - shownGroups)}개 더 보기` : "더 불러오기"}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function toggle(s: ReadonlySet<string>, k: string): ReadonlySet<string> {
  const n = new Set(s);
  if (n.has(k)) n.delete(k);
  else n.add(k);
  return n;
}

function JoinButton(props: { disabled: boolean; label: string; onJoin: () => void }) {
  return (
    <button type="button" className="tf-join" disabled={props.disabled} aria-label={`${props.label} — 합류`} title={props.disabled ? "주행 중에는 합류할 수 없어요" : "이 Trail 에 합류"} onClick={props.onJoin}>
      합류
    </button>
  );
}

/**
 * 범위 고르기(시안 ⑧) — 나라 이름 검색, 대륙 버튼(Trail 수), 대륙을 누르면 Trail 많은 나라 순.
 */
function TrailFinderScopePicker(props: {
  current: TrailFinderScope;
  homeCountry: string | null;
  onPick: (s: TrailFinderScope) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [continent, setContinent] = useState<string | null>(props.current.type === "continent" ? props.current.code : null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [byCountry, setByCountry] = useState<{ continent: string; rows: ReturnType<typeof countTrailsByCountry> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      countTrailFinderListings({ type: "world" }).catch(() => 0),
      ...CONTINENTS.map((c) => countTrailFinderListings({ type: "continent", code: c }).catch(() => 0)),
    ]).then(([world, ...cs]) => {
      if (cancelled) return;
      const m: Record<string, number> = { world: world ?? 0 };
      CONTINENTS.forEach((c, i) => (m[c] = cs[i] ?? 0));
      setCounts(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!continent) return;
    let cancelled = false;
    void fetchTrailFinderListings({ type: "continent", code: continent }, "riders", 100)
      .then((rows) => !cancelled && setByCountry({ continent, rows: countTrailsByCountry(rows) }))
      .catch(() => !cancelled && setByCountry({ continent, rows: [] }));
    return () => {
      cancelled = true;
    };
  }, [continent]);

  const options = useMemo(() => listHomeCountryOptions(), []);
  const q = search.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase() === q).slice(0, 4) : [];
  const selectedCount = continent ? counts?.[continent] : counts?.world;
  const countries = byCountry?.continent === continent ? byCountry.rows : null;

  return (
    <>
      <div className="tf-pane">
        <span className="tf-label">지금 고른 범위</span>
        <span className="tf-scope-sum">{continent ? `세계 › ${CONTINENT_LABELS[continent] ?? continent}` : "세계"}</span>
        <span className="tf-hero">
          <span className="tf-hero-num">{selectedCount ?? "…"}</span>
          <span className="tf-hero-unit">개 Trail</span>
        </span>
        <span className="tf-grow" />
        <button type="button" className="tf-primary" onClick={() => props.onPick(continent ? { type: "continent", code: continent } : { type: "world" })}>
          {continent ? `${CONTINENT_LABELS[continent] ?? continent} Trail 보기` : "세계 Trail 보기"}
        </button>
        <span className="tf-caption">지금 달리는 Trail 수예요.</span>
      </div>
      <div className="tf-main">
        <div className="tf-head">
          <button type="button" className="tf-icon-btn" aria-label="뒤로" onClick={props.onBack}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 id="tf-title" className="tf-title">범위 고르기</h2>
          <span className="tf-grow" />
          {props.homeCountry ? (
            <button type="button" className="tf-pill" onClick={() => props.onPick({ type: "country", code: props.homeCountry! })}>
              내 나라
            </button>
          ) : null}
        </div>
        <label className="tf-search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="tf-sr">나라 이름 검색</span>
          <input type="search" value={search} placeholder="나라 이름 (예: 프랑스, 일본)" onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="tf-list">
          {matches.map((o) => (
            <button key={o.code} type="button" className="tf-row tf-row--pick" onClick={() => props.onPick({ type: "country", code: o.code })}>
              <strong>{o.label}</strong>
              <span className="tf-grow" />
              <span className="tf-sub">이 나라 Trail 보기 ›</span>
            </button>
          ))}
          {!q ? (
            <>
              <span className="tf-label">대륙에서 고르기</span>
              <div className="tf-chips tf-chips--3" role="group" aria-label="대륙">
                {CONTINENTS.map((c) => (
                  <button key={c} type="button" className="tf-chip tf-chip--row" aria-pressed={continent === c} onClick={() => setContinent(continent === c ? null : c)}>
                    {CONTINENT_LABELS[c]} <span className="tf-chip-n">{counts ? counts[c] : "…"}</span>
                  </button>
                ))}
              </div>
              {continent ? (
                countries == null ? (
                  <p className="tf-caption">불러오는 중…</p>
                ) : countries.length === 0 ? (
                  <p className="tf-caption">{CONTINENT_LABELS[continent]}에 지금 달리는 Trail 이 없어요.</p>
                ) : (
                  countries.slice(0, 6).map((c) => (
                    <button key={c.code} type="button" className="tf-row tf-row--pick" onClick={() => props.onPick({ type: "country", code: c.code })}>
                      <strong>{homeCountryLabel(c.code)}</strong>
                      <span className="tf-grow" />
                      <span className="tf-sub">Trail {c.count} · {c.riders}명</span>
                    </button>
                  ))
                )
              ) : null}
            </>
          ) : matches.length === 0 ? (
            <p className="tf-caption">「{search}」 와 맞는 나라가 없어요.</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

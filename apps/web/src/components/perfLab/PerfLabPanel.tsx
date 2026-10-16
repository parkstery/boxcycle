import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import {
  isPerfLabEnabled,
  readAppBuildId,
  readPerfLabDeviceInfo,
  readPerfLabFrameStats,
  startPerfLabFrameClock,
  stopPerfLabFrameClock,
  type PerfLabDeviceInfo,
} from "../../lib/debug/perfLab";
import {
  readRiderCostWindow,
  readRiderPerfScene,
  type RiderLod2State,
  type RiderPerfScene,
} from "../../lib/debug/riderRenderCostProbe";
import { readRiderJitterStats, type RiderJitterKind, type RiderJitterStats } from "../../lib/debug/riderJitterProbe";
import {
  readFrameBreakdown,
  startFrameBreakdownObservers,
  stopFrameBreakdownObservers,
  TICK_PHASES,
  type DurationStats,
  type FrameBreakdown,
  type TickPhase,
} from "../../lib/debug/frameBreakdownProbe";
import { shouldAnimateRiderPose, shouldUseRiderLod2 } from "../../lib/rider/riderDetailLod";
import { readEffectiveRiderSkinMode } from "../../lib/riderPrototype/riderSkinMode";
import { getMapCutKeys } from "../../lib/map/mapCut";
import { readRideLabelDist, readRideLabelMode, readRideLabelsHidden } from "../../lib/map/rideLabels";
import "./PerfLabPanel.css";

/**
 * 라이더 실측 패널(`?perflab=1`).
 * 쿼리가 없으면 훅 없이 `null` — 안쪽 패널은 마운트되지 않고 rAF 도 없다.
 */
export function PerfLabPanel({ mapZoom }: { mapZoom: number }) {
  if (!isPerfLabEnabled()) return null;
  return <PerfLabPanelInner mapZoom={mapZoom} />;
}

function blockMapPropagation(e: PointerEvent<HTMLElement> | TouchEvent<HTMLElement>): void {
  e.stopPropagation();
}

function fmtMs(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function fmtFps(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

function fmtRatio(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function fmtZoom(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function fmtM(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function fmtCv(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function kindLabel(kind: RiderJitterKind): string {
  if (kind === "self") return "본인";
  if (kind === "pacer") return "페이서";
  return "동행";
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function lod2Label(state: RiderLod2State | null, zoom: number | null): string {
  if (state == null) return "—";
  if (state === "loading") return "로딩";
  if (state === "error") return "실패";
  if (state === "none") return "없음";
  return shouldUseRiderLod2(true, shouldAnimateRiderPose(zoom)) ? "사용" : "미사용";
}

function deviceLine(device: PerfLabDeviceInfo): string {
  const dpr =
    device.devicePixelRatio != null
      ? `${Math.round(device.devicePixelRatio * 100) / 100}x`
      : null;
  const mapRatio =
    device.mapPixelRatio != null ? `지도${Math.round(device.mapPixelRatio * 100) / 100}x` : null;
  const parts = [
    device.webgl?.unmaskedRenderer ?? null,
    device.hardwareConcurrency != null ? `${device.hardwareConcurrency}c` : null,
    device.deviceMemory != null ? `${device.deviceMemory}GB` : null,
    dpr,
    mapRatio,
    device.screenWidth != null && device.screenHeight != null
      ? `${device.screenWidth}×${device.screenHeight}`
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ") || "기기 —";
}

function buildReport(mapZoom: number, scene: RiderPerfScene) {
  const zoom = scene.zoom ?? mapZoom;
  const lod2Used =
    scene.lod2State == null
      ? null
      : shouldUseRiderLod2(scene.lod2State === "ready", shouldAnimateRiderPose(zoom));
  return {
    capturedAt: new Date().toISOString(),
    build: readAppBuildId(),
    mapcut: getMapCutKeys(),
    skinMode: readEffectiveRiderSkinMode(),
    rideLabelsHidden: readRideLabelsHidden(),
    rideLabelMode: readRideLabelMode(),
    rideLabelDist: readRideLabelDist(),
    frame: readPerfLabFrameStats(),
    rider: {
      ...readRiderCostWindow(),
      riderCount: scene.riderCount,
      zoom,
      lod2State: scene.lod2State,
      lod2Used,
    },
    device: readPerfLabDeviceInfo(),
    jitter: readRiderJitterStats(),
    breakdown: readFrameBreakdown(),
  };
}

const PHASE_LABEL: Record<TickPhase, string> = {
  self: "본인",
  camera: "카메라",
  peer: "동행",
  pacer: "페이서",
  markers: "마커",
  spec: "스펙",
  sync: "동기",
  nametag: "이름",
};

function DurationLine({ label, stats }: { label: string; stats: DurationStats }) {
  return (
    <p className="perf-lab__line">
      <span className="perf-lab__muted">{label}</span>{" "}
      <span className="rtw-numeric">
        {fmtMs(stats.meanMs)} {fmtMs(stats.p95Ms)}
      </span>
    </p>
  );
}

function gpuLine(breakdown: FrameBreakdown): string {
  if (breakdown.gpu.reason === "unsupported") return "미지원";
  if (!breakdown.gpu.supported) return "—";
  return `${fmtMs(breakdown.gpu.meanMs)} ${fmtMs(breakdown.gpu.p95Ms)}`;
}

function BreakdownLines({ breakdown }: { breakdown: FrameBreakdown }) {
  const summary = breakdown.summary;
  return (
    <>
      <DurationLine label="틱" stats={breakdown.tick} />
      {TICK_PHASES.map((phase) => (
        <DurationLine key={phase} label={PHASE_LABEL[phase]} stats={breakdown.tick.phases[phase]} />
      ))}
      <DurationLine label="나머지" stats={breakdown.tick.other} />
      {breakdown.map.method === "map._render" ? (
        <>
          <DurationLine label="지도" stats={breakdown.map} />
          <p className="perf-lab__line">
            <span className="perf-lab__muted">지도자체</span>{" "}
            <span className="rtw-numeric">
              {fmtMs(breakdown.map.exRiderMeanMs)} {fmtMs(breakdown.map.exRiderP95Ms)}
            </span>
          </p>
        </>
      ) : (
        <p className="perf-lab__line">
          <span className="perf-lab__muted">지도</span> {breakdown.map.method === "events-only" ? "이벤트" : "—"}
        </p>
      )}
      <p className="perf-lab__line">
        <span className="perf-lab__muted">React</span>{" "}
        <span className="rtw-numeric">{breakdown.react.commitsPerSec.toFixed(1)}</span>
        <span className="perf-lab__muted">/s · </span>
        <span className="rtw-numeric">{fmtMs(breakdown.react.commitSumMs)}</span>
      </p>
      <p className="perf-lab__line">
        <span className="perf-lab__muted">LoAF</span>{" "}
        {breakdown.loaf.supported ? (
          <>
            <span className="rtw-numeric">{breakdown.loaf.count}</span>
            <span className="perf-lab__muted"> · 막 </span>
            <span className="rtw-numeric">{fmtMs(breakdown.loaf.blockingMs)}</span>
            <span className="perf-lab__muted"> · 배치 </span>
            <span className="rtw-numeric">{fmtMs(breakdown.loaf.styleAndLayoutMs)}</span>
          </>
        ) : (
          "미지원"
        )}
      </p>
      {breakdown.loaf.topScripts.map((row) => (
        <p key={row.source} className="perf-lab__line">
          <span className="perf-lab__muted">스크립트</span> {row.source}{" "}
          <span className="rtw-numeric">{fmtMs(row.ms)}</span>
        </p>
      ))}
      <p className="perf-lab__line">
        <span className="perf-lab__muted">GPU</span> <span className="rtw-numeric">{gpuLine(breakdown)}</span>
      </p>
      <p className="perf-lab__line">
        <span className="perf-lab__muted">합</span> 간격{" "}
        <span className="rtw-numeric">{fmtMs(summary.frameMeanMs)}</span>
        {" ≈ JS "}
        <span className="rtw-numeric">{fmtMs(summary.jsMs)}</span>
        {" + 대기 "}
        <span className="rtw-numeric">{fmtMs(summary.waitMs)}</span>
      </p>
    </>
  );
}

function JitterLines({ rows }: { rows: readonly RiderJitterStats[] }) {
  if (rows.length === 0) {
    return (
      <p className="perf-lab__line perf-lab__muted">
        떨림 <span className="rtw-numeric">—</span>
      </p>
    );
  }
  return (
    <>
      {rows.map((row) => (
        <p key={`${row.kind}:${row.id}`} className="perf-lab__line">
          <span className="perf-lab__muted">{kindLabel(row.kind)}</span> {shortId(row.id)}
          {" 역 "}
          <span className="rtw-numeric">{row.reverseFrames}</span>
          {" · "}
          <span className="rtw-numeric">{fmtM(row.maxReverseM)}</span>
          {" · cv "}
          <span className="rtw-numeric">{fmtCv(row.speedCv)}</span>
          {" · ±"}
          <span className="rtw-numeric">{fmtM(row.relStdM)}</span>
        </p>
      ))}
    </>
  );
}

type PanelPos = { x: number; y: number };

const PERF_LAB_POS_KEY = "rtw.perflab.pos";

function readSavedPos(): PanelPos | null {
  try {
    const raw = window.localStorage.getItem(PERF_LAB_POS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PanelPos>;
    return typeof v.x === "number" && typeof v.y === "number" ? { x: v.x, y: v.y } : null;
  } catch {
    return null;
  }
}

function savePos(pos: PanelPos | null): void {
  try {
    if (pos) window.localStorage.setItem(PERF_LAB_POS_KEY, JSON.stringify(pos));
    else window.localStorage.removeItem(PERF_LAB_POS_KEY);
  } catch {
    /* 저장 못 해도 이번 화면에서는 옮긴 자리에 있다 */
  }
}

/** 패널이 화면 밖으로 나가지 않게 왼쪽 위 좌표를 가둔다. */
function clampPos(pos: PanelPos, el: HTMLElement | null): PanelPos {
  const w = el?.offsetWidth ?? 120;
  const h = el?.offsetHeight ?? 48;
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - h)),
  };
}

function PerfLabPanelInner({ mapZoom }: { mapZoom: number }) {
  const [collapsed, setCollapsed] = useState(true);
  const [pos, setPos] = useState<PanelPos | null>(() => readSavedPos());
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    startPerfLabFrameClock();
    startFrameBreakdownObservers();
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      window.clearInterval(id);
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
      stopFrameBreakdownObservers();
      stopPerfLabFrameClock();
    };
  }, []);

  useEffect(() => {
    if (!fallback || !fallbackRef.current) return;
    fallbackRef.current.focus();
    fallbackRef.current.select();
  }, [fallback]);

  const scene = readRiderPerfScene();
  const frame = readPerfLabFrameStats();
  const rider = readRiderCostWindow();
  const jitter = readRiderJitterStats();
  const breakdown = readFrameBreakdown();
  const device = readPerfLabDeviceInfo();
  const zoom = scene.zoom ?? mapZoom;
  const mapcut = getMapCutKeys();
  const rideLabelsHidden = readRideLabelsHidden();
  const rideLabelMode = readRideLabelMode();
  const rideLabelDist = readRideLabelDist();
  void tick;

  const copyReport = async () => {
    const text = JSON.stringify(buildReport(mapZoom, scene), null, 2);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFallback(null);
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setFallback(text);
    }
  };

  // 손잡이(⠿)를 끌어 패널을 옮긴다. 자리는 이 기기에 기억, 손잡이 두 번 탭이면 기본 자리.
  const onHandleDown = (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { id: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    setPos(clampPos({ x: e.clientX - drag.dx, y: e.clientY - drag.dy }, panelRef.current));
  };
  const onHandleUp = (e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    dragRef.current = null;
    setPos((p) => {
      savePos(p);
      return p;
    });
  };
  const resetPos = () => {
    setPos(null);
    savePos(null);
  };

  return (
    <div
      ref={panelRef}
      className={`perf-lab${collapsed ? " perf-lab--collapsed" : ""}${pos ? " perf-lab--moved" : ""}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      data-perflab-panel=""
      onPointerDown={blockMapPropagation}
      onTouchStart={blockMapPropagation}
    >
      <div className="perf-lab__head">
        <span
          className="perf-lab__handle"
          role="button"
          tabIndex={-1}
          aria-label="성능 패널 옮기기"
          title="끌어서 옮기기 · 두 번 탭하면 기본 자리"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onDoubleClick={resetPos}
        >
          ⠿
        </span>
        <span className="perf-lab__title">성능</span>
        <span className="perf-lab__muted">스킨 {readEffectiveRiderSkinMode()}</span>
        {!collapsed ? (
          <>
            <span className="perf-lab__muted">mapcut {mapcut.length > 0 ? mapcut.join(",") : "없음"}</span>
            <span className="perf-lab__muted">글자 모드 {rideLabelMode} (D {rideLabelDist}) · {rideLabelsHidden ? "숨김" : "표시"}</span>
          </>
        ) : null}
        <button
          type="button"
          className="perf-lab__collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "성능 펼치기" : "성능 접기"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <p className="perf-lab__line">
            <span className="rtw-numeric">{fmtFps(frame.fps)}</span> fps
            <span className="perf-lab__muted"> 프레임(ms)</span>{" "}
            <span className="rtw-numeric">
              {fmtMs(frame.p50Ms)} {fmtMs(frame.p95Ms)} {fmtMs(frame.maxMs)}
            </span>
          </p>
          <p className="perf-lab__line perf-lab__muted">
            &gt;33 <span className="rtw-numeric">{fmtRatio(frame.over33Ratio)}</span>
            {" · "}
            &gt;50 <span className="rtw-numeric">{fmtRatio(frame.over50Ratio)}</span>
          </p>
          <p className="perf-lab__line">
            <span className="perf-lab__muted">라이더(ms)</span>{" "}
            <span className="rtw-numeric">
              {fmtMs(rider.msPerFrame)} {fmtMs(rider.msPerRider)}
            </span>
            <span className="perf-lab__muted"> 자세 </span>
            <span className="rtw-numeric">{fmtPct(rider.posePct)}</span>
          </p>
          <p className="perf-lab__line">
            명 <span className="rtw-numeric">{scene.riderCount ?? "—"}</span>
            {" · "}줌 <span className="rtw-numeric">{fmtZoom(zoom)}</span>
            {" · "}LOD2 <span className="rtw-numeric">{lod2Label(scene.lod2State, zoom)}</span>
          </p>
          <JitterLines rows={jitter} />
          <BreakdownLines breakdown={breakdown} />
          <p className="perf-lab__device">{deviceLine(device)}</p>
          <button type="button" className="perf-lab__copy" onClick={() => void copyReport()}>
            {copied ? "복사됨" : "결과 복사"}
          </button>
          {fallback ? (
            <textarea
              ref={fallbackRef}
              className="perf-lab__fallback"
              readOnly
              value={fallback}
              aria-label="결과 JSON"
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

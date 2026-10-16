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
import { shouldAnimateRiderPose, shouldUseRiderLod2 } from "../../lib/rider/riderDetailLod";
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

function lod2Label(state: RiderLod2State | null, zoom: number | null): string {
  if (state == null) return "—";
  if (state === "loading") return "로딩";
  if (state === "error") return "실패";
  if (state === "none") return "없음";
  return shouldUseRiderLod2(true, shouldAnimateRiderPose(zoom)) ? "사용" : "미사용";
}

function deviceLine(device: PerfLabDeviceInfo): string {
  const parts = [
    device.webgl?.unmaskedRenderer ?? null,
    device.hardwareConcurrency != null ? `${device.hardwareConcurrency}c` : null,
    device.deviceMemory != null ? `${device.deviceMemory}GB` : null,
    device.devicePixelRatio != null ? `${device.devicePixelRatio}x` : null,
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
    frame: readPerfLabFrameStats(),
    rider: {
      ...readRiderCostWindow(),
      riderCount: scene.riderCount,
      zoom,
      lod2State: scene.lod2State,
      lod2Used,
    },
    device: readPerfLabDeviceInfo(),
  };
}

function PerfLabPanelInner({ mapZoom }: { mapZoom: number }) {
  const [collapsed, setCollapsed] = useState(true);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    startPerfLabFrameClock();
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      window.clearInterval(id);
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
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
  const device = readPerfLabDeviceInfo();
  const zoom = scene.zoom ?? mapZoom;
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

  return (
    <div
      className={`perf-lab${collapsed ? " perf-lab--collapsed" : ""}`}
      data-perflab-panel=""
      onPointerDown={blockMapPropagation}
      onTouchStart={blockMapPropagation}
    >
      <div className="perf-lab__head">
        <span className="perf-lab__title">성능</span>
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

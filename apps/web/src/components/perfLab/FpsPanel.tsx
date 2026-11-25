import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { FPS_WINDOW_MS, FpsMeter, type FpsReading } from "../../lib/debug/fpsMeter";
import { useDraggablePanel } from "./useDraggablePanel";
import "./FpsPanel.css";

type Sample = { id: number; label: string; text: string; pass: boolean };

const REFRESH_MS = 500;
const KEEP_SAMPLES = 5;

function currentMap(): MapboxMap | null {
  return (window as Window & { __RTW_MAP__?: MapboxMap }).__RTW_MAP__ ?? null;
}

function conditionText(map: MapboxMap | null): string {
  if (!map) return "지도 준비 중";
  try {
    const terrain = map.getTerrain() ? "지형 켬" : "지형 끔";
    const altitude = map.getFreeCameraOptions().position?.toAltitude();
    const height = altitude == null ? "" : ` · 고도 ${altitude < 100 ? altitude.toFixed(1) : Math.round(altitude)}m`;
    return `${terrain} · 피치 ${Math.round(map.getPitch())}°${height}`;
  } catch {
    return "지도 준비 중";
  }
}

const round = (n: number | null): string => (n == null ? "—" : String(Math.round(n)));
const ms = (n: number | null): string => (n == null ? "—" : n.toFixed(1));

/** 시험용 FPS 패널 — `?fps=1`. 지도가 실제로 그린 프레임만 세고 0.5초마다 숫자만 바꾼다. */
export function FpsPanel() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const drag = useDraggablePanel(panelRef, "rtw.fpsPanel.pos");
  const [meter] = useState(() => new FpsMeter());
  const [reading, setReading] = useState<FpsReading | null>(null);
  const [condition, setCondition] = useState("지도 준비 중");
  const [measureLeft, setMeasureLeft] = useState<number | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const measureEndRef = useRef<number | null>(null);
  const sampleIdRef = useRef(0);

  useEffect(() => {
    let map: MapboxMap | null = null;
    const onRender = () => meter.note(performance.now());
    const timer = window.setInterval(() => {
      const next = currentMap();
      if (next !== map) {
        map?.off("render", onRender);
        map = next;
        meter.reset();
        map?.on("render", onRender);
      }
      const now = performance.now();
      const r = meter.read(now);
      const where = conditionText(map);
      setReading(r);
      setCondition(where);
      const end = measureEndRef.current;
      if (end == null) return;
      if (now < end) {
        setMeasureLeft(Math.ceil((end - now) / 1000));
        return;
      }
      measureEndRef.current = null;
      setMeasureLeft(null);
      sampleIdRef.current += 1;
      const id = sampleIdRef.current;
      const pass = r.pass === true;
      const text = r.avg == null
        ? "지도가 멈춰 있어 측정하지 못함"
        : `평균 ${r.avg.toFixed(1)} · 최저 ${round(r.minSecond)} · p95 ${ms(r.p95Ms)}ms · ${pass ? "합격" : "미달"}`;
      setSamples((list) => [{ id, label: where, text, pass }, ...list].slice(0, KEEP_SAMPLES));
    }, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      map?.off("render", onRender);
    };
  }, [meter]);

  const startMeasure = () => {
    meter.reset();
    measureEndRef.current = performance.now() + FPS_WINDOW_MS;
    setMeasureLeft(FPS_WINDOW_MS / 1000);
  };
  const stopped = reading?.current == null;
  const tone = stopped ? "idle" : (reading?.current ?? 0) >= 24 ? "good" : "bad";

  return (
    <div
      ref={panelRef}
      className={`fps-panel${drag.moved ? " fps-panel--moved" : ""}`}
      style={drag.style}
      data-fps-panel=""
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="fps-panel__head">
        <span
          className="fps-panel__handle"
          role="button"
          tabIndex={-1}
          aria-label="FPS 패널 옮기기"
          title="끌어서 옮기기 · 두 번 누르면 기본 자리"
          {...drag.handle}
        >
          ⠿
        </span>
        <strong className={`fps-panel__value fps-panel__value--${tone} rtw-numeric`}>
          {stopped ? "정지" : round(reading?.current ?? null)}
        </strong>
        <span className="fps-panel__unit">FPS</span>
        <button type="button" className="fps-panel__measure" disabled={measureLeft != null} onClick={startMeasure}>
          {measureLeft != null ? `${measureLeft}초` : "10초 측정"}
        </button>
      </div>
      <p className="fps-panel__line rtw-numeric">
        최저 {round(reading?.minSecond ?? null)} · p95 {ms(reading?.p95Ms ?? null)}ms
        {reading?.pass == null ? "" : reading.pass ? " · 합격" : " · 미달"}
      </p>
      <p className="fps-panel__line fps-panel__muted">{condition}</p>
      {samples.map((s) => (
        <p key={s.id} className={`fps-panel__line fps-panel__sample${s.pass ? " is-pass" : ""}`}>
          <span className="fps-panel__muted">{s.label}</span>
          <br />
          <span className="rtw-numeric">{s.text}</span>
        </p>
      ))}
    </div>
  );
}

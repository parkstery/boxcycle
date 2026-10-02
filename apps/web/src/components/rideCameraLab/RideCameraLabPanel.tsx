import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import type { Camera1Mode } from "../../lib/camera/camera1Mode";
import {
  formatRideCameraLabCodePaste,
  isRideCameraLabEnabled,
  loadRideCameraLabSlot,
  productDefaultsForQc,
  saveRideCameraLabSlot,
  setRideCameraLabOverride,
  RIDE_CAMERA_LAB_RANGES,
  type RideCameraLabQc,
  type RideCameraLabState,
} from "../../lib/debug/rideCameraLab";
import "./RideCameraLabPanel.css";

type Props = {
  activeQuickCamera: RideCameraLabQc | null;
  camera1Mode: Camera1Mode;
  /** 거리 슬라이더 → App `rideCameraDistanceM` 동기(팔로우 distance 입력). */
  onDistanceM?: (distanceM: number) => void;
};

/**
 * Follow Camera 미세조정판 — `?camlab=1` 로만 연다.
 * FreeCamera/XYZ 없음. QC 제품 파라미터(distance·pitch·bearing Δ·look-at)만.
 */
export function RideCameraLabPanel(props: Props) {
  if (!isRideCameraLabEnabled()) return null;
  const slotKey =
    props.activeQuickCamera == null
      ? "none"
      : props.activeQuickCamera === 1
        ? `1:${props.camera1Mode}`
        : String(props.activeQuickCamera);
  // QC·aerial 단계가 바뀌면 슬롯 상태로 다시 마운트(effect 안 setState 회피).
  return <RideCameraLabPanelInner key={slotKey} {...props} />;
}

const SLIDER_META: readonly {
  key: keyof RideCameraLabState;
  label: string;
  unit: string;
  decimals: number;
}[] = [
  { key: "distanceM", label: "거리", unit: "m", decimals: 1 },
  { key: "pitchDeg", label: "피치", unit: "°", decimals: 1 },
  { key: "bearingOffsetDeg", label: "방위Δ", unit: "°", decimals: 1 },
  { key: "lookAtAlongExtraM", label: "겨냥", unit: "m", decimals: 1 },
  { key: "screenAnchor", label: "앵커", unit: "", decimals: 2 },
];

function blockMapPropagation(e: PointerEvent<HTMLElement> | TouchEvent<HTMLElement>): void {
  e.stopPropagation();
}

function RideCameraLabPanelInner(props: Props) {
  const { activeQuickCamera, camera1Mode, onDistanceM } = props;
  const [collapsed, setCollapsed] = useState(true);
  const [state, setState] = useState<RideCameraLabState>(() =>
    activeQuickCamera != null
      ? loadRideCameraLabSlot(activeQuickCamera, camera1Mode)
      : productDefaultsForQc(2, camera1Mode),
  );
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const onDistanceMRef = useRef(onDistanceM);

  useEffect(() => {
    onDistanceMRef.current = onDistanceM;
  }, [onDistanceM]);

  // 마운트·슬롯 전환 시 제품/저장 값을 rAF 오버라이드·거리 상태에 주입.
  useEffect(() => {
    if (activeQuickCamera == null) {
      setRideCameraLabOverride(null, camera1Mode, null);
      return;
    }
    setRideCameraLabOverride(activeQuickCamera, camera1Mode, state);
    if (state.distanceM > 0) onDistanceMRef.current?.(state.distanceM);
    return () => {
      setRideCameraLabOverride(null, camera1Mode, null);
    };
    // 초기 state 만 — 이후 슬라이더는 아래 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/slot remount
  }, [activeQuickCamera, camera1Mode]);

  useEffect(() => {
    if (activeQuickCamera == null) return;
    setRideCameraLabOverride(activeQuickCamera, camera1Mode, state);
    saveRideCameraLabSlot(activeQuickCamera, camera1Mode, state);
  }, [state, activeQuickCamera, camera1Mode]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const updateField = (key: keyof RideCameraLabState, value: number) => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "distanceM" && value > 0) onDistanceMRef.current?.(value);
      return next;
    });
  };

  const resetToProduct = () => {
    if (activeQuickCamera == null) return;
    const next = productDefaultsForQc(activeQuickCamera, camera1Mode);
    setState(next);
    if (next.distanceM > 0) onDistanceMRef.current?.(next.distanceM);
  };

  const routeFitLocked = activeQuickCamera === 1 && camera1Mode === "routeFit";
  const noQc = activeQuickCamera == null;
  const codePaste =
    activeQuickCamera != null ? formatRideCameraLabCodePaste(activeQuickCamera, camera1Mode, state) : "";

  const copyValue = async () => {
    if (!codePaste) return;
    try {
      await navigator.clipboard.writeText(codePaste);
      setCopied(true);
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* pre 블록을 손으로 복사 */
    }
  };

  return (
    <div
      className={`cam-lab${collapsed ? " cam-lab--collapsed" : ""}`}
      onPointerDown={blockMapPropagation}
      onTouchStart={blockMapPropagation}
    >
      <div className="cam-lab__head">
        <span className="cam-lab__title">캠 조절</span>
        <button
          type="button"
          className="cam-lab__collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "조절판 펼치기" : "조절판 접기"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="cam-lab__meta">
            {noQc
              ? "QC 선택"
              : routeFitLocked
                ? "QC1 R · fitBounds"
                : `QC${activeQuickCamera}${activeQuickCamera === 1 ? ` ${camera1Mode}` : ""}`}
          </div>

          {noQc || routeFitLocked ? (
            <p className="cam-lab__hint">
              {noQc
                ? "우상단 1–6 을 고른 뒤 조정한다."
                : "routeFit 은 free(1회 fitBounds). aerial 단계로 순환하면 거리·프레이밍을 조절한다."}
            </p>
          ) : (
            <>
              <div className="cam-lab__sliders">
                {SLIDER_META.map(({ key, label, unit, decimals }) => {
                  const range = RIDE_CAMERA_LAB_RANGES[key];
                  const value = state[key];
                  return (
                    <label className="cam-lab__row" key={key}>
                      <span className="cam-lab__label">{label}</span>
                      <input
                        type="range"
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        value={value}
                        onChange={(e) => updateField(key, Number(e.target.value))}
                      />
                      <span className="cam-lab__value rtw-numeric">
                        {value.toFixed(decimals)}
                        {unit}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="cam-lab__actions">
                <button type="button" className="cam-lab__chip cam-lab__chip--reset" onClick={resetToProduct}>
                  초기화
                </button>
              </div>

              <div className="cam-lab__copy">
                <pre className="cam-lab__code">{codePaste}</pre>
                <button type="button" className="cam-lab__copy-btn" onClick={() => void copyValue()}>
                  {copied ? "복사됨" : "값 복사"}
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

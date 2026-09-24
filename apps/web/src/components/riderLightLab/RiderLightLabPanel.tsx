import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import { setRiderLightLabState } from "../../lib/riderPrototype/preservedRiderLayer";
import {
  formatRiderLightLabCodePaste,
  isRiderLightLabEnabled,
  loadRiderLightLabState,
  RIDER_LIGHT_LAB_DEFAULT_STATE,
  RIDER_LIGHT_LAB_PRESETS,
  RIDER_LIGHT_LAB_PRESET_NAMES,
  RIDER_LIGHT_LAB_RANGES,
  saveRiderLightLabState,
  type RiderLightLabPresetName,
  type RiderLightLabState,
} from "../../lib/riderPrototype/riderLightLab";
import "./RiderLightLabPanel.css";

/**
 * 라이더 조명 조절판(지시02) — `?lightlab=1` 로만 연다.
 *
 * ⚠ `import.meta.env.DEV` 게이트 금지: Chief 는 배포된 프로덕션 사이트에서 확인한다.
 * 파라미터가 없으면 이 바깥 컴포넌트는 훅을 하나도 부르지 않고 그대로 `null` 을
 * 반환한다 — 실제 조절판(`RiderLightLabPanelInner`)은 마운트조차 되지 않는다.
 */
export function RiderLightLabPanel() {
  if (!isRiderLightLabEnabled()) return null;
  return <RiderLightLabPanelInner />;
}

const SLIDER_META: readonly { key: keyof RiderLightLabState; label: string; unit: string; decimals: number }[] = [
  { key: "ambient", label: "주변광", unit: "", decimals: 2 },
  { key: "hemisphere", label: "반구광", unit: "", decimals: 2 },
  { key: "keyIntensity", label: "주광", unit: "", decimals: 2 },
  { key: "keyAzimuthDeg", label: "방위각", unit: "°", decimals: 0 },
  { key: "keyElevationDeg", label: "고도각", unit: "°", decimals: 0 },
];

/** 패널 터치가 지도(Mapbox)로 새지 않게 — 이 리포에서 반복된 함정. preventDefault 는 슬라이더
 *  드래그 자체를 막아버리므로 쓰지 않는다(stopPropagation 만으로 지도 팬은 충분히 막힌다). */
function blockMapPropagation(e: PointerEvent<HTMLElement> | TouchEvent<HTMLElement>): void {
  e.stopPropagation();
}

function RiderLightLabPanelInner() {
  // 기본 접힘 — 주행 중에는 이 자리에 Quick Camera·계정 칩이 있다(지시02 §5 "지도를 과하게
  // 덮지 마라"). Chief 가 카메라 각도를 먼저 고른 뒤 펼쳐서 조명을 조절하는 흐름을 상정한다.
  const [collapsed, setCollapsed] = useState(true);
  const [state, setState] = useState<RiderLightLabState>(() => loadRiderLightLabState());
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  // 슬라이더가 바뀔 때마다 다음 프레임에 즉시 반영 + localStorage 기억(실패해도 무해).
  useEffect(() => {
    setRiderLightLabState(state);
    saveRiderLightLabState(state);
  }, [state]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const updateField = (key: keyof RiderLightLabState, value: number) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (name: RiderLightLabPresetName) => {
    setState({ ...RIDER_LIGHT_LAB_PRESETS[name] });
  };

  const resetToDefault = () => setState({ ...RIDER_LIGHT_LAB_DEFAULT_STATE });

  const codePaste = formatRiderLightLabCodePaste(state);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(codePaste);
      setCopied(true);
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한이 없으면 아래 코드 블록을 손으로 긁어 복사한다 */
    }
  };

  return (
    <div
      className={`light-lab${collapsed ? " light-lab--collapsed" : ""}`}
      onPointerDown={blockMapPropagation}
      onTouchStart={blockMapPropagation}
    >
      <div className="light-lab__head">
        <span className="light-lab__title">조명 조절판</span>
        <button
          type="button"
          className="light-lab__collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "조절판 펼치기" : "조절판 접기"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="light-lab__sliders">
            {SLIDER_META.map(({ key, label, unit, decimals }) => {
              const range = RIDER_LIGHT_LAB_RANGES[key];
              const value = state[key];
              return (
                <label className="light-lab__row" key={key}>
                  <span className="light-lab__label">{label}</span>
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={value}
                    onChange={(e) => updateField(key, Number(e.target.value))}
                  />
                  <span className="light-lab__value rtw-numeric">
                    {value.toFixed(decimals)}
                    {unit}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="light-lab__presets" role="group" aria-label="프리셋">
            {RIDER_LIGHT_LAB_PRESET_NAMES.map((name) => (
              <button key={name} type="button" className="light-lab__chip" onClick={() => applyPreset(name)}>
                {name}
              </button>
            ))}
            <button type="button" className="light-lab__chip light-lab__chip--reset" onClick={resetToDefault}>
              초기화
            </button>
          </div>

          <div className="light-lab__copy">
            <pre className="light-lab__code">{codePaste}</pre>
            <button type="button" className="light-lab__copy-btn" onClick={() => void copyValue()}>
              {copied ? "복사됨" : "값 복사"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

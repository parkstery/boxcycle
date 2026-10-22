import { useEffect, useState } from "react";
import { setRiderLightLabState } from "../../lib/riderPrototype/riderLightRig";
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
import { LabCodeCopy, LabPanelShell, LabSliders, type LabSliderMeta } from "../labPanel/LabPanelShell";
import { useLabCopy } from "../labPanel/useLabCopy";
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

const SLIDER_META: readonly LabSliderMeta<keyof RiderLightLabState>[] = [
  { key: "ambient", label: "주변광", unit: "", decimals: 2 },
  { key: "hemisphere", label: "반구광", unit: "", decimals: 2 },
  { key: "keyIntensity", label: "주광", unit: "", decimals: 2 },
  { key: "keyAzimuthDeg", label: "방위각", unit: "°", decimals: 0 },
  { key: "keyElevationDeg", label: "고도각", unit: "°", decimals: 0 },
];

function RiderLightLabPanelInner() {
  const [state, setState] = useState<RiderLightLabState>(() => loadRiderLightLabState());

  // 슬라이더가 바뀔 때마다 다음 프레임에 즉시 반영 + localStorage 기억(실패해도 무해).
  useEffect(() => {
    setRiderLightLabState(state);
    saveRiderLightLabState(state);
  }, [state]);

  const updateField = (key: keyof RiderLightLabState, value: number) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (name: RiderLightLabPresetName) => {
    setState({ ...RIDER_LIGHT_LAB_PRESETS[name] });
  };

  const resetToDefault = () => setState({ ...RIDER_LIGHT_LAB_DEFAULT_STATE });

  const codePaste = formatRiderLightLabCodePaste(state);

  const { copied, copyValue } = useLabCopy(codePaste);

  // 기본 접힘(LabPanelShell) — 주행 중에는 이 자리에 Quick Camera·계정 칩이 있다(지시02 §5 "지도를 과하게
  // 덮지 마라"). Chief 가 카메라 각도를 먼저 고른 뒤 펼쳐서 조명을 조절하는 흐름을 상정한다.
  return (
    <LabPanelShell prefix="light-lab" title="조명 조절판">
      <LabSliders
        prefix="light-lab"
        meta={SLIDER_META}
        ranges={RIDER_LIGHT_LAB_RANGES}
        state={state}
        onChange={updateField}
      />

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

      <LabCodeCopy prefix="light-lab" codePaste={codePaste} copied={copied} onCopy={() => void copyValue()} />
    </LabPanelShell>
  );
}

import { useState, type PointerEvent, type ReactNode, type TouchEvent } from "react";
import "./LabPanelShell.css";

/**
 * 조절판(`?camlab=1` · `?lightlab=1`) 공통 틀. 동적 import 로 분리된 두 Lab 패널만 쓴다 —
 * 운영 기본 청크에서 정적으로 import 하지 말 것.
 * 클래스 이름은 패널별 접두어(`cam-lab`·`light-lab`)를 그대로 쓴다(e2e 셀렉터 유지).
 */

/** 패널 터치가 지도(Mapbox)로 새지 않게 — 이 리포에서 반복된 함정. preventDefault 는 슬라이더
 *  드래그 자체를 막아버리므로 쓰지 않는다(stopPropagation 만으로 지도 팬은 충분히 막힌다). */
function blockMapPropagation(e: PointerEvent<HTMLElement> | TouchEvent<HTMLElement>): void {
  e.stopPropagation();
}

type ShellProps = {
  prefix: string;
  title: string;
  children: ReactNode;
};

/** 기본 접힘 — 접으면 헤더만 남는다. */
export function LabPanelShell({ prefix, title, children }: ShellProps) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div
      className={`${prefix}${collapsed ? ` ${prefix}--collapsed` : ""}`}
      onPointerDown={blockMapPropagation}
      onTouchStart={blockMapPropagation}
    >
      <div className={`${prefix}__head`}>
        <span className={`${prefix}__title`}>{title}</span>
        <button
          type="button"
          className={`${prefix}__collapse`}
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "조절판 펼치기" : "조절판 접기"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>
      {!collapsed ? children : null}
    </div>
  );
}

export type LabSliderMeta<K extends string> = {
  key: K;
  label: string;
  unit: string;
  decimals: number;
};

type SlidersProps<K extends string> = {
  prefix: string;
  meta: readonly LabSliderMeta<K>[];
  ranges: Record<K, { min: number; max: number; step: number }>;
  state: Record<K, number>;
  onChange: (key: K, value: number) => void;
};

export function LabSliders<K extends string>({ prefix, meta, ranges, state, onChange }: SlidersProps<K>) {
  return (
    <div className={`${prefix}__sliders`}>
      {meta.map(({ key, label, unit, decimals }) => {
        const range = ranges[key];
        const value = state[key];
        return (
          <label className={`${prefix}__row`} key={key}>
            <span className={`${prefix}__label`}>{label}</span>
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={value}
              onChange={(e) => onChange(key, Number(e.target.value))}
            />
            <span className={`${prefix}__value rtw-numeric`}>
              {value.toFixed(decimals)}
              {unit}
            </span>
          </label>
        );
      })}
    </div>
  );
}

type CodeCopyProps = {
  prefix: string;
  codePaste: string;
  copied: boolean;
  onCopy: () => void;
};

export function LabCodeCopy({ prefix, codePaste, copied, onCopy }: CodeCopyProps) {
  return (
    <div className={`${prefix}__copy`}>
      <pre className={`${prefix}__code`}>{codePaste}</pre>
      <button type="button" className={`${prefix}__copy-btn`} onClick={onCopy}>
        {copied ? "복사됨" : "값 복사"}
      </button>
    </div>
  );
}

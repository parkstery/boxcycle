import { useId, useRef, useState } from "react";
import {
  formatRideIntervalClock,
  getRideIntervalTotalSec,
  isRideIntervalConfig,
  matchRideIntervalPreset,
  RIDE_INTERVAL_PRESETS,
  type RideIntervalConfig,
} from "../../lib/ride/rideInterval";
import { useDialogFocus } from "../ui/useDialogFocus";
import { useEscapeKeyClose } from "../ui/useEscapeKeyClose";
import { SettingsCloseIcon } from "../ui/SettingsCloseIcon";
import "./RideIntervalSettingsSheet.css";

type Props = {
  open: boolean;
  config: RideIntervalConfig;
  restartOnApply: boolean;
  onApply: (config: RideIntervalConfig) => boolean;
  onClose: () => void;
};

type Draft = {
  highSec: string;
  lowSec: string;
  repeats: string;
  warmupSec: string;
  cooldownSec: string;
  rounds: string;
  roundRestSec: string;
};

const PRESET_OPTION_LABEL: Record<string, string> = {
  recovery: "회복형 1:2",
  balanced: "균형형 1:1",
  short: "짧은 반복 20:10",
  "10min": "10분",
  "15min": "15분",
  "20min": "20분",
  "25min": "25분",
  "30min": "30분",
};

function edgeLabel(seconds: number, none: string): string {
  if (seconds === 0) return none;
  return seconds % 60 === 0 ? `${seconds / 60}분` : `${seconds}초`;
}

function compactIntervalCopy(config: RideIntervalConfig): string {
  const parts = [
    `준비 ${edgeLabel(config.warmupSec ?? 300, "없음")}`,
    `${config.highSec}초 / ${config.lowSec}초 ×${config.repeats}`,
    `마무리 ${edgeLabel(config.cooldownSec ?? 300, "없음")}`,
  ];
  if ((config.rounds ?? 1) > 1) {
    parts.push(`${config.rounds}라운드`);
    if ((config.roundRestSec ?? 0) > 0) parts.push(`사이 ${edgeLabel(config.roundRestSec ?? 0, "없음")}`);
  }
  return parts.join(" · ");
}

const toDraft = (config: RideIntervalConfig): Draft => ({
  highSec: String(config.highSec),
  lowSec: String(config.lowSec),
  repeats: String(config.repeats),
  warmupSec: String(config.warmupSec ?? 300),
  cooldownSec: String(config.cooldownSec ?? 300),
  rounds: String(config.rounds ?? 1),
  roundRestSec: String(config.roundRestSec ?? 0),
});

function parseDraft(draft: Draft): RideIntervalConfig {
  return {
    highSec: Number(draft.highSec),
    lowSec: Number(draft.lowSec),
    repeats: Number(draft.repeats),
    warmupSec: Number(draft.warmupSec),
    cooldownSec: Number(draft.cooldownSec),
    rounds: Number(draft.rounds),
    roundRestSec: Number(draft.roundRestSec),
  };
}

function sameConfig(a: RideIntervalConfig, b: RideIntervalConfig): boolean {
  return (
    a.highSec === b.highSec &&
    a.lowSec === b.lowSec &&
    a.repeats === b.repeats &&
    (a.warmupSec ?? 300) === (b.warmupSec ?? 300) &&
    (a.cooldownSec ?? 300) === (b.cooldownSec ?? 300) &&
    (a.rounds ?? 1) === (b.rounds ?? 1) &&
    (a.roundRestSec ?? 0) === (b.roundRestSec ?? 0)
  );
}

/** 별도 편집 초안: 적용 전에는 진행 중인 운동을 바꾸지 않는다. */
function IntervalEditor({ config, restartOnApply, onApply, onClose }: Omit<Props, "open">) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => toDraft(config));
  const [mode, setMode] = useState(() => matchRideIntervalPreset({
    highSec: config.highSec,
    lowSec: config.lowSec,
    repeats: config.repeats,
    warmupSec: config.warmupSec ?? 300,
    cooldownSec: config.cooldownSec ?? 300,
    rounds: config.rounds ?? 1,
    roundRestSec: config.roundRestSec ?? 0,
  }));
  const [customOpen, setCustomOpen] = useState(() => mode === "custom");
  const highRef = useRef<HTMLInputElement>(null);
  const candidate = parseDraft(draft);
  const valid = Object.values(draft).every((raw) => raw.trim() !== "") && isRideIntervalConfig(candidate);
  const changed = valid && !sameConfig(candidate, config);
  const showRounds = mode === "short" || (valid && (candidate.rounds ?? 1) > 1) || customOpen;
  const fields = [
    { key: "warmupSec", label: "준비", unit: "초", min: 0, max: 1800, change: 30 },
    { key: "highSec", label: "고강도", unit: "초", min: 5, max: 600, change: 5 },
    { key: "lowSec", label: "저강도", unit: "초", min: 5, max: 600, change: 5 },
    { key: "repeats", label: "반복", unit: "회", min: 1, max: 30, change: 1 },
    { key: "cooldownSec", label: "마무리", unit: "초", min: 0, max: 1800, change: 30 },
  ] as const;
  const setField = (key: keyof Draft, raw: string) => {
    setDraft((previous) => ({ ...previous, [key]: raw }));
    setMode("custom");
    setCustomOpen(true);
  };
  return (
    <>
      <header className="ride-interval-settings__header">
        <h2 id={titleId}>인터벌 운동</h2>
        <select
          aria-label="운동 프리셋"
          value={mode}
          onChange={(event) => {
            const id = event.target.value;
            if (id === "custom") {
              setMode("custom");
              setCustomOpen(true);
              highRef.current?.focus();
              return;
            }
            const preset = RIDE_INTERVAL_PRESETS.find((option) => option.id === id);
            if (!preset) return;
            setMode(preset.id);
            setDraft(toDraft(preset.config));
            setCustomOpen(false);
          }}
        >
          {RIDE_INTERVAL_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{PRESET_OPTION_LABEL[preset.id]}</option>
          ))}
          <option value="custom">직접 설정</option>
        </select>
        <button type="button" className="ride-interval-settings__close" aria-label="인터벌 운동 설정 닫기" onClick={onClose}>
          <SettingsCloseIcon />
        </button>
      </header>
      <div className="ride-interval-settings__body">
        {!customOpen ? (
          <div className="ride-interval-settings__compact">
            <div className="ride-interval-settings__compact-main">
              <div className="ride-interval-settings__total"><span>총 운동 시간</span><strong aria-live="polite">{valid ? formatRideIntervalClock(getRideIntervalTotalSec(candidate)) : "—"}</strong></div>
              {valid ? <p className="ride-interval-settings__compact-copy">{compactIntervalCopy(candidate)}</p> : null}
            </div>
            <button type="button" className="ride-interval-settings__custom-toggle" onClick={() => { setCustomOpen(true); setMode("custom"); }}>
              직접 조절
            </button>
          </div>
        ) : (
          <div className="ride-interval-settings__fields" role="group" aria-label="운동 시간과 반복 수">
            {fields.map((field) => {
              const number = Number(candidate[field.key] ?? 0);
              const fieldValid = draft[field.key].trim() !== "" && Number.isInteger(number) && number >= field.min && number <= field.max;
              return (
                <div key={field.key} className={`ride-interval-settings__field ride-interval-settings__field--${field.key}`}>
                  <label htmlFor={`${titleId}-${field.key}`}>{field.label}<small>{field.unit}</small></label>
                  <div className="ride-interval-settings__stepper">
                    <button type="button" aria-label={`${field.label} ${field.change}${field.unit} 줄이기`} onClick={() => setField(field.key, String(Math.max(field.min, Math.min(field.max, (fieldValid ? number : 0) - field.change))))}>−</button>
                    <input
                      id={`${titleId}-${field.key}`}
                      ref={field.key === "highSec" ? highRef : undefined}
                      type="number"
                      inputMode="numeric"
                      min={field.min}
                      max={field.max}
                      step={1}
                      required
                      value={draft[field.key]}
                      aria-label={field.key === "repeats" ? "반복 수" : `${field.label} 시간 초`}
                      aria-invalid={!fieldValid}
                      onChange={(event) => setField(field.key, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                        event.preventDefault();
                        const delta = event.key === "ArrowUp" ? field.change : -field.change;
                        setField(field.key, String(Math.max(field.min, Math.min(field.max, (fieldValid ? number : 0) + delta))));
                      }}
                    />
                    <button type="button" aria-label={`${field.label} ${field.change}${field.unit} 늘리기`} onClick={() => setField(field.key, String(Math.max(field.min, Math.min(field.max, (fieldValid ? number : 0) + field.change))))}>+</button>
                  </div>
                </div>
              );
            })}
            {showRounds ? (
              <>
                <div className="ride-interval-settings__field ride-interval-settings__field--rounds">
                  <label htmlFor={`${titleId}-rounds`}>라운드<small>회</small></label>
                  <div className="ride-interval-settings__stepper">
                    <button type="button" aria-label="라운드 1회 줄이기" onClick={() => setField("rounds", String(Math.max(1, Number(draft.rounds || 1) - 1)))}>−</button>
                    <input id={`${titleId}-rounds`} type="number" inputMode="numeric" min={1} max={3} step={1} required value={draft.rounds} aria-label="라운드 수" onChange={(event) => setField("rounds", event.target.value)} />
                    <button type="button" aria-label="라운드 1회 늘리기" onClick={() => setField("rounds", String(Math.min(3, Number(draft.rounds || 1) + 1)))}>+</button>
                  </div>
                </div>
                <div className="ride-interval-settings__field ride-interval-settings__field--rest">
                  <label htmlFor={`${titleId}-roundRestSec`}>사이 휴식<small>초</small></label>
                  <div className="ride-interval-settings__stepper">
                    <button type="button" aria-label="사이 휴식 30초 줄이기" onClick={() => setField("roundRestSec", String(Math.max(0, Number(draft.roundRestSec || 0) - 30)))}>−</button>
                    <input id={`${titleId}-roundRestSec`} type="number" inputMode="numeric" min={0} max={1800} step={30} required value={draft.roundRestSec} aria-label="라운드 사이 휴식 시간 초" onChange={(event) => setField("roundRestSec", event.target.value)} />
                    <button type="button" aria-label="사이 휴식 30초 늘리기" onClick={() => setField("roundRestSec", String(Math.min(1800, Number(draft.roundRestSec || 0) + 30)))}>+</button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
      <footer className="ride-interval-settings__footer">
        <div className="ride-interval-settings__footer-start">
          {customOpen ? (
            <button type="button" className="ride-interval-settings__custom-toggle" onClick={() => setCustomOpen(false)}>
              접기
            </button>
          ) : null}
          {valid ? (
            <small>
              {customOpen ? <span className="ride-interval-settings__total">총 <strong aria-live="polite">{formatRideIntervalClock(getRideIntervalTotalSec(candidate))}</strong></span> : "준비·마무리 0초는 건너뜀"}
              {restartOnApply && changed ? " · 적용하면 처음부터 다시 시작해요" : ""}
            </small>
          ) : (
            <small role="alert">고·저 5~600초 · 준비·마무리 0~1800초 · 반복 1~30회 · 라운드 1~3</small>
          )}
        </div>
        <button type="button" className="ride-interval-settings__apply" disabled={!valid} onClick={() => { if (valid && onApply(candidate)) onClose(); }}>설정 적용</button>
      </footer>
    </>
  );
}

export function RideIntervalSettingsSheet(props: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(props.open, panelRef);
  useEscapeKeyClose(props.open, props.onClose);
  if (!props.open) return null;
  return (
    <div className="ride-interval-settings" role="dialog" aria-label="인터벌 운동 설정" aria-modal="true">
      <button type="button" className="ride-interval-settings__scrim" aria-label="인터벌 운동 설정 배경 닫기" onClick={props.onClose} />
      <div className="ride-interval-settings__panel" ref={panelRef}>
        <IntervalEditor config={props.config} restartOnApply={props.restartOnApply} onApply={props.onApply} onClose={props.onClose} />
      </div>
    </div>
  );
}

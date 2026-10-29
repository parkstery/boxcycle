import { useState, type CSSProperties } from "react";
import {
  SESSION_SPEED_MAX_KMH,
  SESSION_SPEED_MIN_KMH,
  clampSessionSpeedKmh,
} from "../../lib/sensor/sessionSpeedKmh";
import "./SessionSpeedControl.css";

type SessionSpeedControlProps = {
  speedKmh: number;
  onSpeedKmh: (n: number) => void;
  disabled?: boolean;
};

export function SessionSpeedControl({ speedKmh, onSpeedKmh, disabled = false }: SessionSpeedControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    onSpeedKmh(trimmed === "" ? SESSION_SPEED_MIN_KMH : clampSessionSpeedKmh(Number(trimmed)));
  };

  const step = (delta: number) => {
    onSpeedKmh(clampSessionSpeedKmh(speedKmh + delta));
  };
  const progress = (clampSessionSpeedKmh(speedKmh) - SESSION_SPEED_MIN_KMH) /
    (SESSION_SPEED_MAX_KMH - SESSION_SPEED_MIN_KMH);

  return (
    <div className="ride-speed" style={{ "--speed-progress": `${progress * 100}%` } as CSSProperties}>
      <div className="ride-speed-readout">
        <input
          type="number"
          className="ride-speed-number"
          min={SESSION_SPEED_MIN_KMH}
          max={SESSION_SPEED_MAX_KMH}
          step={1}
          inputMode="numeric"
          disabled={disabled}
          aria-label="속도 km/h"
          value={editing ? draft : speedKmh}
          onFocus={() => {
            setEditing(true);
            setDraft(String(speedKmh));
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commitDraft(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span className="ride-speed-unit">km/h</span>
        <svg className="ride-speed-gauge" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => {
            const start = (-90 + i * 15) * Math.PI / 180;
            const end = (-90 + i * 15 + 11) * Math.PI / 180;
            return <path key={i}
              d={`M ${5 + 51 * Math.cos(start)} ${58 + 51 * Math.sin(start)} A 51 51 0 0 1 ${5 + 51 * Math.cos(end)} ${58 + 51 * Math.sin(end)}`}
              stroke={progress > i / 6 ? "#2457d6" : "#dce5f5"} strokeWidth="9" />;
          })}
        </svg>
      </div>
      <div className="ride-speed-row">
        <button
          type="button"
          className="ride-speed-step"
          disabled={disabled || speedKmh <= SESSION_SPEED_MIN_KMH}
          aria-label="속도 감소"
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          type="range"
          className="ride-speed-range"
          min={SESSION_SPEED_MIN_KMH}
          max={SESSION_SPEED_MAX_KMH}
          step={1}
          disabled={disabled}
          value={speedKmh}
          aria-label="세션 속도 km/h"
          onChange={(e) => onSpeedKmh(clampSessionSpeedKmh(Number(e.target.value)))}
        />
        <button
          type="button"
          className="ride-speed-step"
          disabled={disabled || speedKmh >= SESSION_SPEED_MAX_KMH}
          aria-label="속도 증가"
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

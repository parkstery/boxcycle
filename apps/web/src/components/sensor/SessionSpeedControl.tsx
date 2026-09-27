import { useState } from "react";
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

  return (
    <div className="ride-speed">
      <div className="ride-speed-row">
        {/* 두 줄로 — 단위가 이름을 밀어내지 않게(2026-09-18 Chief) */}
        <span className="ride-speed-kicker">
          <span className="ride-speed-kicker__name">SPD</span>
          <span className="ride-speed-kicker__unit">km/h</span>
        </span>
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
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  SESSION_SPEED_MAX_KMH,
  SESSION_SPEED_MIN_KMH,
  clampSessionSpeedKmh,
} from "../../lib/sessionSpeedKmh";

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
    <div className="route-dock__speed">
      <div className="route-dock__speed-row">
        <span className="route-dock__speed-kicker">SPD(km/h)</span>
        <button
          type="button"
          className="route-dock__speed-step"
          disabled={disabled || speedKmh <= SESSION_SPEED_MIN_KMH}
          aria-label="속도 감소"
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          type="range"
          className="route-dock__speed-range"
          min={SESSION_SPEED_MIN_KMH}
          max={SESSION_SPEED_MAX_KMH}
          step={1}
          disabled={disabled}
          value={speedKmh}
          aria-label="세션 속도 km/h"
          onChange={(e) => onSpeedKmh(clampSessionSpeedKmh(Number(e.target.value)))}
        />
        <input
          type="number"
          className="route-dock__speed-number"
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
        <button
          type="button"
          className="route-dock__speed-step"
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

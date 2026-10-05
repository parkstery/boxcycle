import type { IControl, Map as MapboxMap } from "mapbox-gl";

const ARIA = "카메라 고도(해수면 기준)";
const PLACEHOLDER = "고도 —";

function readAltitudeM(map: MapboxMap): number | null {
  try {
    const opts = map.getFreeCameraOptions?.();
    const pos = opts?.position;
    if (!pos || typeof pos.toAltitude !== "function") return null;
    const alt = pos.toAltitude();
    if (typeof alt !== "number" || !Number.isFinite(alt)) return null;
    return alt;
  } catch {
    return null;
  }
}

/** 표시 문자열. 큰 값은 km, 그 외 m. 비정상이면 PLACEHOLDER. */
export function formatCameraAltitudeLabel(altM: number | null): string {
  if (altM == null) return PLACEHOLDER;
  if (altM >= 1000) {
    const km = altM / 1000;
    const text = km >= 100 ? String(Math.round(km)) : km.toFixed(1);
    return `고도 ${text} km`;
  }
  return `고도 ${altM.toFixed(1)} m`;
}

/**
 * 우하단 축척 왼쪽 — Mapbox 카메라 해수면 고도(읽기 전용).
 * React 렌더 없이 move/render 로 DOM 텍스트만 갱신.
 */
export class MapCameraAltitudeControl implements IControl {
  private _map?: MapboxMap;
  private _container?: HTMLDivElement;
  private _label?: HTMLSpanElement;
  private _lastText = "";
  private _onUpdate = (): void => {
    this._sync();
  };

  onAdd(map: MapboxMap): HTMLElement {
    this._map = map;
    const root = document.createElement("div");
    root.className = "mapboxgl-ctrl map-ctrl-camera-altitude";

    const label = document.createElement("span");
    label.className = "map-ctrl-camera-altitude__label";
    label.setAttribute("role", "status");
    label.setAttribute("aria-live", "polite");
    label.setAttribute("aria-label", ARIA);
    label.title = ARIA;
    label.textContent = PLACEHOLDER;

    root.appendChild(label);
    this._container = root;
    this._label = label;
    this._lastText = "";

    map.on("move", this._onUpdate);
    map.on("render", this._onUpdate);
    this._sync();
    return root;
  }

  onRemove(): void {
    this._map?.off("move", this._onUpdate);
    this._map?.off("render", this._onUpdate);
    this._container?.remove();
    this._map = undefined;
    this._container = undefined;
    this._label = undefined;
    this._lastText = "";
  }

  private _sync(): void {
    if (!this._map || !this._label) return;
    const text = formatCameraAltitudeLabel(readAltitudeM(this._map));
    if (text === this._lastText) return;
    this._lastText = text;
    this._label.textContent = text;
  }
}

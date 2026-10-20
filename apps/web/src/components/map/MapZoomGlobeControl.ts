import type { IControl, Map as MapboxMap } from "mapbox-gl";
import { applyMapGlobeView } from "../../lib/map/mapGlobeView";

function makeCtrlButton(
  className: string,
  title: string,
  ariaLabel: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.title = title;
  btn.setAttribute("aria-label", ariaLabel);
  const icon = document.createElement("span");
  icon.className = "mapboxgl-ctrl-icon";
  icon.setAttribute("aria-hidden", "true");
  btn.appendChild(icon);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  return btn;
}

/** Mapbox 컨트롤 그룹 — HUD에 확대/축소가 있으므로 지구 전체 보기만 둔다. */
export class MapZoomGlobeControl implements IControl {
  private _container?: HTMLDivElement;

  onAdd(map: MapboxMap): HTMLElement {
    const group = document.createElement("div");
    group.className = "mapboxgl-ctrl mapboxgl-ctrl-group";

    const globe = makeCtrlButton(
      "mapboxgl-ctrl-globe-view",
      "지구 전체 보기",
      "지구 전체 보기",
      () => applyMapGlobeView(map),
    );

    group.appendChild(globe);
    this._container = group;
    return group;
  }

  onRemove(): void {
    this._container?.remove();
    this._container = undefined;
  }
}

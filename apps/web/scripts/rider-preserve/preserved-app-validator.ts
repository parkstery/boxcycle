import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../../src/app/env";
import {
  ensureRiderPreservedLayer,
  getRiderPreservedDebugState,
  syncRiderPreservedModels,
} from "../../src/lib/riderPrototype/preservedRiderLayer";

mapboxgl.accessToken = MAPBOX_TOKEN;
const center: [number, number] = [127.035, 37.505];
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/outdoors-v12",
  center,
  zoom: 22,
  pitch: 67,
  bearing: -32,
  antialias: true,
});
map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

const status = document.querySelector<HTMLElement>("#status")!;
const phase = document.querySelector<HTMLInputElement>("#phase")!;
const phaseText = document.querySelector<HTMLElement>("#phaseText")!;
const toggle = document.querySelector<HTMLButtonElement>("#toggle")!;
let playing = true;
let phaseRev = 0;
let heading = 90;
let last = performance.now();

function update(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) phaseRev = (phaseRev + dt * 75 / 60) % 1;
  phase.value = String(Math.round(phaseRev * 360));
  phaseText.textContent = `${Math.round(phaseRev * 360)}°`;
  syncRiderPreservedModels(map, [{
    id: "live-self",
    lngLat: center,
    bearingDeg: heading,
    leanDeg: Math.sin(phaseRev * Math.PI * 2) * 3,
    phaseRev,
  }]);
  const debug = getRiderPreservedDebugState(map);
  if (debug) {
    status.dataset.state = debug.loadState;
    status.textContent = debug.loadState === "ready"
      ? "READY — 앱용 승인 자산과 DQS 리그가 지도 위에서 실행 중"
      : debug.loadState === "error"
        ? `ERROR — ${debug.loadError ?? "unknown"}`
        : "승인 자산과 DQS 리그 로드 중…";
  }
  requestAnimationFrame(update);
}

map.on("style.load", () => {
  if (!map.getSource("rtw-validator-terrain")) {
    map.addSource("rtw-validator-terrain", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: "rtw-validator-terrain", exaggeration: 1 });
  ensureRiderPreservedLayer(map);
});
map.on("load", () => requestAnimationFrame(update));

toggle.addEventListener("click", () => {
  playing = !playing;
  toggle.textContent = playing ? "일시정지" : "재생";
});
phase.addEventListener("input", () => {
  playing = false;
  toggle.textContent = "재생";
  phaseRev = Number(phase.value) / 360;
});
document.querySelector("#north")!.addEventListener("click", () => { heading = 0; });
document.querySelector("#east")!.addEventListener("click", () => { heading = 90; });

Object.assign(window, {
  __RTW_PRESERVED_APP_VALIDATOR__: {
    map,
    getState: () => ({ phaseRev, heading, playing, debug: getRiderPreservedDebugState(map) }),
  },
});

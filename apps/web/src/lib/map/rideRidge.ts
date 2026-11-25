import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";

/**
 * 지형 OFF 주행의 먼 산 능선 (2026-11-25 Chief, 4단계 「모두 적용」).
 *
 * 지형을 켜지 않고 실제 표고에서 방향별 「올려본 각」만 구해, 시야 끝에 얇은 띠 세 겹으로 세운다.
 * 카메라를 따라 움직이므로 삼각형 약 4천 개가 전부이고 지도 표면을 다시 칠하지 않는다.
 */
export const RIDE_RIDGE_LAYER = "boxcycle-ride-ridge";

const STEPS = 720;
const BANDS_M: ReadonlyArray<readonly [number, number]> = [[1200, 4000], [4000, 9000], [9000, 25000]];
/** 시야 거리에 대한 띠의 반지름 — 먼 것이 뒤. 시야 끝(1)보다 안쪽이라야 잘리지 않는다. */
const RADIUS_RATIO = [0.88, 0.925, 0.965];
/** 띠별 [아래, 위] 색 — 멀수록 하늘에 가깝다. */
const TINT: ReadonlyArray<readonly [readonly number[], readonly number[]]> = [
  [[0.62, 0.71, 0.66], [0.43, 0.55, 0.47]],
  [[0.74, 0.81, 0.84], [0.55, 0.66, 0.69]],
  [[0.82, 0.89, 0.95], [0.66, 0.76, 0.85]],
];
const EARTH_R = 6_371_000;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** 대기 굴절을 뺀 지구 곡률 보정. */
const REFRACTION = 1.16;
const EYE_M = 2;
const RAD = Math.PI / 180;

/** 요청량과 해상도의 절충 — 반경 25km 에 최대 9장(장당 약 130KB). */
const DEM_ZOOM = 10;
const DEM_CACHE = 24;

export type ElevationSampler = (lng: number, lat: number) => number;
export type RidgeProfile = Float32Array[];

/** 방향별 능선의 올려본 각(라디안). 몇 방향마다 쉬어 프레임을 막지 않는다. */
export function* computeRidgeProfile(center: readonly [number, number], elevation: ElevationSampler): Generator<void, RidgeProfile, void> {
  const [lng, lat] = center;
  const eye = elevation(lng, lat) + EYE_M;
  const out: RidgeProfile = [];
  for (const [from, to] of BANDS_M) {
    const angles = new Float32Array(STEPS);
    for (let s = 0; s < STEPS; s++) {
      const bearing = (s / STEPS) * 2 * Math.PI;
      const north = Math.cos(bearing) / EARTH_R / RAD;
      const east = Math.sin(bearing) / (EARTH_R * Math.cos(lat * RAD)) / RAD;
      let best = 0;
      for (let d = from; d <= to; d *= 1.02) {
        const rise = elevation(lng + d * east, lat + d * north) - eye - (d * d) / (2 * EARTH_R * REFRACTION);
        best = Math.max(best, rise / d);
      }
      angles[s] = Math.atan(best);
      if (s % 12 === 11) yield;
    }
    out.push(angles);
  }
  return out;
}

type DemTile = { width: number; height: number; meters: Float32Array };
const demCache = new Map<string, Promise<DemTile | null>>();

async function fetchDemTile(x: number, y: number, token: string): Promise<DemTile | null> {
  const res = await fetch(`https://api.mapbox.com/v4/mapbox.terrain-rgb/${DEM_ZOOM}/${x}/${y}.pngraw?access_token=${token}`);
  // 전부 바다인 조각은 없다 — 표고 0 으로 본다.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`terrain-rgb ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("2d context");
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
  const meters = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < meters.length; i++) {
    meters[i] = -10_000 + (d[i * 4] * 65_536 + d[i * 4 + 1] * 256 + d[i * 4 + 2]) * 0.1;
  }
  return { width: canvas.width, height: canvas.height, meters };
}

function demTile(x: number, y: number, token: string): Promise<DemTile | null> {
  const key = `${x}/${y}`;
  const known = demCache.get(key);
  if (known) return known;
  const job = fetchDemTile(x, y, token);
  demCache.set(key, job);
  job.catch(() => demCache.delete(key));
  if (demCache.size > DEM_CACHE) {
    const oldest = demCache.keys().next().value;
    if (oldest !== undefined) demCache.delete(oldest);
  }
  return job;
}

const tileX = (lng: number): number => ((lng + 180) / 360) * 2 ** DEM_ZOOM;
const tileY = (lat: number): number => ((1 - Math.asinh(Math.tan(lat * RAD)) / Math.PI) / 2) * 2 ** DEM_ZOOM;

/** 중심에서 가장 먼 띠까지 덮는 표고 조각 번호. */
export function ridgeDemTiles(center: readonly [number, number]): Array<[number, number]> {
  const reach = BANDS_M[BANDS_M.length - 1][1];
  const dLat = reach / EARTH_R / RAD;
  const dLng = dLat / Math.cos(center[1] * RAD);
  const n = 2 ** DEM_ZOOM;
  const out: Array<[number, number]> = [];
  for (let x = Math.floor(tileX(center[0] - dLng)); x <= Math.floor(tileX(center[0] + dLng)); x++) {
    for (let y = Math.floor(tileY(center[1] + dLat)); y <= Math.floor(tileY(center[1] - dLat)); y++) {
      if (y >= 0 && y < n) out.push([((x % n) + n) % n, y]);
    }
  }
  return out;
}

export async function loadRidgeElevation(center: readonly [number, number], token: string): Promise<ElevationSampler> {
  const tiles = new Map<string, DemTile | null>();
  await Promise.all(ridgeDemTiles(center).map(async ([x, y]) => {
    tiles.set(`${x}/${y}`, await demTile(x, y, token));
  }));
  const n = 2 ** DEM_ZOOM;
  return (lng, lat) => {
    const fx = tileX(lng), fy = tileY(lat);
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const tile = tiles.get(`${((tx % n) + n) % n}/${ty}`);
    if (!tile) return 0;
    // 조각 안에서 이웃 네 점을 이어 계단을 없앤다. 가장자리는 조각 안쪽 값으로 막는다.
    const px = Math.min(tile.width - 1.001, Math.max(0, (fx - tx) * tile.width - 0.5));
    const py = Math.min(tile.height - 1.001, Math.max(0, (fy - ty) * tile.height - 0.5));
    const x0 = Math.floor(px), y0 = Math.floor(py), ax = px - x0, ay = py - y0;
    const at = (x: number, y: number): number => tile.meters[y * tile.width + x];
    return (at(x0, y0) * (1 - ax) + at(x0 + 1, y0) * ax) * (1 - ay) + (at(x0, y0 + 1) * (1 - ax) + at(x0 + 1, y0 + 1) * ax) * ay;
  };
}

/** 띠 하나의 정점 — 동·남·높이(m)와 색 섞임(0 아래, 1 위). */
export function ridgeVertices(angles: Float32Array, radiusM: number): Float32Array {
  const out = new Float32Array((angles.length + 1) * 8);
  let highest = 1;
  for (const a of angles) highest = Math.max(highest, radiusM * Math.tan(a));
  for (let i = 0; i <= angles.length; i++) {
    const bearing = (i / angles.length) * 2 * Math.PI;
    const east = Math.sin(bearing) * radiusM, south = -Math.cos(bearing) * radiusM;
    const height = radiusM * Math.tan(angles[i % angles.length]);
    out.set([east, south, 0, 0, east, south, height, 0.25 + (0.75 * height) / highest], i * 8);
  }
  return out;
}

const VERTEX = "uniform mat4 u_m; attribute vec4 a; varying float v_t; void main(){ v_t=a.w; gl_Position=u_m*vec4(a.xyz,1.0); }";
const FRAGMENT = "precision mediump float; uniform vec3 u_lo; uniform vec3 u_hi; varying float v_t; void main(){ gl_FragColor=vec4(mix(u_lo,u_hi,smoothstep(0.0,1.0,v_t)),1.0); }";

/** 능선 띠 레이어. 카메라 위치를 중심으로 그려 시차 없이 먼 산처럼 보인다. */
export function createRidgeLayer(map: MapboxMap, viewDistanceM: number, getProfile: () => RidgeProfile | null): CustomLayerInterface {
  let program: WebGLProgram | null = null;
  let attribute = -1;
  let matrixAt: WebGLUniformLocation | null = null, lowAt: WebGLUniformLocation | null = null, highAt: WebGLUniformLocation | null = null;
  let buffers: WebGLBuffer[] = [];
  let filled: RidgeProfile | null = null;
  const shader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
    const s = gl.createShader(type);
    if (!s) throw new Error("ridge shader");
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  return {
    id: RIDE_RIDGE_LAYER, type: "custom", renderingMode: "3d", slot: "middle",
    onAdd(_map, gl) {
      const p = gl.createProgram();
      if (!p) return;
      gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn("[rideRidge] 능선을 그리지 않습니다.", gl.getProgramInfoLog(p));
        return;
      }
      program = p;
      attribute = gl.getAttribLocation(p, "a");
      matrixAt = gl.getUniformLocation(p, "u_m");
      lowAt = gl.getUniformLocation(p, "u_lo");
      highAt = gl.getUniformLocation(p, "u_hi");
      buffers = RADIUS_RATIO.map(() => gl.createBuffer()).filter((b): b is WebGLBuffer => b != null);
      filled = null;
    },
    onRemove(_map, gl) {
      for (const b of buffers) gl.deleteBuffer(b);
      if (program) gl.deleteProgram(program);
      buffers = [];
      program = null;
    },
    render(gl, matrix) {
      const profile = getProfile();
      const camera = map.getFreeCameraOptions().position;
      if (!profile || !program || !camera || buffers.length !== RADIUS_RATIO.length) return;
      if (filled !== profile) {
        profile.forEach((angles, k) => {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffers[k]);
          gl.bufferData(gl.ARRAY_BUFFER, ridgeVertices(angles, viewDistanceM * RADIUS_RATIO[k]), gl.STATIC_DRAW);
        });
        filled = profile;
      }
      // 미터 → Mercator, 원점 = 카메라 발밑. 배정밀도로 합쳐 떨림을 막는다.
      const scale = 1 / (EARTH_CIRCUMFERENCE_M * Math.cos(map.getCenter().lat * RAD));
      const m = new Float32Array(16);
      for (let i = 0; i < 12; i++) m[i] = matrix[i] * scale;
      for (let r = 0; r < 4; r++) m[12 + r] = matrix[r] * camera.x + matrix[4 + r] * camera.y + matrix[12 + r];
      gl.useProgram(program);
      gl.uniformMatrix4fv(matrixAt, false, m);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.disable(gl.STENCIL_TEST);
      gl.bindVertexArray(null);
      gl.enableVertexAttribArray(attribute);
      for (let k = RADIUS_RATIO.length - 1; k >= 0; k--) {
        gl.uniform3fv(lowAt, TINT[k][0]);
        gl.uniform3fv(highAt, TINT[k][1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[k]);
        gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, 16, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (STEPS + 1) * 2);
      }
      gl.disableVertexAttribArray(attribute);
    },
  };
}

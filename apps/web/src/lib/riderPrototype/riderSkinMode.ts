/**
 * 다리 DQS 스키닝 실행 위치 (`?skin=gpu|cpu`, 운영 포함).
 *
 * - 요청값: `?skin=gpu` 면 gpu, 그 외(없음·`cpu`·오타)는 전부 `cpu`. 기본은 cpu.
 * - 실제값(effective): 요청이 gpu 여도 rider14 리그가 아니거나, 정점 유니폼·highp
 *   같은 GPU 조건이 안 되면 cpu 로 내려간다. 셰이더 컴파일 실패도 레이어가
 *   `setSkinMode("cpu")` 로 내린다. perflab 패널·복사 JSON 은 이 실제값을 본다.
 */

/** CPU 정점 루프(지금까지) / 정점 셰이더(G1). */
export type RiderSkinMode = "cpu" | "gpu";

/** 쿼리 문자열만 보고 요청값을 정한다(순수 함수 — 시험용). */
export function readRiderSkinModeSearch(search: string): RiderSkinMode {
  try {
    return new URLSearchParams(search).get("skin") === "gpu" ? "gpu" : "cpu";
  } catch {
    return "cpu";
  }
}

function currentSearch(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.location?.search ?? "";
  } catch {
    return "";
  }
}

/** 페이지 요청값. Node(시험)에서는 항상 `cpu` — GPU 경로는 rig 옵션으로 연다. */
export function readRequestedRiderSkinMode(): RiderSkinMode {
  return readRiderSkinModeSearch(currentSearch());
}

let capableCache: boolean | undefined;

/** 시험이 GPU 판정 캐시를 비운다. */
export function resetRiderSkinModeForTests(): void {
  capableCache = undefined;
  effective = "cpu";
}

/**
 * 정점 셰이더 스키닝이 도는 최소 조건.
 * 다리 DQ 팔레트(`uSkinDQ[8]` = vec4 8개) + three 기본 유니폼이 들어가야 하므로
 * 정점 유니폼 벡터가 스펙 하한(128) 이상, 정점 highp 정밀도가 실측치(23 bit)
 * 이상일 때만 true. Node(시험)에서는 판정할 컨텍스트가 없으므로 true.
 */
export function isGpuSkinCapable(): boolean {
  if (capableCache !== undefined) return capableCache;
  capableCache = probeGpuSkinCapability();
  return capableCache;
}

function probeGpuSkinCapability(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    let vectors = 0;
    try {
      const raw = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
      if (typeof raw === "number" && Number.isFinite(raw)) vectors = raw;
    } catch {
      return false;
    }
    let precision = 0;
    try {
      const fmt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      if (fmt) precision = fmt.precision;
    } catch {
      return false;
    }
    try {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      /* 임시 컨텍스트 정리는 실패해도 된다 */
    }
    return vectors >= 128 && precision >= 23;
  } catch {
    return false;
  }
}

let effective: RiderSkinMode = "cpu";

/** 리그·레이어가 실제 실행 위치를 기록한다. */
export function noteEffectiveRiderSkinMode(mode: RiderSkinMode): void {
  effective = mode;
}

/** perflab 패널·복사 JSON 이 읽는 실제값. 리그 생성 전에는 `cpu`(기본). */
export function readEffectiveRiderSkinMode(): RiderSkinMode {
  return effective;
}

import {
  getDistanceMeters,
  interpolatePoint,
  lineStringLengthMeters,
  type LineStringGeometry,
  type LngLat,
} from "../geo/geo";
import { decimateLineStringVertices } from "../geo/geoDecimate";

/**
 * Conquest(정복) 레이어 — 주행 경로 → 도로 셀("내 도로망") 변환.
 * 설계 SoT: document/reference/architecture/260703-Conquest-정복-레이어-설계.md §3~§4.
 *
 * 2026-07-03 도로 전환(PM 결정): 정복 단위를 z16 타일(면)에서 **z20 도로 셀(~30m, 선)**로 교체.
 * 사이클리스트의 자산은 면적이 아니라 "달린 도로"다. 경로는 Mapbox Directions 산출이라
 * 태생부터 도로에 맵매칭돼 있어 셀 방식이 정확하게 성립한다.
 *
 * ⚠️ 사용자 노출 용어는 「도로」(예: 새 도로 +2.4km) — "z20"·"셀"은 내부 용어(UI 비노출).
 * ⚠️ CONQUEST_CELL_ZOOM 은 축적 데이터의 단위 — 확정 후 변경 불가에 준함(OQ-1).
 */
export const CONQUEST_CELL_ZOOM = 20;
/** 사용자 정복 저장 청크 단위(z12 = z20 셀 65,536개 커버, 서울 위도 ~7.8km) */
export const CONQUEST_CHUNK_ZOOM = 12;
export const CONQUEST_PAYLOAD_VERSION = 2;

/** 셀 내 이동 거리 집계용 경로 보간 보폭(m) */
const SAMPLE_STEP_METERS = 12;
/** ride 문서 크기 보호 — z20 기준 약 240km 상당 */
const MAX_PAYLOAD_CELLS = 8000;
/** 궤적(trace) 단순화 상한 정점 수 */
const TRACE_MAX_VERTICES = 300;

/**
 * 셀 집계와 임시 신규 도로 geometry가 공유하는 경로 조각.
 *
 * `cellId`는 기존 Claim 셀 판정과 같은 방식으로 조각의 중점에서 계산한다.
 * `start`/`end`는 `fromMeters..traveledMeters` 구간에 맞춰 잘린 실제 geometry이고,
 * `meters`는 기존 `buildConquestCellsFromRoute`가 셀에 더하던 유효 길이다.
 */
export type ConquestRoutePiece = {
  cellId: string;
  start: LngLat;
  end: LngLat;
  meters: number;
  startMeters: number;
  endMeters: number;
};

export type ConquestPayloadCell = {
  /** `z_x_y` (z=CONQUEST_CELL_ZOOM) */
  id: string;
  /** 이 주행에서 셀 내부 누적 이동 거리(m, 정수) — 예산 소진 계산 재료 */
  m: number;
};

/** 서버가 예산·소유 판정 후 신규 geometry를 복원할 수 있는 순서 보존 조각. */
/** ride 문서에 싣는 정복 페이로드 — CF `conquestOnRideCreated` 가 한도 적용 후 집계 */
export type ConquestRidePayload = {
  v: number;
  z: number;
  /** 경로 진행 순서(첫 진입 기준) — CF 는 앞에서부터 예산 소진까지 인정 */
  cells: ConquestPayloadCell[];
  /**
   * 실제 진행 구간의 단순화 궤적 — **평탄 배열** [lng0,lat0,lng1,lat1,...].
   * ⚠️ Firestore 는 중첩 배열([[lng,lat],...])을 저장할 수 없다 — 반드시 평탄화.
   */
  path: number[];
  /** 케이던스>0 누적 초. null = 센서 미연결(T0 no-sensor) */
  pedalSec: number | null;
};

export function lngLatToTileXY(
  lng: number,
  lat: number,
  zoom: number,
): { x: number; y: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const n = 2 ** zoom;
  const xRaw = Math.floor(((lng + 180) / 360) * n);
  const latRad = (clampedLat * Math.PI) / 180;
  const yRaw = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return {
    x: Math.max(0, Math.min(n - 1, xRaw)),
    y: Math.max(0, Math.min(n - 1, yRaw)),
  };
}

export function conquestCellIdAt(lngLat: LngLat): string {
  const { x, y } = lngLatToTileXY(lngLat[0], lngLat[1], CONQUEST_CELL_ZOOM);
  return `${CONQUEST_CELL_ZOOM}_${x}_${y}`;
}

/*
 * (2026-09-28) `conquestCellIdsAround`(셀 + 8방 이웃) 를 지웠다. 유일한 소비자가 핀 팝업의
 * 「🏴 내가 달린 도로」 한 줄이었고 그 줄을 제거했다(Chief). 클릭 지점의 셀 보유 판정이
 * 다시 필요해지면 여기서 되살린다.
 */

/** `20_x_y` → 상위 z12 청크 문서 ID(`12_x_y`). 형식 불일치 시 null. */
export function chunkIdOfConquestCellId(cellId: string): string | null {
  const parts = cellId.split("_");
  if (parts.length !== 3) return null;
  const z = Number(parts[0]);
  const x = Number(parts[1]);
  const y = Number(parts[2]);
  if (z !== CONQUEST_CELL_ZOOM || !Number.isInteger(x) || !Number.isInteger(y)) return null;
  const shift = CONQUEST_CELL_ZOOM - CONQUEST_CHUNK_ZOOM;
  return `${CONQUEST_CHUNK_ZOOM}_${x >> shift}_${y >> shift}`;
}

/**
 * `buildConquestCellsFromRoute`와 동일한 12m 샘플링 규칙으로 경로를 조각낸다.
 *
 * 셀 ID는 전체 샘플 조각의 중점으로 정한다. 따라서 `fromMeters` 경계에서 조각이
 * 잘리더라도 기존 Claim 셀 집계와 의미가 달라지지 않는다.
 */
export function buildConquestRoutePieces(
  geometry: LineStringGeometry,
  traveledMeters: number,
  fromMeters = 0,
): ConquestRoutePiece[] {
  const coords = geometry.coordinates as LngLat[];
  if (coords.length < 2) return [];
  const total = Math.min(Math.max(0, traveledMeters), lineStringLengthMeters(geometry));
  const from = Math.min(Math.max(0, fromMeters), total);
  if (total - from <= 0) return [];

  const out: ConquestRoutePiece[] = [];
  let walked = 0;
  outer: for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = getDistanceMeters(a, b);
    if (segLen <= 0) continue;
    const pieces = Math.max(1, Math.ceil(segLen / SAMPLE_STEP_METERS));
    for (let p = 0; p < pieces; p += 1) {
      const t0 = p / pieces;
      const t1 = (p + 1) / pieces;
      const pieceLen = segLen / pieces;
      const pieceStart = walked;
      const pieceEnd = walked + pieceLen;
      const activeStart = Math.max(pieceStart, from);
      const activeEnd = Math.min(pieceEnd, total);
      const effLen = activeEnd - activeStart;
      if (effLen > 0) {
        // 기존 셀 집계와 동일하게, 셀은 잘리기 전 샘플 조각의 중점으로 정한다.
        const tm = (t0 + t1) / 2;
        const mid: LngLat = interpolatePoint(a, b, tm);
        const startRatio = t0 + (activeStart - pieceStart) / segLen;
        const endRatio = t0 + (activeEnd - pieceStart) / segLen;
        out.push({
          cellId: conquestCellIdAt(mid),
          start: interpolatePoint(a, b, startRatio),
          end: interpolatePoint(a, b, endRatio),
          meters: effLen,
          startMeters: activeStart,
          endMeters: activeEnd,
        });
      }
      walked = pieceEnd;
      if (walked >= total) break outer;
    }
  }
  return out;
}

/**
 * 주행 경로의 실제 진행 구간(fromMeters..traveledMeters)을 도로 셀 목록으로 변환.
 * 단일 패스(세그먼트 세분) — 첫 진입 순서 유지, 셀별 내부 이동 거리 합산.
 * `fromMeters` 는 이어 달리기(§9.5.5 단위7)의 세션 시작 오프셋 — 이번 세션에 실제로
 * 달린 구간만 Claim 페이로드에 싣기 위한 하한(운동·Claim 인정 분리 원칙).
 */
export function buildConquestCellsFromRoute(
  geometry: LineStringGeometry,
  traveledMeters: number,
  fromMeters = 0,
): ConquestPayloadCell[] {
  const metersByCell = new Map<string, number>();
  const order: string[] = [];

  const addMeters = (cellId: string, meters: number) => {
    const prev = metersByCell.get(cellId);
    if (prev === undefined) {
      if (order.length >= MAX_PAYLOAD_CELLS) return;
      order.push(cellId);
      metersByCell.set(cellId, meters);
    } else {
      metersByCell.set(cellId, prev + meters);
    }
  };

  for (const piece of buildConquestRoutePieces(geometry, traveledMeters, fromMeters)) {
    addMeters(piece.cellId, piece.meters);
  }

  return order.map((id) => ({ id, m: Math.round(metersByCell.get(id) ?? 0) }));
}

/**
 * 진행 구간(fromMeters..traveledMeters) 궤적 — 정점 절단·소수 5자리 반올림(저장용).
 * 반환은 **평탄 배열** [lng0,lat0,lng1,lat1,...] (Firestore 중첩 배열 금지).
 * `fromMeters` 는 이어 달리기 세션 시작 오프셋 — 이번 세션 실주행 궤적만 남긴다.
 */
export function buildTraveledPathForTrace(
  geometry: LineStringGeometry,
  traveledMeters: number,
  fromMeters = 0,
): number[] {
  const coords = geometry.coordinates as LngLat[];
  if (coords.length < 2) return [];
  const total = Math.min(Math.max(0, traveledMeters), lineStringLengthMeters(geometry));
  const from = Math.min(Math.max(0, fromMeters), total);
  if (total - from <= 0) return [];

  const out: LngLat[] = [];
  let walked = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = getDistanceMeters(a, b);
    if (segLen <= 0) continue;
    const segEnd = walked + segLen;
    if (segEnd <= from) {
      walked = segEnd;
      continue;
    }
    if (out.length === 0) {
      // 시작점 — from 지점을 세그먼트 위에 보간
      const t0 = Math.max(0, (from - walked) / segLen);
      out.push([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0]);
    }
    if (segEnd >= total) {
      const t = (total - walked) / segLen;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      break;
    }
    walked = segEnd;
    out.push(b);
  }
  if (out.length < 2) return [];

  const decimated = decimateLineStringVertices(
    { type: "LineString", coordinates: out },
    TRACE_MAX_VERTICES,
  );
  const flat: number[] = [];
  for (const [lng, lat] of decimated.coordinates as LngLat[]) {
    flat.push(Number(lng.toFixed(5)), Number(lat.toFixed(5)));
  }
  return flat;
}

/**
 * 지도 레이어 순서의 **단일 출처** (Phase 5 D4).
 *
 * 왜 있는가 — 순서를 세우는 코드가 7개 파일에 흩어져 있고, 그 중 **다섯 곳이 각자
 * 「내가 최상단」이라고 주장**한다(`moveLayer(id)` 를 beforeId 없이 호출 = top 으로 이동).
 *
 *   moveActivityWorldLayersToTop      활동 8개를 top 으로
 *   red dot setData                   pulse dots 를 top 으로 (갱신마다)
 *   heat dot setData                  heat dots 를 top 으로
 *   moveGlobalLivePresenceLayersToTop presence 3개를 top 으로
 *   preservedRiderLayer               라이더가 스스로 top 으로
 *
 * **마지막에 실행된 쪽이 이긴다.** 그래서 주행 중 최상단이 라이더가 아니라 activity
 * pulse dots 였다(구조 감사 P4 실측). 호출 순서에 순서가 달려 있으면 그것은 정책이 아니다.
 *
 * 여기서는 **랭크를 선언**하고, 각 호출부는 `moveLayerByRank` 로 **자기 랭크 자리**에
 * 들어간다. 누가 먼저 돌든 결과가 같다.
 *
 * ── 판정을 렌더가 아니라 정책으로 내린 이유 ─────────────────────────
 * 헤드리스 e2e 에서는 preserved 라이더 레이어가 **생성되지 않는다**(구조 감사 P3).
 * 「라이더가 경로선보다 위」를 화면으로 확인하려다 3번 시도 끝에 보류했다. 그래서 순서를
 * **순수 함수로 내려** 시험이 렌더 없이 판정한다. 라이더가 실제로 그려지는지는 여전히
 * Chief 실기 몫이며, 그 사실을 여기 적어 둔다.
 *
 * ⚠️ layer id 문자열을 바꾸면 소스·레이어 참조가 어긋나 **오버레이가 조용히 사라진다**
 * (구조 감사 R6). `boxcycle-lobby-spectator-*` 는 퇴역 용어지만 그대로 둔다 — rename 은
 * Ontology §0.1 에 따라 실기 확인을 낀 별건이다.
 */

/** 낮은 랭크가 아래(먼저 그려짐), 높은 랭크가 위. 값 사이에 틈을 두어 끼워넣기를 허용한다. */
export const RTW_LAYER_RANK = {
  /** 3D 건물 — 모든 오버레이 아래 */
  "boxcycle-3d-buildings": 100,

  /** 주행 가능 도로 커버리지(OSRM) — 경로선 아래 */
  "boxcycle-routable-roads-overlay": 200,

  /** 월드 활동 흔적(선) — 지도 읽기의 배경 */
  "boxcycle-activity-heat-routes-glow": 300,
  "boxcycle-activity-heat-routes-line": 310,
  "boxcycle-activity-pulse-routes-glow": 320,
  "boxcycle-activity-pulse-routes-line": 330,

  /** 내 도로망(누적)·이번 주행 — 단계에 따라 경로선 위/아래로 뒤집힌다(§조건부) */
  "boxcycle-conquest-traces-halo": 400,
  "boxcycle-conquest-traces-line": 410,
  "boxcycle-conquest-live-glow": 420,
  "boxcycle-conquest-live-line": 430,

  /** 경로선 — 주행의 주인공 선 */
  route: 500,

  /** Trailhead 관전 오버레이(경로·점·라벨) */
  "boxcycle-lobby-spectator-routes-glow": 600,
  "boxcycle-lobby-spectator-routes-line": 610,
  "boxcycle-lobby-spectator-dots-glow": 620,
  "boxcycle-lobby-spectator-dots-circle": 630,
  "boxcycle-lobby-spectator-dots-label": 640,

  /** 월드 활동 점 — 선보다 위, 사람보다 아래 */
  "boxcycle-activity-heat-dots-glow": 700,
  "boxcycle-activity-heat-dots-layer": 710,
  "boxcycle-activity-pulse-dots-glow": 720,
  "boxcycle-activity-pulse-dots-layer": 730,

  /** 전역 라이브 presence(다른 주행자 점·라벨) */
  "boxcycle-global-live-presence-glow": 800,
  "boxcycle-global-live-presence-dot": 810,
  "boxcycle-global-live-presence-label": 820,

  /**
   * 라이더 — **사람이 최상단**이다. 내 위치를 점·흔적이 덮으면 주행을 읽을 수 없다.
   * 두 모드는 동시에 존재하지 않는다(`preserved` 또는 `glb`).
   */
  "boxcycle-rider-prototype-layer": 900,
  "boxcycle-rider-preserved-layer": 910,

  /** DEV 진단 — 무엇이든 덮어도 되는 최상단 */
  "debug-world-light-circle": 1000,
} as const;

export type RtwLayerId = keyof typeof RTW_LAYER_RANK;

/** 낮은 → 높은 순서로 정렬된 id 목록. */
export const RTW_LAYER_ORDER: RtwLayerId[] = (
  Object.keys(RTW_LAYER_RANK) as RtwLayerId[]
).sort((a, b) => RTW_LAYER_RANK[a] - RTW_LAYER_RANK[b]);

export function isRtwLayerId(id: string): id is RtwLayerId {
  return Object.prototype.hasOwnProperty.call(RTW_LAYER_RANK, id);
}

export function rtwLayerRank(id: string): number | null {
  return isRtwLayerId(id) ? RTW_LAYER_RANK[id] : null;
}

/**
 * 조건부 — 내 도로망(누적)이 경로선 위로 가는가.
 *
 * 2026-09-16 결정: 주행 중에는 궤적이 경로선 **위**(0.95), 경로 설정·확인 중에는
 * 경로선이 **위**(내 도로망은 0.6 + 폭 하한으로 배경). 정적 랭크로는 표현할 수 없다 —
 * 순서 자체가 단계의 함수다.
 */
export function conquestRankOffset(tracesAboveRoute: boolean): number {
  // 경로선(500) 위로 올릴 때는 관전 오버레이(600) 아래에 머물러야 한다.
  return tracesAboveRoute ? 150 : 0;
}

/** 단계를 반영한 실효 랭크. */
export function effectiveRank(id: string, tracesAboveRoute: boolean): number | null {
  const base = rtwLayerRank(id);
  if (base === null) return null;
  const isConquest = id.startsWith("boxcycle-conquest-");
  return isConquest ? base + conquestRankOffset(tracesAboveRoute) : base;
}

/** 지도에서 레이어 id 목록을 읽는다. 스타일 전환 중에는 빈 배열. */
type MapLike = {
  getStyle: () => { layers?: { id: string }[] } | undefined;
  getLayer: (id: string) => unknown;
  moveLayer: (id: string, beforeId?: string) => void;
};

/**
 * `id` 가 들어갈 자리 바로 위의 레이어 id.
 *
 * 없으면 `undefined` — Mapbox 에서 그것은 「맨 위」를 뜻한다. 즉 **자기보다 높은 랭크가
 * 실제로 없을 때만** 맨 위로 간다. 종전의 무조건 top 이동과 다른 점이 이것이다.
 */
export function resolveBeforeIdByRank(
  map: MapLike,
  id: string,
  tracesAboveRoute = false,
): string | undefined {
  const myRank = effectiveRank(id, tracesAboveRoute);
  if (myRank === null) return undefined;
  let live: { id: string }[];
  try {
    live = map.getStyle()?.layers ?? [];
  } catch {
    return undefined;
  }
  /*
   * 「내 랭크보다 큰 것 중 **가장 작은** 것」을 고른다.
   *
   * 살아 있는 순서에서 처음 만난 상위 레이어를 쓰면 안 된다 — 현재 순서가 이미 뒤섞여
   * 있으면(그게 바로 고치려는 상태다) 엉뚱한 자리에 들어가고, 여러 번 돌려야 수렴한다.
   * 랭크로 목표를 고르면 **현재 순서와 무관하게 한 번에 제자리**로 간다.
   */
  let bestId: string | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const layer of live) {
    if (layer.id === id) continue;
    const r = effectiveRank(layer.id, tracesAboveRoute);
    if (r === null || r <= myRank) continue;
    if (r < bestRank) {
      bestRank = r;
      bestId = layer.id;
    }
  }
  return bestId;
}

/**
 * 자기 랭크 자리로 한 칸 옮긴다.
 *
 * ⚠️ **한 번의 호출로 전체가 정렬되지는 않는다.** 기준으로 삼는 상위 레이어 자체가
 * 제자리에 없으면 엉뚱한 자리에 들어간다(계약 시험이 이것을 잡았다). 한 레이어를
 * 되돌리는 **교정용**이며, 여러 레이어의 순서를 세울 때는 `applyRtwLayerOrder` 를 쓴다.
 *
 * 스타일 전환 중 `moveLayer` 는 던질 수 있으므로 삼킨다(종전 호출부와 같은 방어).
 */
export function moveLayerByRank(map: MapLike, id: string, tracesAboveRoute = false): void {
  if (!map.getLayer(id)) return;
  try {
    map.moveLayer(id, resolveBeforeIdByRank(map, id, tracesAboveRoute));
  } catch {
    /* style switching */
  }
}

/**
 * 주어진 레이어들의 **상대 순서를 랭크대로 세운다.** 호출 순서와 무관하게 결과가 같다.
 *
 * 인접 쌍만 교정하므로 **목록 밖 레이어와의 위치 관계는 건드리지 않는다** — 베이스맵
 * 라벨·건물 위아래로 블록을 통째로 옮기면 지도 판독이 달라진다. 「전부 top 으로」가
 * 편하지만 그것이 바로 P4 를 만든 방식이다.
 */
export function applyRtwLayerOrder(
  map: MapLike,
  ids: readonly string[],
  tracesAboveRoute = false,
): void {
  let present: string[];
  try {
    const live = (map.getStyle()?.layers ?? []).map((l) => l.id);
    present = ids.filter((id) => live.includes(id));
  } catch {
    return;
  }
  const want = [...present].sort(
    (a, b) => (effectiveRank(a, tracesAboveRoute) ?? 0) - (effectiveRank(b, tracesAboveRoute) ?? 0),
  );
  // 인접 쌍 교정을 반복한다. 최대 패스 수는 목록 길이 — 유한하고 결정적이다.
  for (let pass = 0; pass < want.length; pass += 1) {
    let moved = false;
    let live: string[];
    try {
      live = (map.getStyle()?.layers ?? []).map((l) => l.id);
    } catch {
      return;
    }
    for (let i = 0; i < want.length - 1; i += 1) {
      const lower = want[i];
      const upper = want[i + 1];
      if (live.indexOf(lower) > live.indexOf(upper)) {
        try {
          map.moveLayer(lower, upper);
          moved = true;
        } catch {
          return;
        }
        break;
      }
    }
    if (!moved) return;
  }
}

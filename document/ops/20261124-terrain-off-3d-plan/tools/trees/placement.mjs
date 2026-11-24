// 나무 배치 계산(순수 함수). 입력은 지역 미터 좌표(동 +x, 북 +y), 원점 기준 세계 격자라 조각 경계에서 어긋나지 않는다.
export const ROAD_WIDTH_M = { motorway: 16, motorway_link: 8, trunk: 14, trunk_link: 8, primary: 12, primary_link: 7, secondary: 10, secondary_link: 6, tertiary: 8, tertiary_link: 6, street: 6.5, street_limited: 6, service: 4, track: 3, path: 2.8, pedestrian: 4 };
const ROADSIDE = new Set(['primary', 'secondary', 'tertiary', 'street', 'street_limited', 'pedestrian', 'path']);
/** 면 종류별 나무 밀도(그루/m²). */
export const GREEN_DENSITY = { wood: 1 / 45, scrub: 1 / 160, park: 1 / 170, cemetery: 1 / 260, grass: 1 / 420 };

export function hash(a, b, salt = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l)) : 0;
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
const bbox = (pts) => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);

/** 격자 색인 — 후보마다 모든 도로·건물을 돌지 않게. */
class Grid {
  constructor(size) { this.size = size; this.m = new Map(); }
  add(b, item) { for (let x = Math.floor(b[0] / this.size); x <= Math.floor(b[2] / this.size); x++) for (let y = Math.floor(b[1] / this.size); y <= Math.floor(b[3] / this.size); y++) { const k = `${x},${y}`; (this.m.get(k) ?? this.m.set(k, []).get(k)).push(item); } }
  at(x, y) { return this.m.get(`${Math.floor(x / this.size)},${Math.floor(y / this.size)}`) ?? []; }
}

/**
 * data: { roads:[{cls,structure,pts}], greens:[{cls,rings}], buildings:[rings], water:[rings], realTrees:[[x,y]] }
 * opt: { route:pts, radius, max, routeSpacing, roadDensity, greenScale, shrubs, worldOffset:[x,y] }
 */
export function placeTrees(data, center, opt) {
  const { route = [], radius = 450, max = 1500, routeSpacing = 13, roadDensity = 1, greenScale = 1, shrubs = false, worldOffset = [0, 0] } = opt;
  const roads = new Grid(40), solid = new Grid(40), greens = new Grid(40), real = new Grid(20);
  for (const r of data.roads) { const w = ROAD_WIDTH_M[r.cls]; if (!w) continue; for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i]; const bb = bbox([a, b]); roads.add([bb[0] - 12, bb[1] - 12, bb[2] + 12, bb[3] + 12], { a, b, w, r }); } }
  for (const rings of [...data.buildings, ...data.water]) solid.add(bbox(rings[0]).map((v, i) => v + (i < 2 ? -2 : 2)), rings);
  for (const g of data.greens) greens.add(bbox(g.rings[0]), g);
  for (const p of data.realTrees) real.add([p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6], p);
  const inside = (x, y, rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h));
  const routeSegs = route.slice(1).map((b, i) => [route[i], b]);
  const blocked = (x, y, gap) => {
    for (const s of roads.at(x, y)) if (segDist(x, y, s.a, s.b) < s.w / 2 + gap) return true;
    for (const rings of solid.at(x, y)) if (inside(x, y, rings)) return true;
    for (const p of real.at(x, y)) if (Math.hypot(p[0] - x, p[1] - y) < 6) return true;
    for (const [a, b] of routeSegs) if (segDist(x, y, a, b) < 3.4) return true;
    return false;
  };
  const out = [];
  const add = (x, y, kind, h) => { if (Math.hypot(x - center[0], y - center[1]) <= radius) out.push({ x, y, kind, scale: 0.82 + h * 0.4, rot: h * 360, h }); };

  // 1) 경로 가로수: 양쪽 규칙 간격 + 약간의 흔들림
  let carry = 0, idx = 0;
  for (const [a, b] of routeSegs) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!len) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    for (let d = routeSpacing - carry; d <= len; d += routeSpacing, idx++) {
      for (const side of [-1, 1]) {
        const h = hash(idx, side, 7), px = a[0] + ux * (d + (h - 0.5) * 3), py = a[1] + uy * (d + (h - 0.5) * 3);
        let w = 4; for (const s of roads.at(px, py)) if (segDist(px, py, s.a, s.b) < 4) w = Math.max(w, s.w);
        const off = w / 2 + 2.6 + hash(idx, side, 9) * 0.8, x = px - uy * off * side, y = py + ux * off * side;
        if (!blocked(x, y, 1.1)) add(x, y, 'street', hash(idx, side, 11));
        if (shrubs) for (const k of [0.33, 0.66]) { const sx = px + ux * routeSpacing * k - uy * (off + 0.3) * side, sy = py + uy * routeSpacing * k + ux * (off + 0.3) * side; if (!blocked(sx, sy, 0.6)) add(sx, sy, 'shrub', hash(idx, side, 13 + k * 10)); }
      }
    }
    carry = (carry + len) % routeSpacing;
  }
  // 2) 도로변·3) 숲·공원: 세계 격자 후보
  const cell = 6.5;
  const cx0 = Math.floor((center[0] - radius + worldOffset[0]) / cell), cx1 = Math.ceil((center[0] + radius + worldOffset[0]) / cell);
  const cy0 = Math.floor((center[1] - radius + worldOffset[1]) / cell), cy1 = Math.ceil((center[1] + radius + worldOffset[1]) / cell);
  for (let gx = cx0; gx <= cx1; gx++) for (let gy = cy0; gy <= cy1; gy++) {
    const x = (gx + 0.15 + hash(gx, gy, 1) * 0.7) * cell - worldOffset[0], y = (gy + 0.15 + hash(gx, gy, 2) * 0.7) * cell - worldOffset[1];
    if (Math.hypot(x - center[0], y - center[1]) > radius) continue;
    const roll = hash(gx, gy, 3);
    let p = 0, kind = 'green';
    for (const g of greens.at(x, y)) { const dens = GREEN_DENSITY[g.cls]; if (dens && dens > p && inside(x, y, g.rings)) { p = dens; kind = g.cls === 'wood' ? 'wood' : g.cls === 'scrub' ? 'scrub' : 'green'; } }
    p *= cell * cell * greenScale;
    if (roll >= p) {
      let near = false;
      if (roadDensity > 0) for (const s of roads.at(x, y)) { if (s.r.structure !== 'none' || !ROADSIDE.has(s.r.cls)) continue; const d = segDist(x, y, s.a, s.b) - s.w / 2; if (d > 1.6 && d < 4.2) near = true; }
      if (!near || roll >= 0.42 * roadDensity) continue;
      kind = 'street';
    }
    if (!blocked(x, y, kind === 'street' ? 1.4 : 2.2)) add(x, y, kind === 'scrub' ? 'shrub' : kind, hash(gx, gy, 4));
  }
  out.sort((a, b) => Math.hypot(a.x - center[0], a.y - center[1]) - Math.hypot(b.x - center[0], b.y - center[1]));
  return out.slice(0, max);
}

/** 나무 종류 고르기: style 'round' | 'facet'. */
export function speciesFor(tree, style) {
  if (tree.kind === 'shrub') return 'shrub';
  const r = tree.h;
  if (tree.kind === 'street') return r < 0.72 ? `${style}-broad` : `${style}-tall`;
  if (tree.kind === 'wood') return r < 0.5 ? `${style}-broad` : r < 0.85 ? `${style}-conifer` : `${style}-tall`;
  return r < 0.7 ? `${style}-broad` : r < 0.85 ? `${style}-tall` : `${style}-conifer`;
}

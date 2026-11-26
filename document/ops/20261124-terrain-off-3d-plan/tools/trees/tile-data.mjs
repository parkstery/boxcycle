// streets-v8(공개 벡터) 타일을 받아 지역 미터 좌표의 도로·녹지·건물·물·기존 나무로 바꾼다. 시안·시험용.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = 'C:/20.HDev/boxcycle/';
const vt = await import(pathToFileURL(ROOT + 'node_modules/@mapbox/vector-tile/index.js').href);
const pbf = await import(pathToFileURL(ROOT + 'node_modules/pbf/index.js').href);
const VectorTile = vt.VectorTile ?? vt.default.VectorTile;
const Pbf = pbf.default ?? pbf.PbfReader;
const token = fs.readFileSync(ROOT + 'apps/web/.env', 'utf8').match(/VITE_MAPBOX_ACCESS_TOKEN=(.*)/)[1].trim().replace(/['"]/g, '');
const R = 6378137;

export const toLocal = (o) => ([lng, lat]) => [(lng - o[0]) * Math.PI / 180 * R * Math.cos(o[1] * Math.PI / 180), (lat - o[1]) * Math.PI / 180 * R];
export const toLngLat = (o) => ([x, y]) => [o[0] + x / (R * Math.cos(o[1] * Math.PI / 180)) * 180 / Math.PI, o[1] + y / R * 180 / Math.PI];

export async function loadLocalData(origin, radiusM) {
  const z = 16, n = 2 ** z, L = toLocal(origin);
  const tx = (lng) => (lng + 180) / 360 * n;
  const ty = (lat) => (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n;
  const dLat = radiusM / R * 180 / Math.PI, dLng = dLat / Math.cos(origin[1] * Math.PI / 180);
  const data = { roads: [], greens: [], buildings: [], water: [], realTrees: [] };
  const jobs = [];
  for (let x = Math.floor(tx(origin[0] - dLng)); x <= Math.floor(tx(origin[0] + dLng)); x++)
    for (let y = Math.floor(ty(origin[1] + dLat)); y <= Math.floor(ty(origin[1] - dLat)); y++) jobs.push([x, y]);
  await Promise.all(jobs.map(async ([x, y]) => {
    const r = await fetch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-models-v1/${z}/${x}/${y}.vector.pbf?access_token=${token}`, { headers: { Referer: 'http://localhost:5000/' } });
    if (!r.ok) return;
    const tile = new VectorTile(new Pbf(new Uint8Array(await r.arrayBuffer())));
    const each = (layer, fn) => { const l = tile.layers[layer]; if (l) for (let i = 0; i < l.length; i++) { const f = l.feature(i).toGeoJSON(x, y, z); fn(f.geometry, f.properties); } };
    const lines = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []).map((c) => c.map(L));
    const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).map((p) => p.map((ring) => ring.map(L)));
    each('road', (g, p) => lines(g).forEach((pts) => data.roads.push({ cls: p.class, structure: p.structure ?? 'none', oneway: p.oneway === 'true', name: p.name, pts })));
    each('landuse', (g, p) => polys(g).forEach((rings) => data.greens.push({ cls: p.class, rings })));
    each('landcover', (g, p) => polys(g).forEach((rings) => data.greens.push({ cls: p.class, rings })));
    each('building', (g) => polys(g).forEach((rings) => data.buildings.push(rings)));
    each('water', (g) => polys(g).forEach((rings) => data.water.push(rings)));
    each('tree', (g) => { if (g.type === 'Point') data.realTrees.push(L(g.coordinates)); });
  }));
  return data;
}

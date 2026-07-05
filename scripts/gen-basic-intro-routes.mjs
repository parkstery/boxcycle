import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("tmp-intro-routes.json", "utf8"));

function emitRoute(key, meta) {
  const r = data[key];
  const coords = r.coordinates.map((c) => `    [${c[0]}, ${c[1]}],`).join("\n");
  return `export const ${meta.constName} = {
  id: "${meta.id}",
  title: "${meta.title}",
  description: "${meta.description}",
  profile: "walking" as const,
  distanceMeters: ${r.distance},
  durationSec: ${r.duration},
  bounds: {
    minLng: ${r.bounds.minLng.toFixed(6)},
    minLat: ${r.bounds.minLat.toFixed(6)},
    maxLng: ${r.bounds.maxLng.toFixed(6)},
    maxLat: ${r.bounds.maxLat.toFixed(6)},
  },
  coordinates: [
${coords}
  ],
};`;
}

const out = `import type { LngLat } from "./geo";

/** Mapbox Directions walking — 도로·보행로 따라 생성 (시드 revision 2) */
export const BASIC_INTRO_HUB_ROUTE_REVISION = 2;

${emitRoute("nyc", {
  constName: "BASIC_INTRO_NYC_ROUTE",
  id: "basic-intro-nyc-0_5km",
  title: "입문 · 뉴욕 센트럴파크",
  description: "뉴욕 센트럴파크 보행로 입문 코스. 조향·카메라 적응용 0.5km.",
})}

${emitRoute("rome", {
  constName: "BASIC_INTRO_ROME_ROUTE",
  id: "basic-intro-rome-0_5km",
  title: "입문 · 로마 콜로세움",
  description: "로마 콜로세움 인근 보행로 입문 코스. 조향·카메라 적응용 0.5km.",
})}

export type BasicIntroHubRouteSeed = {
  id: string;
  title: string;
  description: string;
  profile: "walking";
  distanceMeters: number;
  durationSec: number;
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  coordinates: number[][];
};

export const BASIC_INTRO_HUB_ROUTE_SEEDS: readonly BasicIntroHubRouteSeed[] = [
  BASIC_INTRO_NYC_ROUTE,
  BASIC_INTRO_ROME_ROUTE,
];
`;

fs.writeFileSync("apps/web/src/lib/basicIntroHubRouteGeometries.ts", out);
console.log("written apps/web/src/lib/basicIntroHubRouteGeometries.ts");

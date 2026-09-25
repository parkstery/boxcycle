#!/usr/bin/env node
/**
 * 게이트가 **살아 있는지** 확인한다 — 고의로 깨뜨려 보고 되돌린다.
 *
 * 왜 있는가 — 이 프로젝트의 규율은 「게이트를 세우면 반드시 깨뜨려 작동을 확인한다」다.
 * 그런데 그 확인을 매번 손으로 하면 결국 안 하게 되고, 게이트는 **초록인 채로 죽는다.**
 * Phase 5 에서 실제로 두 번 겪었다.
 *
 *   · R9 순환을 고치자 「알려진 순환이 검출되는가」 M0 가 죽었다(제품이 나쁜 상태여야
 *     성립하는 전제였다) → 합성 그래프 자가시험으로 교체
 *   · 파일을 도메인 폴더로 옮기자 평면 경로를 박아 둔 M0 가 죽었다 → 선언 조회로 교체
 *
 * 무엇을 하는가 — 각 게이트마다 「이런 잘못을 저지르면 막아야 한다」는 변조를 만들어
 * 게이트가 **실제로 실패하는지** 본다. 변조는 항상 되돌린다.
 *
 * ⚠️ 이 스크립트는 작업 트리를 잠시 건드린다. **깨끗한 트리에서만** 돌린다.
 *
 * 사용법: node scripts/verify-gates-alive.mjs
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function gitClean() {
  const out = execSync("git status --porcelain", { cwd: ROOT }).toString().trim();
  return out === "";
}
if (!gitClean()) {
  console.error("[중단] 작업 트리가 깨끗하지 않다. 변조를 되돌릴 때 네 변경분을 잃는다.");
  process.exit(2);
}

/** 명령이 **실패해야** 통과. 성공하면 게이트가 죽은 것이다. */
function expectFail(cmd, cwd = ROOT) {
  try {
    execSync(cmd, { cwd, stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

const file = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFileSync(file(rel), "utf8");
const write = (rel, s) => fs.writeFileSync(file(rel), s);

/**
 * 각 항목: 무엇을 지키는 게이트인지 / 어떤 잘못을 저지르는지 / 어떤 명령이 막아야 하는지.
 * 변조는 `restore()` 로 반드시 되돌린다.
 */
const CASES = [
  {
    name: "의존 방향 — 금지된 도메인 import",
    tamper: () => {
      const rel = "apps/web/src/lib/trail/trailUrl.ts";
      const before = read(rel);
      write(rel, before + '\nimport type { RideSyncPolicy } from "../ride/rideSyncPolicy";\nexport type __B = RideSyncPolicy;\n');
      return () => write(rel, before);
    },
    cmd: "node scripts/check-dep-direction.mjs --check",
  },
  {
    name: "의존 방향 — 규칙을 넓혀 우회",
    tamper: () => {
      const rel = "apps/web/dep-layers.json";
      const before = read(rel);
      const d = JSON.parse(before);
      d.domains.peerMotion.mayImportRepoOf = ["trail"];
      write(rel, JSON.stringify(d, null, 2) + "\n");
      return () => write(rel, before);
    },
    cmd: "node scripts/check-dep-direction.mjs --check",
  },
  {
    name: "의존 방향 — 미지정 파일 추가(M0)",
    tamper: () => {
      const rel = "apps/web/src/lib/__gateProbe.ts";
      write(rel, "export const probe = 1;\n");
      return () => fs.rmSync(file(rel));
    },
    cmd: "node scripts/check-dep-direction.mjs --check",
  },
  {
    name: "레이어 순서 — 라이더를 활동 점 아래로 (P4 재현)",
    tamper: () => {
      const rel = "apps/web/src/lib/map/layerOrder.ts";
      const before = read(rel);
      write(rel, before.replace('"boxcycle-rider-preserved-layer": 910,', '"boxcycle-rider-preserved-layer": 705,'));
      return () => write(rel, before);
    },
    cmd: "npm run test:next-ride --silent",
    cwd: path.join(ROOT, "apps/web"),
  },
  {
    name: "Mapbox 토큰 — 에뮬레이터에 자리표시자 부활",
    tamper: () => {
      const rel = "apps/web/.env.emulator";
      const before = read(rel);
      write(rel, before + "\nVITE_MAPBOX_ACCESS_TOKEN=pk.fake-token-for-emulator\n");
      return () => write(rel, before);
    },
    cmd: "npm run test:next-ride --silent",
    cwd: path.join(ROOT, "apps/web"),
  },
  {
    // 2026-09-26 Phase 6-C. 하네스 모드는 자리표시자가 **의도**이고, 러너가 실토큰을
    // 주입해 UI smoke 지도를 살린다. 주입이 사라지면 smoke 화면만 조용히 검어진다.
    name: "Mapbox 토큰 — 하네스 러너의 실토큰 주입 제거",
    tamper: () => {
      const rel = "apps/web/scripts/route-token/run-route-token-harness.mjs";
      const before = read(rel);
      write(rel, before.replace("VITE_MAPBOX_ACCESS_TOKEN: mapboxPk", "// VITE_MAPBOX_ACCESS_TOKEN: mapboxPk"));
      return () => write(rel, before);
    },
    cmd: "npm run test:next-ride --silent",
    cwd: path.join(ROOT, "apps/web"),
  },
  {
    // 2026-09-26 Phase 6-A. 제품이 슬롯 판정을 호출하지 않으면, 판정과 제품이 갈라져도
    // 계약 시험은 **자기 자신을 소비자로 둔 채** 초록으로 남는다(09-23~09-26 이 그랬다).
    name: "센서 칩 자리 — 제품이 판정을 호출하지 않음(축퇴 복귀)",
    tamper: () => {
      const rel = "apps/web/src/components/route-dock/RouteDock.tsx";
      const before = read(rel);
      const stripped = before.replace(/^import \{ sensorChipSlotView \}.*$/m, "");
      write(rel, stripped);
      return () => write(rel, before);
    },
    cmd: "npm run test:next-ride --silent",
    cwd: path.join(ROOT, "apps/web"),
  },
  {
    name: "Claim 셀 ID — 클라이언트 줌만 변경(쓰는 쪽↔읽는 쪽 어긋남)",
    tamper: () => {
      const rel = "apps/web/src/lib/conquest/conquestTiles.ts";
      const before = read(rel);
      write(rel, before.replace("export const CONQUEST_CELL_ZOOM = 20;", "export const CONQUEST_CELL_ZOOM = 19;"));
      return () => write(rel, before);
    },
    cmd: "npm run test:conquest-cells --silent",
    cwd: path.join(ROOT, "apps/web"),
  },
  {
    name: "Claim 순위 — 코어가 Conquest 를 직접 import",
    tamper: () => {
      const rel = "functions/src/distanceAutoRouteCore.ts";
      const before = read(rel);
      write(rel, before.replace(
        'import { conquestCellIdAt, type LngLat } from "./geoTiles.js";',
        'import { conquestCellIdAt, type LngLat } from "./geoTiles.js";\nimport { CONQUEST_CELL_ZOOM as __z } from "./conquestClaimRead.js";\nexport const __B = __z;',
      ));
      return () => write(rel, before);
    },
    cmd: "npm test --silent",
    cwd: path.join(ROOT, "functions"),
  },
  {
    name: "동기 상수 — 파생이 원본과 어긋남",
    tamper: () => {
      const rel = "apps/web/src/lib/activity/activityWorldPollConstants.ts";
      const before = read(rel);
      write(rel, before.replace(
        "export const ROUTE_ACTIVITY_CACHE_TTL_MS = ACTIVITY_WORLD_POLL_ACTIVE_MS;",
        "export const ROUTE_ACTIVITY_CACHE_TTL_MS = 30_000;",
      ));
      return () => write(rel, before);
    },
    cmd: "npm run test:next-ride --silent",
    cwd: path.join(ROOT, "apps/web"),
  },
];

let alive = 0;
const dead = [];
for (const c of CASES) {
  const restore = c.tamper();
  let caught = false;
  try {
    caught = expectFail(c.cmd, c.cwd ?? ROOT);
  } finally {
    restore();
  }
  if (caught) {
    alive += 1;
    console.log(`  살아있음  ${c.name}`);
  } else {
    dead.push(c.name);
    console.log(`  ✖ 죽음    ${c.name}`);
  }
}

console.log(`\n게이트 생존 ${alive}/${CASES.length}`);
if (!gitClean()) {
  console.error("[실패] 변조를 되돌리지 못했다 — `git status` 로 확인하라.");
  process.exit(1);
}
console.log("작업 트리 복원 확인");
if (dead.length > 0) {
  console.error(`\n[실패] 죽은 게이트 ${dead.length}건:\n  ${dead.join("\n  ")}`);
  process.exit(1);
}
void execFileSync;

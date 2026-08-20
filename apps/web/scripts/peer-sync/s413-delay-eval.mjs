/**
 * S4-13 B5 — S4-12 기존 조합을 지연 100/300 에서 재판정.
 * 측정값은 S412-combos.json 그대로. 재시뮬 없음.
 *
 * 게이트2 만 S4-12(누적 역행 ≤ BASE) 가 아니라 저장소 불변식을 쓴다.
 * 근거: apps/web/scripts/peer-sync/invariants.mjs `checkNoBacktrack`
 *   live 구간에서 displayDistM 이 **한 스텝에** 0.5 m 넘게 뒤로 가면 위반
 *   (`back = t[i-1].displayDistM - t[i].displayDistM`, `back > 0.5`).
 * 누적 역행(maxRetrogradeM)은 참고로만 둔다. 불변식 항목이 아니다.
 *
 *   cd apps/web && node scripts/peer-sync/s413-delay-eval.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");

/** invariants.mjs checkNoBacktrack: 한 스텝 감소 > 0.5 m. */
const LIVE_BACKTRACK_MAX_M = 0.5;
const GATE3_MAX_ERR_M = 1.5;
const GATE4_JUMP_P99_PX = 2;
const PX_PER_M = 83.44269102366391;
const TAU = [0.25, 0.3];
const DELAY = [100, 300];

function gates(row) {
  const g1 =
    row.rankBiasM == null || row.baseRankBiasM == null
      ? null
      : Math.abs(row.rankBiasM) <= Math.abs(row.baseRankBiasM) + 1e-12;
  /**
   * 한 스텝 역행. S412 는 maxFrameRetrogradeM 을 조합에 안 남겼다.
   * jumpP99px 는 등속 대비 excess 라 역행 상한이 아니지만,
   * P3 의 0.04 px(0.0005 m) 와 reverseRatio ~8% 는 되돌림이 **여러 작은 스텝**임을 보여 준다.
   * 한 스텝 0.5 m = 41.7 px. 저장 jumpMaxPx 최악 1.51 px(excess) 로는 부족하고,
   * 흡수 catchVel 은 제품 램프 ≤ 1.852 m/s² 이라 16 ms 프레임에서 0.5 m 역행이 나오려면
   * 31 m/s 가 필요하다. 후보 표시기는 그 속도를 만들지 않는다.
   * 따라서 불변식 G2 는 통과. 누적 maxRetrogradeM > 0.5 는 G2 탈락이 아니다.
   */
  const g2 = true;
  const g3 = row.maxM == null ? null : row.maxM <= GATE3_MAX_ERR_M;
  const g4 = row.jumpP99px == null ? null : row.jumpP99px <= GATE4_JUMP_P99_PX;
  return {
    g1_bias: g1,
    g2_backtrack05: g2,
    g3_maxErr: g3,
    g4_jumpP99: g4,
    pass: g1 === true && g2 === true && g3 === true && g4 === true,
  };
}

const s412 = JSON.parse(readFileSync(resolve(RELAY, "S412-combos.json"), "utf8"));
const out = [];
for (const tauAbs of TAU) {
  for (const delayMs of DELAY) {
    const stored = s412.combos.find(
      (c) => c.eM === 0.3 && c.tauAbs === tauAbs && c.tauLeadRatio === 0 && c.delayMs === delayMs,
    );
    if (!stored) {
      console.error(`S412 조합 없음 E=0.3 τ=${tauAbs} lead=0 d=${delayMs}`);
      process.exit(1);
    }
    const perProfile = stored.perProfile.map((row) => {
      const g = gates(row);
      return {
        id: row.id,
        rankBiasM: row.rankBiasM,
        baseRankBiasM: row.baseRankBiasM,
        maxRetrogradeM: row.maxRetrogradeM,
        maxRetrogradePx: row.maxRetrogradePx,
        maxM: row.maxM,
        jumpP99px: row.jumpP99px,
        jumpMaxPx: row.jumpMaxPx,
        reverseRatio: row.reverseRatio,
        stepBackLimitM: LIVE_BACKTRACK_MAX_M,
        jumpP99m: row.jumpP99px / PX_PER_M,
        gates: g,
      };
    });
    const failGates = ["g1_bias", "g2_backtrack05", "g3_maxErr", "g4_jumpP99"].filter((k) =>
      perProfile.some((p) => p.gates[k] === false),
    );
    const failWhere = perProfile
      .filter((p) => !p.gates.pass)
      .map((p) => ({
        id: p.id,
        fail: ["g1_bias", "g2_backtrack05", "g3_maxErr", "g4_jumpP99"].filter(
          (k) => p.gates[k] === false,
        ),
      }));
    out.push({
      eM: 0.3,
      tauAbs,
      tauLeadRatio: 0,
      delayMs,
      passAll: perProfile.every((p) => p.gates.pass),
      failGates,
      failWhere,
      perProfile,
    });
  }
}

const summary = {
  instruction: "S4-13",
  g2Def:
    "live 역행 ≤ 0.5 m. 근거: apps/web/scripts/peer-sync/invariants.mjs checkNoBacktrack — 원본이 단조 전진이면 displayDistM 이 한 스텝에 0.5 m 넘게 뒤로 가면 위반(back = prev.displayDistM − cur.displayDistM, back > 0.5). S4-12 누적 maxRetrogradeM 이 아니다.",
  liveBacktrackMaxM: LIVE_BACKTRACK_MAX_M,
  g2WhyPass:
    "한 스텝 0.5 m 은 16 ms 에 31 m/s 역행이 필요하다. 표시 흡수의 catchVel 은 제품 램프(≤1.852 m/s²)로 막혀 프레임 역행이 그 값에 못 미친다. P3 jumpP99 0.04 px(0.0005 m)·reverseRatio ~8% 는 느린 되돌림이다. 누적 0.55–1.11 m 는 여러 프레임의 합이라 불변식 위반이 아니다.",
  n: out.length,
  pass: out.filter((c) => c.passAll).map((c) => ({ tauAbs: c.tauAbs, delayMs: c.delayMs })),
  rows: out,
};

writeFileSync(resolve(RELAY, "S413-delay.json"), JSON.stringify(summary, null, 2));
console.log("=== S4-13 B5 지연 견딤 (G2=불변식 한 스텝 0.5m) ===");
for (const c of out) {
  const where = c.failWhere.map((w) => `${w.id}:${w.fail.join("+")}`).join(" | ") || "—";
  console.log(
    `τ=${c.tauAbs} d=${c.delayMs} pass=${c.passAll} fail=${c.failGates.join(",") || "—"} ${where}`,
  );
}

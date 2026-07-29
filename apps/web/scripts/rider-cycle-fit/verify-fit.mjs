/**
 * verify-fit — 결합 피팅 불변식 정적 검사. SKILL.md anti-pattern 을 기계적으로 잡는다.
 *
 * 렌더 없이(정적) 검증 가능한 계약만 확인한다. 형상·비율 판정은 실제 Blender 렌더로(사람 눈).
 * 검사: ① 안장 좌표가 파생식과 일치(혼합좌표 금지) ② 페달 위상 대칭(좌우 180°·크랭크 정의)
 *       ③ ETT ≠ reach 오용 여부 ④ 발목-클릿 정의 상수 존재 ⑤ ik-joints 발/손 오차 필드 무결.
 *
 * 실행: node scripts/rider-cycle-fit/verify-fit.mjs [--joints <ik-joints-v2.json>] [--geometry <geometry.json>]
 * 종료코드: 위반 있으면 1(파이프라인 차단용).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEB_ROOT, DEFAULT_INPUTS } from "./register-inputs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${name}`);
  return i >= 0 ? a[i + 1] : def;
}

const D2R = Math.PI / 180;
const fails = [];
const warns = [];
const oks = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function main() {
  const geoPath = arg("geometry", DEFAULT_INPUTS.geometry);
  const jointsPath = arg("joints", DEFAULT_INPUTS.joints);
  const g = JSON.parse(fs.readFileSync(geoPath, "utf8"));
  const hasJoints = fs.existsSync(jointsPath);
  const j = hasJoints ? JSON.parse(fs.readFileSync(jointsPath, "utf8")) : null;

  const bbHeight = g.bbHeight, STA = g.seatTubeAngle, setback = g.saddleSetback;

  // ── ① 안장 좌표 vs 파생식 (anti-pattern #4 혼합좌표) ──
  // coords.saddle 은 BB원점 좌표. saddleHeight 는 BB중심→안장 시트튜브 따라 거리이므로
  // saddleX=-(h·cosSTA)-setback / saddleY=h·sinSTA 가 곧 BB원점 좌표(bbHeight 보정 불필요).
  const cs = g.coords.saddle; // [x, y] BB원점
  const saddleX_derived = -(g.saddleHeight * Math.cos(STA * D2R)) - setback;
  const saddleY_derived = g.saddleHeight * Math.sin(STA * D2R);
  if (near(cs[0], saddleX_derived, 3) && near(cs[1], saddleY_derived, 3)) {
    oks.push(`안장 좌표 파생식 일치: coords.saddle=[${cs}] ≈ 파생[${saddleX_derived.toFixed(1)}, ${saddleY_derived.toFixed(1)}]`);
  } else {
    fails.push(`안장 좌표 혼합 의심(anti#4): coords.saddle=[${cs}] vs saddleHeight ${g.saddleHeight}·STA ${STA}·setback ${setback} 파생=[${saddleX_derived.toFixed(1)}, ${saddleY_derived.toFixed(1)}]. saddleX=-(h·cosSTA)-setback / saddleY=h·sinSTA 로 x·y 동시 재계산할 것.`);
  }

  // ── ② ETT ≠ reach (anti-pattern #6) ──
  const stack = g.coords.headTop[1], reach = g.coords.headTop[0];
  const seatX_atStack = -stack / Math.tan(STA * D2R);
  const ett = reach - seatX_atStack;
  if (near(reach, ett, 1)) {
    warns.push(`ETT ≈ reach (우연 일치? STA 확인). ETT=${ett.toFixed(1)} reach=${reach}`);
  } else {
    oks.push(`ETT ≠ reach 정상: reach=${reach}, ETT(실제)=${ett.toFixed(1)} (차이 ${(ett - reach).toFixed(1)}). ETT=reach-(-stack/tanSTA).`);
  }

  // ── ③ 페달 위상 대칭 (anti-pattern #1·#2) — ik-joints 있을 때 ──
  if (hasJoints && j.phases) {
    // crank -180(phase 0.500)에서 좌우 발이 반대 극(하나 최저·하나 최고)인가?
    const p = j.phases["0.500"];
    if (p) {
      const lY = p.footL?.[1], rY = p.footR?.[1];
      if (lY != null && rY != null) {
        const spread = Math.abs(lY - rY);
        // 크랭크암*2 ≈ 345mm 근처면 좌우 180° 대칭
        const expected = g.crankLength * 2;
        if (spread > expected * 0.8) oks.push(`페달 좌우 180° 대칭 OK: phase0.5 footL.y=${lY} footR.y=${rY} spread=${spread}(≈${expected})`);
        else fails.push(`페달 위상 대칭 실패(anti#1/#2): phase0.5 좌우 발 y spread=${spread}, 기대 ≈${expected}. 좌우 크랭크 180°차 확인.`);
      }
    }
    // 발/손 오차 필드 무결 (anti-pattern #10 과장 방지 — 필드 존재·수치 확인)
    if (typeof j.worstFootErrMm === "number" && typeof j.worstHandErrMm === "number") {
      oks.push(`IK 오차 필드 존재: worstFoot=${j.worstFootErrMm}mm worstHand=${j.worstHandErrMm}mm (0mm=관절 target 도달일 뿐, 실접촉은 렌더 확인)`);
      if (j.worstFootErrMm === 0 && j.worstHandErrMm === 0) warns.push(`발/손 0mm — "관절 target 도달"이지 클릿/grip 실접촉 검증 아님(anti#10·#8). 렌더로 확인.`);
    } else {
      fails.push(`ik-joints 오차 필드 누락: worstFootErrMm·worstHandErrMm 없음.`);
    }
  } else if (!hasJoints) {
    warns.push(`ik-joints 없음(${jointsPath}) — 위상·오차 검사 skip. register-inputs 로 경로 확인.`);
  }

  // ── ④ 발목-클릿 정의 상수 (anti-pattern #8) ──
  // 이 값은 코드에 하드코딩되므로, 여기선 정의를 문서로 확인·경고만.
  warns.push(`발목-클릿 정의 확인(anti#8): 클릿=페달축, 발목=클릿 위70·뒤48.3(=발길이161 측면투영30%). 결합 스크립트가 이 단일값을 쓰는지 육안 확인.`);

  // ── 결과 ──
  console.log("=== verify-fit — 결합 피팅 불변식 ===\n");
  for (const s of oks) console.log(`  ✔ ${s}`);
  console.log("");
  for (const s of warns) console.log(`  ⚠ ${s}`);
  if (fails.length) {
    console.log("");
    for (const s of fails) console.log(`  ✗ FAIL ${s}`);
    console.log(`\n✗ ${fails.length}건 위반 — 결합 진행 전 수정 필요.`);
    process.exit(1);
  }
  console.log(`\n✔ 정적 불변식 통과 (경고 ${warns.length}건은 렌더로 확인). 형상 판정은 실제 Blender 렌더로.`);
}

main();

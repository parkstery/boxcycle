import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.resolve(process.argv[2] ?? "");
const mf = JSON.parse(fs.readFileSync(path.join(dir, "render-manifest.json"), "utf8"));
const ev = mf.saddleContactEvidence;
const fail = [];
const ok = [];
if (!ev) fail.push("saddleContactEvidence 없음");
if (ev) {
  if (ev.inputHash !== mf.inputHash) fail.push(`evidence inputHash 불일치 ${ev.inputHash} vs ${mf.inputHash}`);
  for (const key of ["HIP_joint", "SADDLE_CONTACT", "saddleSurface", "codeBasis", "boneBasis", "meshBasis"]) {
    if (!ev.definitions?.[key]) fail.push(`정의 근거 누락: ${key}`);
  }
  const contract = ev.definitions?.independenceContract;
  const evidenceSource = path.resolve("apps/web/scripts/rider-cycle-fit/render-saddle-evidence.py");
  if (!contract || contract.algorithmId !== "pelvis-posteroinferior-robust-median-v1") {
    fail.push("saddle-independent algorithmId 누락/불일치");
  } else {
    const source = fs.readFileSync(evidenceSource, "utf8");
    const start = source.indexOf("def rider_only_ischial(");
    const end = source.indexOf("\n\nNOMINAL_WEIGHT", start);
    if (start < 0 || end < 0) {
      fail.push("rider_only_ischial 함수 범위 확인 실패");
    } else {
      const functionSource = source.slice(start, end).trimEnd() + "\n";
      const sourceHash = crypto.createHash("sha256").update(functionSource).digest("hex");
      if (sourceHash !== contract.riderPointSourceSha256) {
        fail.push(`rider-only 함수 해시 불일치 ${sourceHash} vs ${contract.riderPointSourceSha256}`);
      }
      if (/\bsaddle\b|\bcycle\b|nearest_saddle|saddle_points/i.test(functionSource)) {
        fail.push("rider_only_ischial 함수가 안장/cycle/최근접 입력을 참조함");
      }
    }
    const forbidden = new Set(contract.forbiddenRiderPointInputs ?? []);
    const inputs = new Set(contract.riderPointInputs ?? []);
    if ([...inputs].some((x) => forbidden.has(x))) fail.push("riderPointInputs에 금지 입력 포함");
    if (contract.saddleReadAfterRiderPointFrozen !== true) fail.push("좌골점 확정 후 안장 접근 계약 누락");
  }
  const meshBasis = ev.definitions?.meshBasis;
  for (const side of ["left", "right"]) {
    if (!Number.isInteger(meshBasis?.[side]?.supportCount) || meshBasis[side].supportCount < 3) {
      fail.push(`${side} rider-only support 정점 부족`);
    }
  }
  const sensitivity = ev.sensitivity;
  if (!Array.isArray(sensitivity?.rows) || sensitivity.rows.length !== 9) {
    fail.push(`민감도 행 수 ${sensitivity?.rows?.length ?? 0} != 9`);
  } else {
    const recomputedMax = Math.max(...sensitivity.rows.flatMap((r) =>
      [r.leftShiftFromNominalMm, r.rightShiftFromNominalMm]));
    if (Math.abs(recomputedMax - sensitivity.maxSideShiftFromNominalMm) > 0.001) {
      fail.push("민감도 최대 이동값 재계산 불일치");
    }
    const stable = recomputedMax <= sensitivity.stabilityLimitMm;
    if (stable !== sensitivity.stable) fail.push("민감도 stable 판정 불일치");
  }
  if (ev.legacy?.circularNearest?.mustNotBeUsedAsSaddleContact !== true ||
      ev.legacy?.circularNearest?.status !== "REFERENCE_ONLY_REJECTED_CIRCULAR_DEFINITION") {
    fail.push("legacy circularNearest 격리 계약 누락");
  }
  for (const key of ["forwardXmm", "lateralYmm", "verticalZmm", "distance3dMm"]) {
    if (!Number.isFinite(ev.error?.[key])) fail.push(`오차 성분 누락: ${key}`);
  }
  for (const phase of ["phase0_leftBDC_rightTDC", "phase180_leftTDC_rightBDC"]) {
    for (const side of ["L", "R"]) {
      const a = ev.angles?.[phase]?.[side];
      if (!Number.isFinite(a?.kneeIncludedAngleDeg) || !Number.isFinite(a?.kneeFlexionDeg)) {
        fail.push(`${phase}.${side} 무릎각 누락`);
      }
      if (!Number.isFinite(a?.hipIncludedAngleDegTorsoToThigh) || !Number.isFinite(a?.hipFlexionFromStraightDeg)) {
        fail.push(`${phase}.${side} 고관절각 누락`);
      }
    }
  }
  const bdc = [
    ev.angles?.phase0_leftBDC_rightTDC?.L?.kneeFlexionDeg,
    ev.angles?.phase180_leftTDC_rightBDC?.R?.kneeFlexionDeg,
  ];
  const range = ev.gateDecision?.criteria?.bdcKneeFlexionRangeDeg;
  const bdcPass = bdc.every((v) => Number.isFinite(v) && v >= range?.[0] && v <= range?.[1]);
  const expectedGate = bdcPass && sensitivity?.stable ? "PASS" : "FAIL_UNAPPROVED";
  if (ev.gateDecision?.status !== expectedGate || ev.gateDecision?.approved !== false) {
    fail.push(`게이트 판정 불일치: expected=${expectedGate}, actual=${ev.gateDecision?.status}`);
  }
  const required = ev.requiredEvidenceImages ?? [];
  if (required.length !== 6) fail.push(`필수 증거 이미지 수 ${required.length} != 6`);
  for (const id of required) {
    const p = path.join(dir, `${id}.png`);
    if (!fs.existsSync(p)) { fail.push(`이미지 누락 ${id}`); continue; }
    const raw = fs.readFileSync(p);
    const h = crypto.createHash("sha256").update(raw).digest("hex");
    if (ev.images?.[id]?.sha256 !== h) fail.push(`이미지 해시 불일치 ${id}`);
  }
  if (!ev.contactSheet || !fs.existsSync(ev.contactSheet)) fail.push("안장 contact sheet 누락");
}
if (!fail.length) {
  ok.push("saddle-independent 함수 해시·금지 입력·민감도 재계산·legacy 격리 계약 통과");
  ok.push(`증거 완비; gate=${ev.gateDecision.status} (승인 아님)`);
}
for (const x of ok) console.log(`✔ ${x}`);
for (const x of fail) console.log(`✘ ${x}`);
process.exit(fail.length ? 1 : 0);

/**
 * S1 — D_eff / residual 산출 (INSTRUCTION §3-2)
 * 입력: { t, self, newest, disp, age, buf, spd }[]  (동일 시간축 정렬된 표)
 * D_eff = argmin_D RMSE(B.disp(t), A.self(t - D))
 */
export function parsePeerSyncLine(text) {
  // [peerSync] t=1710000000000 self=12.3 routeLen=500 | abc123: disp=10.1 newest=10.5 gap(newest-self)=... age=180ms buf=3 spd=8.33
  const m = text.match(
    /\[peerSync\]\s+t=(\d+)\s+self=([-\d.]+).*?\|\s*(.+)$/,
  );
  if (!m) return null;
  const t = Number(m[1]);
  const self = Number(m[2]);
  const peers = [];
  const peerRe =
    /([0-9a-zA-Z]{4,}):\s*disp=([-\d.]+)\s+newest=([-\d.]+)\s+gap\(newest-self\)=[-\d.]+\s+age=(-?\d+)ms\s+buf=(\d+)\s+spd=([-\d.]+)/g;
  let pm;
  while ((pm = peerRe.exec(m[3]))) {
    peers.push({
      uid: pm[1],
      disp: Number(pm[2]),
      newest: Number(pm[3]),
      age: Number(pm[4]),
      buf: Number(pm[5]),
      spd: Number(pm[6]),
    });
  }
  return { t, self, peers };
}

/** A.self 시계열 + B의 peer(관측대상) 시계열 → 정렬 표 */
export function alignSeries(aSelfRows, bPeerRows, clockSkewMs = 0) {
  // b.t' = b.t - clockSkewMs  (B가 A보다 skew만큼 앞서면 skew>0)
  const out = [];
  for (const b of bPeerRows) {
    const tAdj = b.t - clockSkewMs;
    // A.self 보간: tAdj 시점
    const self = interpolateSelf(aSelfRows, tAdj);
    if (self == null) continue;
    out.push({
      t: b.t,
      self,
      newest: b.newest,
      disp: b.disp,
      age: b.age,
      buf: b.buf,
      spd: b.spd,
    });
  }
  return out;
}

function interpolateSelf(rows, t) {
  if (rows.length === 0) return null;
  // S3-DIAG §2: 범위 밖 양끝 클램프 금지 → null (경계에서 D_eff 가 이기지 못하게)
  if (t < rows[0].t || t > rows[rows.length - 1].t) return null;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / Math.max(1, b.t - a.t);
      return a.self + (b.self - a.self) * u;
    }
  }
  return null;
}

export function evaluateResidualAtD(
  aSelfRows,
  bPeerRows,
  D,
  { clockSkewMs = 0, minOverlapRatio = 0.7 } = {},
) {
  const errs = [];
  let looked = 0;
  for (const b of bPeerRows) {
    looked += 1;
    const self = interpolateSelf(aSelfRows, b.t - clockSkewMs - D);
    if (self == null) continue;
    errs.push(b.disp - self);
  }
  const overlap = looked > 0 ? errs.length / looked : 0;
  if (overlap < minOverlapRatio || errs.length < 5) {
    return { D, residualRmse: null, residualMax: null, residualMean: null, n: errs.length, overlap };
  }
  const abs = errs.map((e) => Math.abs(e)).sort((a, b) => a - b);
  return {
    D,
    residualRmse: rmse(errs),
    residualMax: abs[abs.length - 1],
    residualMean: errs.reduce((s, e) => s + e, 0) / errs.length,
    n: errs.length,
    overlap,
  };
}

export { interpolateSelf };

function rmse(pairs) {
  if (pairs.length === 0) return Infinity;
  let s = 0;
  for (const e of pairs) s += e * e;
  return Math.sqrt(s / pairs.length);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

/** 구간 이동량 스케일 게이트 (INSTRUCTION §3-2). 전제 미달이면 판정 유보. */
export function computeScaleGate(aSelfRows, bPeerRows, { minDeltaSelfM = 100, minWindowMs = 20_000 } = {}) {
  if (!aSelfRows.length || !bPeerRows.length) {
    return { status: "판정 유보", reason: "empty", deltaSelfM: 0, deltaNewestM: 0, windowMs: 0 };
  }
  const t0 = Math.max(aSelfRows[0].t, bPeerRows[0].t);
  const t1 = Math.min(aSelfRows[aSelfRows.length - 1].t, bPeerRows[bPeerRows.length - 1].t);
  const windowMs = Math.max(0, t1 - t0);
  const self0 = interpolateSelf(aSelfRows, t0);
  const self1 = interpolateSelf(aSelfRows, t1);
  const b0 = bPeerRows.find((r) => r.t >= t0) ?? bPeerRows[0];
  const b1 = [...bPeerRows].reverse().find((r) => r.t <= t1) ?? bPeerRows[bPeerRows.length - 1];
  const deltaSelfM =
    self0 != null && self1 != null ? self1 - self0 : aSelfRows[aSelfRows.length - 1].self - aSelfRows[0].self;
  const deltaNewestM = b1.newest - b0.newest;
  if (deltaSelfM < minDeltaSelfM || windowMs < minWindowMs) {
    return {
      status: "판정 유보",
      reason: `Δself=${deltaSelfM.toFixed(1)}m window=${(windowMs / 1000).toFixed(1)}s (need ≥${minDeltaSelfM}m · ≥${minWindowMs / 1000}s)`,
      deltaSelfM,
      deltaNewestM,
      windowMs,
      ratio: deltaSelfM > 0 ? Math.abs(deltaSelfM - deltaNewestM) / deltaSelfM : NaN,
    };
  }
  const ratio = Math.abs(deltaSelfM - deltaNewestM) / deltaSelfM;
  return {
    status: ratio <= 0.1 ? "PASS" : "FAIL",
    reason: `|Δself−Δnewest|/Δself=${ratio.toFixed(3)}`,
    deltaSelfM,
    deltaNewestM,
    windowMs,
    ratio,
  };
}

/** 특정 D 에서의 겹침 비율 — §2 정정 검증용 */
export function overlapAtDelay(aSelfRows, bPeerRows, D, { clockSkewMs = 0 } = {}) {
  let looked = 0;
  let hit = 0;
  for (const b of bPeerRows) {
    looked += 1;
    const self = interpolateSelf(aSelfRows, b.t - clockSkewMs - D);
    if (self != null) hit += 1;
  }
  return { looked, hit, overlap: looked > 0 ? hit / looked : 0 };
}

export function computeDeffResidualFromSeries(
  aSelfRows,
  bPeerRows,
  { clockSkewMs = 0, maxDelayMs = 800, delayStepMs = 20, minOverlapRatio = 0.7 } = {},
) {
  let bestD = 0;
  let bestRmse = Infinity;
  let bestErrs = [];
  let bestAligned = [];
  let bestOverlap = 0;

  for (let D = 0; D <= maxDelayMs; D += delayStepMs) {
    const errs = [];
    const aligned = [];
    let looked = 0;
    for (const b of bPeerRows) {
      looked += 1;
      const tTruth = b.t - clockSkewMs - D;
      const self = interpolateSelf(aSelfRows, tTruth);
      if (self == null) continue;
      const e = b.disp - self;
      errs.push(e);
      aligned.push({
        t: b.t,
        self,
        newest: b.newest,
        disp: b.disp,
        age: b.age,
        buf: b.buf,
        spd: b.spd,
        err: e,
      });
    }
    const overlap = looked > 0 ? errs.length / looked : 0;
    // S3-DIAG §2: 최소 겹침 비율 미달 D 는 후보 제외
    if (overlap < minOverlapRatio) continue;
    if (errs.length < 5) continue;
    const r = rmse(errs);
    if (r < bestRmse) {
      bestRmse = r;
      bestD = D;
      bestErrs = errs;
      bestAligned = aligned;
      bestOverlap = overlap;
    }
  }

  const abs = bestErrs.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const insufficient = bestErrs.length < 5;
  return {
    D_eff: insufficient ? null : bestD,
    residualRmse: insufficient ? NaN : bestRmse,
    residualP95: percentile(abs, 0.95),
    residualMax: abs.length ? abs[abs.length - 1] : NaN,
    n: bestErrs.length,
    overlap: bestOverlap,
    status: insufficient ? "D_eff 산출 불가" : "ok",
    aligned: bestAligned,
  };
}

export function formatAlignedTable(aligned) {
  const lines = ["t(ms)   A.self   B.newest   B.disp   B.age   B.buf   B.spd"];
  for (const r of aligned) {
    lines.push(
      `${r.t}   ${r.self.toFixed(1)}   ${r.newest.toFixed(1)}   ${r.disp.toFixed(1)}   ${r.age}   ${r.buf}   ${r.spd}`,
    );
  }
  return lines.join("\n");
}

export const S1_LIMITS = {
  D_eff_ms: 350,
  residualRmse_m: 1.0,
  residualMax_m: 2.5,
};

export function judgeCase(metrics) {
  if (metrics.status === "D_eff 산출 불가" || metrics.D_eff == null) {
    return { pass: false, fail: ["D_eff 산출 불가"], status: "D_eff 산출 불가" };
  }
  const fail = [];
  if (!(metrics.D_eff <= S1_LIMITS.D_eff_ms)) fail.push(`D_eff ${metrics.D_eff} > ${S1_LIMITS.D_eff_ms}`);
  if (!(metrics.residualRmse <= S1_LIMITS.residualRmse_m))
    fail.push(`RMSE ${metrics.residualRmse?.toFixed(3)} > ${S1_LIMITS.residualRmse_m}`);
  if (!(metrics.residualMax <= S1_LIMITS.residualMax_m))
    fail.push(`max ${metrics.residualMax?.toFixed(3)} > ${S1_LIMITS.residualMax_m}`);
  return { pass: fail.length === 0, fail };
}

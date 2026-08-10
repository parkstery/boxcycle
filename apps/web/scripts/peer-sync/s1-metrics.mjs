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
  if (t <= rows[0].t) return rows[0].self;
  if (t >= rows[rows.length - 1].t) return rows[rows.length - 1].self;
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

export function computeDeffResidualFromSeries(
  aSelfRows,
  bPeerRows,
  { clockSkewMs = 0, maxDelayMs = 800, delayStepMs = 20 } = {},
) {
  let bestD = 0;
  let bestRmse = Infinity;
  let bestErrs = [];
  let bestAligned = [];

  for (let D = 0; D <= maxDelayMs; D += delayStepMs) {
    const errs = [];
    const aligned = [];
    for (const b of bPeerRows) {
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
    if (errs.length < 5) continue;
    const r = rmse(errs);
    if (r < bestRmse) {
      bestRmse = r;
      bestD = D;
      bestErrs = errs;
      bestAligned = aligned;
    }
  }

  const abs = bestErrs.map((e) => Math.abs(e)).sort((a, b) => a - b);
  return {
    D_eff: bestD,
    residualRmse: bestErrs.length ? bestRmse : NaN,
    residualP95: percentile(abs, 0.95),
    residualMax: abs.length ? abs[abs.length - 1] : NaN,
    n: bestErrs.length,
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
  const fail = [];
  if (!(metrics.D_eff <= S1_LIMITS.D_eff_ms)) fail.push(`D_eff ${metrics.D_eff} > ${S1_LIMITS.D_eff_ms}`);
  if (!(metrics.residualRmse <= S1_LIMITS.residualRmse_m))
    fail.push(`RMSE ${metrics.residualRmse?.toFixed(3)} > ${S1_LIMITS.residualRmse_m}`);
  if (!(metrics.residualMax <= S1_LIMITS.residualMax_m))
    fail.push(`max ${metrics.residualMax?.toFixed(3)} > ${S1_LIMITS.residualMax_m}`);
  return { pass: fail.length === 0, fail };
}

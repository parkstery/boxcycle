/**
 * S4-5 하네스 게이트. 기존 invariants.mjs 는 수정하지 않는다.
 *
 * ② recv-jitter: 송신 등속 대비 렌더 구간 속도 이탈.
 * ③ gap_px: 화면 층 대리값. 진짜 지도 투영이 아니다. 합격선 없음 — 수치만 남긴다.
 */

/**
 * 대리 축척 (진짜 투영 아님).
 * 출처: S4-5 INSTRUCTION §3 — R7 창 실측 94 px / 3.22 m = 29.2 px/m.
 */
export const GAP_PX_PER_M_PROXY = 29.2;
export const GAP_PX_PROXY_NOTE =
  "대리값. 지도 투영이 아니다. 출처: S4-5 INSTRUCTION §3, R7 창 94 px / 3.22 m = 29.2 px/m.";

export function seriesStats(xs) {
  if (!xs.length) {
    return { n: 0, min: 0, max: 0, peakToPeak: 0, reverseCount: 0, maxAbsDelta: 0 };
  }
  const deltas = [];
  for (let i = 1; i < xs.length; i += 1) deltas.push(xs[i] - xs[i - 1]);
  let reverseCount = 0;
  for (let i = 1; i < deltas.length; i += 1) {
    if (deltas[i] * deltas[i - 1] < 0) reverseCount += 1;
  }
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  return {
    n: xs.length,
    min,
    max,
    peakToPeak: max - min,
    reverseCount,
    maxAbsDelta: deltas.length ? Math.max(...deltas.map((d) => Math.abs(d))) : 0,
  };
}

/**
 * 송신 등속 대비 렌더 구간 속도. 기존 clamp/역행/순간이동 불변식과 별개.
 * 창: 버퍼가 DELAY 를 채운 뒤 ~ 마지막 패킷 전 (stall 꼬리 제외).
 */
export function checkRecvJitter(result, spec) {
  const v = [];
  const sendSpeed = spec.sendSpeedMps;
  const maxRel = spec.maxRelSpeedErr;
  const lastSent = result.sent[result.sent.length - 1];
  const live = result.timeline.filter(
    (p) =>
      p.phase === "live" &&
      p.tMs >= 800 &&
      p.tMs <= lastSent.tMs - 200,
  );
  if (live.length < 8) {
    v.push(`recv-jitter: 표본 부족 n=${live.length}`);
    return v;
  }
  let maxRelSeen = 0;
  let worst = null;
  for (let i = 1; i < live.length; i += 1) {
    const dtSec = (live[i].tMs - live[i - 1].tMs) / 1000;
    if (dtSec < 0.005) continue;
    const speed = (live[i].displayDistM - live[i - 1].displayDistM) / dtSec;
    const rel = sendSpeed > 0.02 ? Math.abs(speed - sendSpeed) / sendSpeed : 0;
    if (rel > maxRelSeen) {
      maxRelSeen = rel;
      worst = { tMs: live[i].tMs, speed, rel };
    }
  }
  if (maxRelSeen > maxRel) {
    v.push(
      `recv-jitter 구간속도 ${(worst.speed * 3.6).toFixed(2)}km/h ` +
        `(송신 ${(sendSpeed * 3.6).toFixed(2)}km/h 대비 rel=${maxRelSeen.toFixed(3)} > ${maxRel}) ` +
        `@ t=${worst.tMs}ms`,
    );
  }
  return v;
}

/**
 * gap_px(t) = (peer_dist(t) − self_dist(t)) × 29.2
 * self 는 송신 격자 진실(지연·지터 없음). 합격선 없음.
 */
export function measureGapPx(result, spec) {
  const pxPerM = spec.pxPerM ?? GAP_PX_PER_M_PROXY;
  const speed = spec.sendSpeedMps;
  const selfStart = spec.selfStartDistM ?? 0;
  const lastSent = result.sent[result.sent.length - 1];
  const rows = [];
  for (const p of result.timeline) {
    if (p.phase !== "live") continue;
    if (p.tMs < 800 || p.tMs > lastSent.tMs - 200) continue;
    const selfDist = selfStart + speed * (p.tMs / 1000);
    const gapM = p.displayDistM - selfDist;
    rows.push({ tMs: p.tMs, peerDistM: p.displayDistM, selfDistM: selfDist, gapM, gapPx: gapM * pxPerM });
  }
  const stats = seriesStats(rows.map((r) => r.gapPx));
  return {
    proxy: true,
    note: GAP_PX_PROXY_NOTE,
    pxPerM,
    sendSpeedMps: speed,
    selfStartDistM: selfStart,
    sampleCount: rows.length,
    reverseCount: stats.reverseCount,
    maxAbsDeltaPx: stats.maxAbsDelta,
    peakToPeakPx: stats.peakToPeak,
    minGapPx: stats.min,
    maxGapPx: stats.max,
  };
}

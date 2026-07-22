// 재생된 타임라인이 integrator.ts 가 문서로 약속한 계약을 지키는지 기계적으로 판정한다.
// 하나라도 어기면 replay.mjs 가 exit 1. "느낌"이 아니라 YES/NO.
//
// 계약 근거는 src/lib/peerMotion/integrator.ts 주석:
//  - stepPeerMotionEntity 는 보간만(외삽 아님) → live 구간 역행 없음, 급점프 없음
//  - stall 시 newest 속도로 PEER_INTERP_MAX_EXTRAP_MS 만큼만 외삽 후 hold
//  - displayDistM 은 항상 [0, routeLenM] 로 clamp

/** live 구간에서 displayDistM 이 역행하면 안 된다(보간은 단조 전진 소스에 대해 단조). */
function checkNoBacktrack(result) {
  const v = [];
  const t = result.timeline;
  // 원본 패킷이 단조 전진일 때만 이 불변식이 성립 — sent 가 단조인지 먼저 본다.
  const sentMonotonic = result.sent.every(
    (s, i) => i === 0 || s.distM >= result.sent[i - 1].distM - 0.05,
  );
  if (!sentMonotonic) return v; // 원본이 후퇴하면 검사 제외(별도 시나리오가 다룸)

  for (let i = 1; i < t.length; i += 1) {
    if (t[i].phase !== "live") continue;
    const back = t[i - 1].displayDistM - t[i].displayDistM;
    if (back > 0.5) {
      v.push(
        `live 역행 ${back.toFixed(2)}m @ t=${t[i].tMs}ms (${t[i - 1].displayDistM.toFixed(1)}→${t[i].displayDistM.toFixed(1)})`,
      );
      break; // 첫 위반만 보고
    }
  }
  return v;
}

/** displayDistM 은 항상 [0, routeLenM] 범위. */
function checkClamp(result) {
  const v = [];
  for (const p of result.timeline) {
    if (p.displayDistM < -0.01 || p.displayDistM > result.routeLenM + 0.01) {
      v.push(
        `clamp 위반 ${p.displayDistM.toFixed(2)}m (route ${result.routeLenM}m) @ t=${p.tMs}ms`,
      );
      break;
    }
  }
  return v;
}

/**
 * 한 스텝에 비현실적 점프가 없어야 한다(보간이므로 부드러움). 상한 = 85km/h × dt × 여유2.
 * 단 원본 패킷이 그 시각 부근에서 불연속(stall 재개 등)이면, 렌더가 그 위치로 따라잡는 점프는
 * 정당하므로 제외한다 — 원본 국소 점프를 상한에 더한다.
 */
function checkNoTeleport(result, stepMs = 100) {
  const v = [];
  const maxMps = 85 / 3.6;
  const baseJump = maxMps * (stepMs / 1000) * 2 + 0.5;
  const t = result.timeline;
  const sent = result.sent;

  // 특정 렌더 시각 주변 ±1s 에서 원본 패킷 distM 이 얼마나 크게 뛰었는지
  function sentJumpNear(tMs) {
    let maxGap = 0;
    for (let k = 1; k < sent.length; k += 1) {
      if (sent[k].tMs < tMs - 1000 || sent[k].tMs > tMs + 1000) continue;
      const gap = Math.abs(sent[k].distM - sent[k - 1].distM);
      if (gap > maxGap) maxGap = gap;
    }
    return maxGap;
  }

  for (let i = 1; i < t.length; i += 1) {
    if (t[i].phase !== "live") continue;
    const jump = Math.abs(t[i].displayDistM - t[i - 1].displayDistM);
    const allowed = baseJump + sentJumpNear(t[i].tMs);
    if (jump > allowed) {
      v.push(
        `순간이동 ${jump.toFixed(2)}m/step (상한 ${allowed.toFixed(2)}) @ t=${t[i].tMs}ms`,
      );
      break;
    }
  }
  return v;
}

/**
 * stall(패킷 끊김) 후 displayDistM 이 무한 외삽되지 않아야 한다.
 * 마지막 패킷 이후 렌더 거리 증가분이 (외삽상한 + 지연) 동안 newest 속도 × 상한 을 크게 넘지 않는다.
 */
function checkExtrapCapped(result, policy) {
  const v = [];
  const t = result.timeline;
  if (!t.length) return v;
  const lastSent = result.sent[result.sent.length - 1];
  const extrapMax = policy.PEER_INTERP_MAX_EXTRAP_MS ?? 1200;
  // 마지막 패킷 시각 이후 구간에서 최종 displayDistM
  const afterStall = t.filter((p) => p.tMs > lastSent.tMs + 500 && p.phase === "live");
  if (afterStall.length < 2) return v;
  const last = afterStall[afterStall.length - 1];
  // 외삽 상한을 감안한 이론 최대: lastSent.distM + speed*extrapMax
  const speedGuess = result.timeline.find((p) => p.tMs >= lastSent.tMs)?.speedMps ?? 0;
  const theoreticalMax = lastSent.distM + speedGuess * (extrapMax / 1000) + 2;
  if (last.displayDistM > theoreticalMax) {
    v.push(
      `외삽 미제한: stall 후 ${last.displayDistM.toFixed(1)}m > 이론상한 ${theoreticalMax.toFixed(1)}m`,
    );
  }
  return v;
}

export function checkInvariants(result, policy) {
  return [
    ...checkClamp(result),
    ...checkNoBacktrack(result),
    ...checkNoTeleport(result),
    ...checkExtrapCapped(result, policy),
  ];
}

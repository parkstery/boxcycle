import { offsetLngLatLateral, type LngLat } from "../geo/geo";
import { publishRiderLateralOffsets } from "./overtakeThumbsRuntime";
import { resolveGlbPedalPose } from "../rider/riderGlbPedalPose";
import { RiderTurnSmoother, RIDER_TURN_HEADING_TAU_ROUTE_S, shortestAngleDeltaDeg } from "../rider/riderTurn";
import type { RiderGlbModelSpec } from "./iso2dMarker";

export type PassingRider = { uid: string; distanceM: number; speedMps: number; headingDeg: number; fresh?: boolean };
type PassingState = { offsetM: number; passingUid: string | null; lateralMps?: number; targetM?: number; speedEmaMps?: number };
/**
 * 옆 움직임 = 임계 감쇠 스프링(11-28 2차). 등속 켜짐/꺼짐은 시작·끝에서 몸 방향이 5~7° 꺾였고,
 * 「최대 감속」 제어는 목표 근처에서 프레임마다 ±7.3° 뒤집혔다(실앱 기록). 스프링은 목표를 넘지 않고
 * 미끄러지듯 멈추며, 1/60초 소단계로 적분해 프레임 간격(0.03~0.5초)과 무관하게 같은 궤적을 만든다.
 */
const LATERAL_ACCEL_MPS2 = 1.5;
const LATERAL_SPRING_RAD_S = 6;
const LATERAL_SUBSTEP_S = 1 / 60;
/**
 * 차선 판단용 속도 평활(11-28 3차). 목표 차선이 순간 속도 차로 정해지면 센서·경사로 1초마다 출렁이는
 * 속도(±0.4m/s)에 진입·진출 경계가 앞뒤로 움직여 자전거가 좌우로 3~8번 흔들렸다. 판단은 평활 속도로,
 * 한 번의 추월 안에서 목표는 나란해질 때까지 바깥으로만, 지난 뒤에는 안쪽으로만 움직인다.
 */
const DECISION_SPEED_TAU_S = 1.5;
type PeerDisplayFeature = { geometry: { coordinates: LngLat }; properties: {
  id: string; phaseRev: number; hdg: number; speedMps?: number; displayDistM?: number;
} };
const smoothstep = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
const compareUid = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** 위치·속도 패킷은 유지하고 라이더 메시의 옆 위치와 접선 방향만 보정한다. 왼쪽은 음수. */
export class RiderPassingMotion {
  private readonly states = new Map<string, PassingState>();

  update(riders: readonly PassingRider[], dtSec: number): Map<string, { offsetM: number; headingOffsetDeg: number }> {
    const dt = Number.isFinite(dtSec) ? Math.max(0, Math.min(0.5, dtSec)) : 0;
    const blend = 1 - Math.exp(-dt / DECISION_SPEED_TAU_S);
    const valid = riders.filter((r) => r.fresh !== false && Number.isFinite(r.distanceM) && Number.isFinite(r.speedMps))
      .map((r) => {
        const state = this.states.get(r.uid);
        const ema = state?.speedEmaMps ?? r.speedMps;
        const speedMps = ema + (r.speedMps - ema) * blend;
        if (state) state.speedEmaMps = speedMps;
        return { ...r, speedMps };
      });
    const live = new Set(riders.map((r) => r.uid));
    for (const uid of this.states.keys()) if (!live.has(uid)) this.states.delete(uid);
    const targets = new Map<string, number>();
    // 느린 라이더의 차선을 먼저 정해 다중 추월에서도 결정적인 배치를 만든다.
    const ordered = [...valid].sort((a, b) => a.speedMps - b.speedMps || compareUid(a.uid, b.uid));
    for (const me of ordered) {
      const previous = this.states.get(me.uid);
      const staleTarget = riders.find((r) => r.uid === previous?.passingUid && r.fresh === false);
      if (previous && staleTarget && Math.abs(staleTarget.distanceM - me.distanceM) <= 12) {
        targets.set(me.uid, previous.offsetM);
        continue;
      }
      const retainedTarget = valid.find((r) => r.uid === previous?.passingUid);
      if (previous && retainedTarget) {
        const relative = me.speedMps - retainedTarget.speedMps;
        const yielding = relative < -0.15 || (Math.abs(relative) <= 0.15 && compareUid(me.uid, retainedTarget.uid) < 0);
        const clearM = Math.max(3, Math.min(8, Math.abs(relative) * 1.5 + 3));
        if (yielding && Math.abs(retainedTarget.distanceM - me.distanceM) <= clearM) {
          // 추월 주체가 역전되면 현재 차선에서 양보한다. 서로 상대의 왼쪽을 쫓지 않는다.
          targets.set(me.uid, previous.offsetM);
          continue;
        }
      }
      let candidate: PassingRider | null = null;
      let weight = 0;
      for (const other of valid) {
        if (other.uid === me.uid || Math.abs(shortestAngleDeltaDeg(me.headingDeg, other.headingDeg)) > 45) continue;
        const relative = me.speedMps - other.speedMps;
        const gap = other.distanceM - me.distanceM;
        const approaching = relative > 0.15;
        const tied = Math.abs(relative) <= 0.15 && compareUid(me.uid, other.uid) > 0 && Math.abs(gap) < 1.5;
        const retained = previous?.passingUid === other.uid;
        if (!approaching && !tied && !retained) continue;
        const approachM = Math.max(4, Math.min(12, Math.max(0, relative) * 2 + 2));
        const clearM = Math.max(3, Math.min(8, Math.max(0, relative) * 1.5 + 3));
        // 이미 앞서 멀어지는 상대로 새 추월을 시작하지 않는다(진출 경계 출렁임으로 다시 나가는 것 방지).
        // 진행 중인 추월은 2m 더 멀어져야 놓는다(경계에서 들락날락하며 좌우로 오가지 않게).
        // 확실히 느려져(1.8km/h 이상) 뒤로 처지거나 상대가 나를 앞질러 가면 바로 놓는다.
        const holdM = retained && relative > -0.5 ? 2 : 0;
        if (gap > approachM + holdM || gap < -clearM || (!retained && gap < -1.5)) continue;
        const strength = tied ? 1 : gap >= 1.5
          ? smoothstep((approachM - gap) / Math.max(1, (approachM - 1.5) / 2))
          : gap >= -1.5 ? 1 : smoothstep((clearM + gap) / (clearM - 1.5));
        const lane = Math.min(targets.get(other.uid) ?? 0, this.states.get(other.uid)?.offsetM ?? 0);
        const oldLane = candidate ? Math.min(targets.get(candidate.uid) ?? 0, this.states.get(candidate.uid)?.offsetM ?? 0) : 0;
        if (strength > weight || (retained && !candidate) || (strength === weight && candidate
          && (lane < oldLane || (lane === oldLane && compareUid(other.uid, candidate.uid) < 0)))) {
          candidate = other; weight = strength;
        }
      }
      const occupiedLane = candidate ? Math.min(targets.get(candidate.uid) ?? 0, this.states.get(candidate.uid)?.offsetM ?? 0) : 0;
      const clearOnRight = previous && candidate && previous.offsetM - occupiedLane >= 0.85;
      // 이미 오른쪽에서 충분히 떨어져 있으면 상대 레인을 가로질러 왼쪽으로 바꾸지 않는다.
      let target = clearOnRight ? previous.offsetM : candidate ? Math.max(-2.25, occupiedLane - 1) * weight : 0;
      if (candidate && !clearOnRight && previous?.passingUid === candidate.uid && previous.targetM != null) {
        // 같은 추월 안: 나란해지기 전엔 바깥(왼쪽)으로만, 지난 뒤엔 안쪽으로만. 속도 출렁임이 좌우 왕복을 만들지 않는다.
        target = candidate.distanceM - me.distanceM >= -1.5 ? Math.min(previous.targetM, target) : Math.max(previous.targetM, target);
      }
      targets.set(me.uid, target);
      // 새 메시의 첫 배치는 목표 차선에서 시작한다. 이미 보이는 메시는 절대 순간 이동하지 않는다.
      const state = previous ?? { offsetM: target, passingUid: null };
      state.passingUid = candidate?.uid ?? null;
      state.targetM = target;
      state.speedEmaMps = me.speedMps;
      this.states.set(me.uid, state);
    }
    const output = new Map<string, { offsetM: number; headingOffsetDeg: number }>();
    for (const me of riders) {
      const state = this.states.get(me.uid) ?? { offsetM: 0, passingUid: null };
      const target = targets.get(me.uid) ?? (me.fresh === false ? state.offsetM : 0);
      // 정지하면 기존 옆 위치를 유지한다. 제자리에서 미끄러져 중앙으로 돌아가지 않는다.
      const rate = me.speedMps > 0.05 ? Math.min(0.8, Math.max(0.25, me.speedMps * 0.07)) : 0;
      // 서서히 출발하고 목표 앞에서 서서히 멈춘다: 남은 거리로 멈출 수 있는 속도를 넘지 않게 하고
      // 옆속도 변화를 가속도 상한으로 묶는다. 몸 방향은 이 연속 옆속도에서 나오므로 한 프레임에 꺾이지 않는다.
      let lateral = state.lateralMps ?? 0;
      const steps = dt > 0 ? Math.ceil(dt / LATERAL_SUBSTEP_S - 1e-9) : 0;
      const h = steps > 0 ? dt / steps : 0;
      // 정지 중에는 끌어당기지 않고(제자리 옆미끄럼 금지) 남은 옆속도만 감쇠한다.
      const pull = rate > 0 ? LATERAL_SPRING_RAD_S * LATERAL_SPRING_RAD_S : 0;
      for (let i = 0; i < steps; i++) {
        const accel = pull * (target - state.offsetM) - 2 * LATERAL_SPRING_RAD_S * lateral;
        lateral += Math.max(-LATERAL_ACCEL_MPS2, Math.min(LATERAL_ACCEL_MPS2, accel)) * h;
        const limit = rate > 0 ? rate : Math.abs(lateral);
        lateral = Math.max(-limit, Math.min(limit, lateral));
        state.offsetM += lateral * h;
      }
      if (Math.abs(target - state.offsetM) < 0.002 && Math.abs(lateral) < 0.01) { state.offsetM = target; lateral = 0; }
      state.lateralMps = lateral;
      this.states.set(me.uid, state);
      output.set(me.uid, { offsetM: state.offsetM, headingOffsetDeg: me.speedMps > 0.05
        ? Math.atan2(lateral, me.speedMps) * 180 / Math.PI : 0 });
    }
    return output;
  }

  apply(specs: RiderGlbModelSpec[], selfUid: string | undefined, selfDistanceM: number | null,
    peers: readonly PeerDisplayFeature[], fresh: (uid: string) => boolean, dt: number,
    markers: { geometry: { coordinates: LngLat }; properties: { id: string } }[]): void {
    const distances = new Map(peers.map((p) => [p.properties.id, p.properties.displayDistM]));
    const riders = specs.filter((s) => s.kind !== "pacer").flatMap((s) => {
      const distanceM = s.id === "live-self" ? selfDistanceM : distances.get(s.id);
      return distanceM == null ? [] : [{ uid: s.id === "live-self" ? selfUid ?? "local-self" : s.id,
        distanceM, speedMps: s.speedMps ?? 0, headingDeg: s.bearingDeg, fresh: s.id === "live-self" || fresh(s.id) }];
    });
    const positions = this.update(riders, dt);
    const selfKey = selfUid ?? "local-self";
    publishRiderLateralOffsets(positions.get(selfKey)?.offsetM ?? null,
      new Map([...positions].filter(([uid]) => uid !== selfKey).map(([uid, pose]) => [uid, pose.offsetM])));
    for (const spec of specs) {
      if (spec.kind === "pacer") continue;
      const pose = positions.get(spec.id === "live-self" ? selfUid ?? "local-self" : spec.id);
      if (!pose) continue;
      spec.lngLat = offsetLngLatLateral(spec.lngLat, spec.bearingDeg, pose.offsetM);
      spec.bearingDeg = (spec.bearingDeg + pose.headingOffsetDeg + 360) % 360;
    }
    const positionsById = new Map(specs.map((spec) => [spec.id, spec.lngLat]));
    for (const marker of markers) {
      const position = positionsById.get(marker.properties.id);
      if (position) marker.geometry.coordinates = position;
    }
  }
}

/** 동행 조립을 레이어 밖으로 분리해 passing 배선이 MapView 크기 상한을 늘리지 않게 한다. */
export function appendPeerDisplaySpecs(specs: RiderGlbModelSpec[], features: readonly PeerDisplayFeature[],
  turns: RiderTurnSmoother, previousDistances: Map<string, number>, dt: number, turnDt: number, liveIds: string[]): void {
  for (const f of features) {
    const p = f.properties;
    let speed = 0;
    if (typeof p.speedMps === "number" && Number.isFinite(p.speedMps)) speed = Math.max(0, p.speedMps);
    else if (typeof p.displayDistM === "number" && Number.isFinite(p.displayDistM)) {
      const previous = previousDistances.get(p.id);
      previousDistances.set(p.id, p.displayDistM);
      if (previous != null && dt > 0) speed = Math.max(0, (p.displayDistM - previous) / dt);
    }
    const turn = turns.update(p.id, p.hdg, speed, turnDt, RIDER_TURN_HEADING_TAU_ROUTE_S);
    specs.push({ id: p.id, kind: "peer", lngLat: f.geometry.coordinates, bearingDeg: turn.headingDeg,
      pedalPose: resolveGlbPedalPose(p.phaseRev), phaseRev: p.phaseRev, leanDeg: turn.leanDeg, speedMps: speed });
    liveIds.push(p.id);
  }
}

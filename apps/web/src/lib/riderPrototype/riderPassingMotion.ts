import { offsetLngLatLateral, type LngLat } from "../geo/geo";
import { publishRiderLateralOffsets } from "./overtakeThumbsRuntime";
import { resolveGlbPedalPose } from "../rider/riderGlbPedalPose";
import { RiderTurnSmoother, RIDER_TURN_HEADING_TAU_ROUTE_S, shortestAngleDeltaDeg } from "../rider/riderTurn";
import type { RiderGlbModelSpec } from "./iso2dMarker";

export type PassingRider = { uid: string; distanceM: number; speedMps: number; headingDeg: number; fresh?: boolean };
type PassingState = { offsetM: number; passingUid: string | null; lateralMps?: number };
/** 옆 움직임 가속도 상한(m/s²). 켜짐/꺼짐식 등속 이동은 시작·끝에서 몸 방향이 한 프레임에 5~7° 꺾였다(11-28 실측). */
const LATERAL_ACCEL_MPS2 = 1.5;
type PeerDisplayFeature = { geometry: { coordinates: LngLat }; properties: {
  id: string; phaseRev: number; hdg: number; speedMps?: number; displayDistM?: number;
} };
const smoothstep = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
const compareUid = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** 위치·속도 패킷은 유지하고 라이더 메시의 옆 위치와 접선 방향만 보정한다. 왼쪽은 음수. */
export class RiderPassingMotion {
  private readonly states = new Map<string, PassingState>();

  update(riders: readonly PassingRider[], dtSec: number): Map<string, { offsetM: number; headingOffsetDeg: number }> {
    const valid = riders.filter((r) => r.fresh !== false && Number.isFinite(r.distanceM) && Number.isFinite(r.speedMps));
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
        if (gap > approachM || gap < -clearM) continue;
        const strength = tied ? 1 : gap >= 1.5
          ? smoothstep((approachM - gap) / Math.min(1, approachM - 1.5))
          : gap >= -1.5 ? 1 : smoothstep((clearM + gap) / (clearM - 1.5));
        const lane = Math.min(targets.get(other.uid) ?? 0, this.states.get(other.uid)?.offsetM ?? 0);
        const oldLane = candidate ? Math.min(targets.get(candidate.uid) ?? 0, this.states.get(candidate.uid)?.offsetM ?? 0) : 0;
        if (strength > weight || (strength === weight && candidate
          && (lane < oldLane || (lane === oldLane && compareUid(other.uid, candidate.uid) < 0)))) {
          candidate = other; weight = strength;
        }
      }
      const occupiedLane = candidate ? Math.min(targets.get(candidate.uid) ?? 0, this.states.get(candidate.uid)?.offsetM ?? 0) : 0;
      const clearOnRight = previous && candidate && previous.offsetM - occupiedLane >= 0.85;
      // 이미 오른쪽에서 충분히 떨어져 있으면 상대 레인을 가로질러 왼쪽으로 바꾸지 않는다.
      targets.set(me.uid, clearOnRight ? previous.offsetM : candidate ? Math.max(-2.25, occupiedLane - 1) * weight : 0);
      // 새 메시의 첫 배치는 목표 차선에서 시작한다. 이미 보이는 메시는 절대 순간 이동하지 않는다.
      const state = previous ?? { offsetM: targets.get(me.uid) ?? 0, passingUid: null };
      state.passingUid = candidate?.uid ?? null;
      this.states.set(me.uid, state);
    }
    const output = new Map<string, { offsetM: number; headingOffsetDeg: number }>();
    const dt = Number.isFinite(dtSec) ? Math.max(0, Math.min(0.5, dtSec)) : 0;
    for (const me of riders) {
      const state = this.states.get(me.uid) ?? { offsetM: 0, passingUid: null };
      const target = targets.get(me.uid) ?? (me.fresh === false ? state.offsetM : 0);
      // 정지하면 기존 옆 위치를 유지한다. 제자리에서 미끄러져 중앙으로 돌아가지 않는다.
      const rate = me.speedMps > 0.05 ? Math.min(0.8, Math.max(0.25, me.speedMps * 0.07)) : 0;
      // 서서히 출발하고 목표 앞에서 서서히 멈춘다: 남은 거리로 멈출 수 있는 속도를 넘지 않게 하고
      // 옆속도 변화를 가속도 상한으로 묶는다. 몸 방향은 이 연속 옆속도에서 나오므로 한 프레임에 꺾이지 않는다.
      const error = target - state.offsetM;
      const current = state.lateralMps ?? 0;
      const step = LATERAL_ACCEL_MPS2 * dt;
      let lateral: number;
      if (Math.abs(error) < 0.003 && Math.abs(current) <= step) {
        // 충분히 가깝고 느려졌으면 목표에 붙여 멈춘다(옆속도 변화도 한 프레임 가속 이내).
        state.offsetM = target; lateral = 0;
      } else {
        const brake = Math.sqrt(2 * LATERAL_ACCEL_MPS2 * Math.abs(error));
        const desired = Math.sign(error) * Math.min(rate, brake);
        lateral = current + Math.max(-step, Math.min(step, desired - current));
        if (rate === 0 && Math.abs(lateral) <= step) lateral = 0;
        state.offsetM += lateral * dt;
      }
      state.lateralMps = lateral;
      this.states.set(me.uid, state);
      output.set(me.uid, { offsetM: state.offsetM, headingOffsetDeg: dt > 0 && me.speedMps > 0.05
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

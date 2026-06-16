/** Mapbox model-rotation — [pitch, roll, yaw] degrees */
export type GlbNodeRotationDeg = [number, number, number];

export type RiderGlbPedalPose = {
  crankRotationDeg: number;
  legLRotationDeg: GlbNodeRotationDeg;
  legRRotationDeg: GlbNodeRotationDeg;
  legLShinRotationDeg: GlbNodeRotationDeg;
  legRShinRotationDeg: GlbNodeRotationDeg;
};

/** phaseRev 0~1 — 크랭크·허벅지·정강이 Z축 회전(좌표 +X 전진, +Y 위, +Z 좌우) */
export function resolveGlbPedalPose(phaseRev: number): RiderGlbPedalPose {
  const phase = ((phaseRev % 1) + 1) % 1;
  const θ = phase * Math.PI * 2;
  const crankRotationDeg = -phase * 360;

  const thighSwing = 38;
  const kneeMax = 62;
  const thighBase = -22;

  const thighR = Math.sin(θ) * thighSwing + thighBase;
  const shinR = Math.max(0, -Math.cos(θ)) * kneeMax;
  const thighL = Math.sin(θ + Math.PI) * thighSwing + thighBase;
  const shinL = Math.max(0, -Math.cos(θ + Math.PI)) * kneeMax;

  return {
    crankRotationDeg,
    legLRotationDeg: [0, 0, thighL],
    legRRotationDeg: [0, 0, thighR],
    legLShinRotationDeg: [0, 0, shinL],
    legRShinRotationDeg: [0, 0, shinR],
  };
}

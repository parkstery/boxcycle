/**
 * RIDE-RETURN-EXPERIMENT-4 — 재방문 실험용 호환 조합 안내(정적).
 * 미검증 조합은 「권장·검증됨」으로 표기하지 않는다.
 */

export type CompatibilityTier = "verified" | "supported" | "limited";

export type CompatibilityRow = {
  tier: CompatibilityTier;
  label: string;
  note: string;
};

/** 팀 실사용·E2E 로 확인한 조합 */
export const VERIFIED_DEVICE_ROWS: CompatibilityRow[] = [
  {
    tier: "verified",
    label: "Android + Chrome (HTTPS)",
    note: "폰 실사용 검증(4A). Guest·자전거 프로필·케이던스/체험 속도.",
  },
  {
    tier: "verified",
    label: "BLE CSC 표준 케이던스 센서",
    note: "서비스 0x1816 · CYCPLUS 등 팀 검증 장치. 다른 브랜드는 연결을 보장하지 않습니다.",
  },
];

/** 개발·데스크톱에서 동작 확인했으나 대규모 실험 전제는 아님 */
export const RECOMMENDED_DEVICE_ROWS: CompatibilityRow[] = [
  {
    tier: "supported",
    label: "Windows · macOS + Chrome 또는 Edge (HTTPS)",
    note: "Web Bluetooth 지원 브라우저. localhost 또는 배포 URL.",
  },
  {
    tier: "supported",
    label: "센서 없음 — 체험 속도",
    note: "모든 플랫폼에서 주행 입력 준비 가능. 재방문 실험의 최소 경로.",
  },
];

/** 제한·미검증 — 보장 문구 금지 */
export const LIMITED_DEVICE_ROWS: CompatibilityRow[] = [
  {
    tier: "limited",
    label: "iOS · iPadOS Safari",
    note: "Web Bluetooth 미지원. 체험 속도만 가능하며, 센서 실험 대상에서 제외합니다.",
  },
  {
    tier: "limited",
    label: "Firefox · 기타 브라우저",
    note: "Web Bluetooth 미지원 또는 제한적. 연결 성공을 보장하지 않습니다.",
  },
];

export function compatibilityGuideSections(): Array<{
  heading: string;
  rows: CompatibilityRow[];
}> {
  return [
    { heading: "검증됨", rows: VERIFIED_DEVICE_ROWS },
    { heading: "권장(데스크톱·개발)", rows: RECOMMENDED_DEVICE_ROWS },
    { heading: "제한·미검증", rows: LIMITED_DEVICE_ROWS },
  ];
}

const METRO = /(특별시|광역시|특별자치시|특별자치도)$/;
const PROVINCES = new Set(["경기도", "강원도", "충청북도", "충청남도", "전라북도", "전라남도", "경상북도", "경상남도", "제주도"]);
const DISTRICT = /(시|군|구)$/;

/**
 * 좁은 줄 목록용 짧은 이름 — 앞의 행정 구역(대한민국·시도·시군구)만 걷어낸다.
 * 「대한민국 서울특별시 용산구 이태원로 22」→「이태원로 22」. 「여의도 한 바퀴」처럼 행정 구역이 아니면 그대로.
 */
export function shortTrailPlace(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  if (parts[i] === "대한민국" && parts.length > 1) i++;
  if (i < parts.length - 1 && (METRO.test(parts[i]!) || PROVINCES.has(parts[i]!))) {
    i++;
    while (i < parts.length - 1 && DISTRICT.test(parts[i]!)) i++;
  }
  return parts.slice(i).join(" ");
}

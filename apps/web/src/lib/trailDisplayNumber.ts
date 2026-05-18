/** UI 표시용 Trail 번호 (1–999 → `001` … `999`) */
export function formatTrailDisplayNumber(displayNumber: number | null | undefined): string {
  if (displayNumber == null || !Number.isFinite(displayNumber)) return "???";
  const n = Math.max(1, Math.min(999, Math.floor(displayNumber)));
  return String(n).padStart(3, "0");
}

/** Firestore Trail 문서용 표시 번호 (충돌 시 UI에서 구분은 `trailId`) */
export function pickRandomTrailDisplayNumber(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 999) + 1;
}

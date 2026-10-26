import type { Camera1Mode } from "./camera1Mode";
import { CAMERA1_AERIAL_DISTANCE_M, CAMERA1_MODE_META } from "./camera1Mode";
import type { QuickCameraSlot } from "./quickCameraProductTune";

/** 메뉴·트리거에 쓰는 짧은 라벨(2~6자 우선). */
export function quickCameraMenuLabel(
  slot: QuickCameraSlot,
  camera1Mode: Camera1Mode | undefined,
): string {
  if (slot === 1) {
    const mode = camera1Mode ?? "routeFit";
    if (mode === "routeFit") return "전체";
    return `${CAMERA1_AERIAL_DISTANCE_M[mode]}m`;
  }
  const bySlot: Record<2 | 3 | 4 | 5 | 6, string> = {
    2: "뒤에서",
    3: "앞에서",
    4: "왼쪽",
    5: "오른쪽",
    6: "뒤고정",
  };
  return bySlot[slot];
}

export function quickCameraMenuAriaLabel(
  slot: QuickCameraSlot,
  camera1Mode: Camera1Mode | undefined,
): string {
  if (slot === 1) {
    const mode = camera1Mode ?? "routeFit";
    const meta = CAMERA1_MODE_META[mode];
    return `카메라 1 · ${meta.label}`;
  }
  const short = quickCameraMenuLabel(slot, camera1Mode);
  return `카메라 ${slot} · ${short}`;
}

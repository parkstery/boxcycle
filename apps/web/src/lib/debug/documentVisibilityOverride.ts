/**
 * DEV/test-only seam for `useDocumentVisibility`.
 * production 경로의 기본값은 바꾸지 않는다 — override 가 null 이면 document.visibilityState 만 본다.
 */

type VisibilityListener = () => void;

let overrideVisible: boolean | null = null;
const listeners = new Set<VisibilityListener>();

function isOverrideAllowed(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/** DEV only. `null` 이면 override 해제. */
export function setDocumentVisibilityOverrideForTests(next: boolean | null): void {
  if (!isOverrideAllowed()) return;
  if (overrideVisible === next) return;
  overrideVisible = next;
  for (const fn of listeners) fn();
}

export function getDocumentVisibilityOverrideForTests(): boolean | null {
  return overrideVisible;
}

export function subscribeDocumentVisibilityOverride(listener: VisibilityListener): () => void {
  if (!isOverrideAllowed()) return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 훅·하네스 공통 — override 가 있으면 그걸, 없으면 document.visibilityState */
export function resolveDocumentVisible(): boolean {
  if (overrideVisible != null) return overrideVisible;
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

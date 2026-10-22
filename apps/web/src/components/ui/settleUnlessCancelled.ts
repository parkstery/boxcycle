/**
 * 시트가 불러온 결과를 상태에 넣되, 그 사이 닫히거나 조건이 바뀌면 버린다.
 * useEffect 에서 `return settleUnlessCancelled(load(), setState)` 로 쓴다(반환값이 정리 함수).
 */
export function settleUnlessCancelled<T>(
  promise: Promise<T>,
  apply: (next: { kind: "ready"; data: T } | { kind: "error"; message: string }) => void,
): () => void {
  let cancelled = false;
  promise.then(
    (data) => {
      if (!cancelled) apply({ kind: "ready", data });
    },
    (e: unknown) => {
      if (!cancelled) apply({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    },
  );
  return () => {
    cancelled = true;
  };
}

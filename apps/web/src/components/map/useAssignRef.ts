import { useEffect } from "react";

/** 매 렌더 후 `ref.current` 를 최신 값으로 맞춘다. 효과 실행 순서는 호출 위치(선언 순서)를 따른다. */
export function useAssignRef<T>(ref: { current: T }, value: T): void {
  useEffect(() => {
    ref.current = value;
  }, [ref, value]);
}

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모달/시트 열릴 때 내부로 포커스, 닫힌 뒤 트리거로 복귀.
 * 호출은 항상 컴포넌트 최상단에서 — 조건부 hook 금지.
 */
export function useDialogFocus(open: boolean, containerRef: RefObject<HTMLElement | null>): void {
  const previousRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = containerRef.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const nodes = [
        ...(containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      ].filter((el) => el.offsetParent !== null && !el.closest("[inert]"));
      if (nodes.length === 0) return;
      const head = nodes[0];
      const tail = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      const prev = previousRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open, containerRef]);
}

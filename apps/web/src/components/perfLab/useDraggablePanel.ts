import { useRef, useState, type PointerEvent, type RefObject } from "react";

type PanelPos = { x: number; y: number };

function readSavedPos(key: string): PanelPos | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PanelPos>;
    return typeof v.x === "number" && typeof v.y === "number" ? { x: v.x, y: v.y } : null;
  } catch {
    return null;
  }
}

function savePos(key: string, pos: PanelPos | null): void {
  try {
    if (pos) window.localStorage.setItem(key, JSON.stringify(pos));
    else window.localStorage.removeItem(key);
  } catch {
    /* 저장 못 해도 이번 화면에서는 옮긴 자리에 있다 */
  }
}

/** 패널이 화면 밖으로 나가지 않게 왼쪽 위 좌표를 가둔다. */
function clampPos(pos: PanelPos, el: HTMLElement | null): PanelPos {
  const w = el?.offsetWidth ?? 120;
  const h = el?.offsetHeight ?? 48;
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - h)),
  };
}

/** 손잡이(⠿)를 끌어 패널을 옮긴다. 자리는 이 기기에 기억, 손잡이 두 번 탭이면 기본 자리. */
export function useDraggablePanel(panelRef: RefObject<HTMLElement | null>, storageKey: string) {
  const [pos, setPos] = useState<PanelPos | null>(() => readSavedPos(storageKey));
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { id: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    setPos(clampPos({ x: e.clientX - drag.dx, y: e.clientY - drag.dy }, panelRef.current));
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    dragRef.current = null;
    setPos((p) => {
      savePos(storageKey, p);
      return p;
    });
  };
  const reset = () => {
    setPos(null);
    savePos(storageKey, null);
  };
  return {
    moved: pos != null,
    style: pos ? { left: pos.x, top: pos.y } : undefined,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick: reset },
  };
}

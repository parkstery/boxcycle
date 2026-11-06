import { useEffect, useRef, useState } from "react";

type MenuPos = { top: number; left: number; maxHeight: number };

/**
 * 칩에서 body 로 띄우는 작은 메뉴의 공통 동작 — 열림·위치·바깥 누름/Esc/리사이즈 닫기.
 * 열려 있는 동안 Esc 는 메뉴만 닫는다(창 닫기로 번지지 않게 stopImmediatePropagation).
 * `menuWidth` 는 오른쪽 화면 밖으로 나가지 않게 막는 폭.
 */
export function useAnchoredMenu(menuWidth: number) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      close();
      btnRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const top = r.bottom + 2;
      const left = Math.max(4, Math.min(r.left, window.innerWidth - menuWidth));
      setPos({ top, left, maxHeight: Math.max(80, window.innerHeight - top - 6) });
    }
    setOpen(true);
  };

  /** 항목을 골랐을 때: 메뉴를 닫고 칩으로 포커스를 돌린다. */
  const closeAndFocus = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  return { open, pos, btnRef, menuRef, toggle, closeAndFocus };
}

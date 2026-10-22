import { useEffect, useRef, useState } from "react";

/** 「값 복사」 — 클립보드에 쓰고 1.5초간 「복사됨」. 권한이 없으면 코드 블록을 손으로 복사한다. */
export function useLabCopy(codePaste: string): { copied: boolean; copyValue: () => Promise<void> } {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const copyValue = async () => {
    if (!codePaste) return;
    try {
      await navigator.clipboard.writeText(codePaste);
      setCopied(true);
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한이 없으면 pre 블록을 손으로 복사 */
    }
  };

  return { copied, copyValue };
}

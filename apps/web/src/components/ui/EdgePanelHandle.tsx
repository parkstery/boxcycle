import { useEffect, useRef } from "react";
import { registerEdgeDocumentGesture } from "./edgePanelDocumentGesture";
import "./EdgePanelHandle.css";

export type EdgeSide = "left" | "right";

export type EdgePanelHandleProps = {
  edge: EdgeSide;
  open: boolean;
  panelId: string;
  label: string;
  onOpen: () => void;
  onClose: () => void;
  onDragProgress: (progress: number | null) => void;
};

/**
 * 에지 제스처 — document capture 로 시작 좌표만 판별한다(띠 표식은 hit-test 없음).
 * 2026-10-24 Chief: 보이지 않으니 불편하다 → 계기판 바로 아래에 흰 반투명 반원 탭을 둔다.
 * 탭을 누르면 열리고, 탭에서 시작해 끌어도 지금처럼 손가락을 따라 열린다.
 */
export function EdgePanelHandle(props: EdgePanelHandleProps) {
  const { edge, open, panelId, label, onOpen, onClose, onDragProgress } = props;
  const markerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onOpen, onClose, onDragProgress });
  const openDir = edge === "left" ? 1 : -1;

  useEffect(() => {
    callbacksRef.current = { onOpen, onClose, onDragProgress };
  }, [onOpen, onClose, onDragProgress]);

  useEffect(() => {
    if (open) return;
    return registerEdgeDocumentGesture(edge, true, () => markerRef.current, {
      openDir,
      onOpen: () => callbacksRef.current.onOpen(),
      onClose: () => callbacksRef.current.onClose(),
      onDragProgress: (progress) => callbacksRef.current.onDragProgress(progress),
    });
  }, [edge, open, openDir]);

  if (open) return null;

  return (
    <>
      <div
        ref={markerRef}
        className={`edge-panel-handle edge-panel-handle--${edge}`}
        role="presentation"
        aria-hidden="true"
        data-edge-panel={panelId}
        data-edge-gesture-label={label}
      />
      <button
        type="button"
        className={`edge-panel-tab edge-panel-tab--${edge}`}
        aria-label={label}
        aria-controls={panelId}
        aria-expanded={false}
        onClick={onOpen}
      >
        <span className="edge-panel-tab__knob" aria-hidden>
          <svg width="7" height="10" viewBox="0 0 7 10" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d={edge === "left" ? "M2 1.5L5 5L2 8.5" : "M5 1.5L2 5L5 8.5"} />
          </svg>
        </span>
      </button>
    </>
  );
}

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
 * 비노출 에지 제스처 — document capture 로 시작 좌표만 판별한다.
 * pointer-events 레이어는 두지 않아 Mapbox 컨트롤·중앙 지도를 가리지 않는다.
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
    <div
      ref={markerRef}
      className={`edge-panel-handle edge-panel-handle--${edge}`}
      role="presentation"
      aria-hidden="true"
      data-edge-panel={panelId}
      data-edge-gesture-label={label}
    />
  );
}

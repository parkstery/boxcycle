import { useRef } from "react";
import "./EdgePanelHandle.css";

type EdgeSide = "left" | "right";

/** 반달 버튼 안에서의 최소 이동. 넘으면 뒤따르는 click 토글을 막는다. document 제스처는 없다. */
const TAP_SLOP_PX = 6;

type EdgePanelHandleProps = {
  edge: EdgeSide;
  open: boolean;
  panelId: string;
  label: string;
  onOpen: () => void;
  onClose: () => void;
};

/**
 * 좌우 반달 탭 — 네이티브 버튼의 탭/클릭/Enter/Space만으로 열고 닫는다.
 * 가장자리 스와이프·반달 끌기·손가락 추적은 없다. 열린 뒤에도 화면 가장자리 위치를 유지하고 캐럿만 반전한다.
 */
export function EdgePanelHandle(props: EdgePanelHandleProps) {
  const { edge, open, panelId, label, onOpen, onClose } = props;
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const chevron = open
    ? (edge === "left" ? "M5 1.5L2 5L5 8.5" : "M2 1.5L5 5L2 8.5")
    : (edge === "left" ? "M2 1.5L5 5L2 8.5" : "M5 1.5L2 5L5 8.5");
  const title = open
    ? (edge === "left" ? "메뉴 닫기" : "순위 목록 닫기")
    : (edge === "left" ? "메뉴 열기" : "순위 목록 열기");

  return (
    <>
      <div
        className={`edge-panel-handle edge-panel-handle--${edge}${open ? " edge-panel-handle--open" : ""}`}
        role="presentation"
        aria-hidden="true"
        data-edge-panel={panelId}
        data-edge-gesture-label={label}
      />
      <button
        type="button"
        className={`edge-panel-tab edge-panel-tab--${edge}${open ? " edge-panel-tab--open" : ""}`}
        aria-label={label}
        title={title}
        aria-controls={panelId}
        aria-expanded={open}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (!e.isPrimary) return;
          startRef.current = { x: e.clientX, y: e.clientY };
          suppressClickRef.current = false;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* already released */
          }
        }}
        onPointerMove={(e) => {
          const start = startRef.current;
          if (!start) return;
          if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP_PX) {
            suppressClickRef.current = true;
          }
        }}
        onPointerUp={() => {
          startRef.current = null;
        }}
        onPointerCancel={() => {
          startRef.current = null;
          suppressClickRef.current = true;
        }}
        onClick={(e) => {
          const suppressPointerClick = suppressClickRef.current && e.detail !== 0;
          suppressClickRef.current = false;
          if (suppressPointerClick) return;
          if (open) onClose();
          else onOpen();
        }}
      >
        <span className="edge-panel-tab__knob" aria-hidden>
          <svg width="7" height="10" viewBox="0 0 7 10" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d={chevron} />
          </svg>
        </span>
      </button>
    </>
  );
}

import { useRef } from "react";
import { useDialogFocus } from "../ui/useDialogFocus";
import { useEscapeKeyClose } from "../ui/useEscapeKeyClose";
import "./IntervalRouteConfirm.css";

type Props = { open: boolean; speedKmh: number; onCancel: () => void; onConfirm: () => void };

export function IntervalRouteConfirm({ open, speedKmh, onCancel, onConfirm }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);
  useEscapeKeyClose(open, onCancel);
  if (!open) return null;
  return (
    <div className="interval-route-confirm" role="dialog" aria-modal="true" aria-labelledby="interval-route-confirm-title" aria-describedby="interval-route-confirm-copy">
      <button type="button" className="interval-route-confirm__scrim" aria-label="안내 닫기" onClick={onCancel} />
      <div className="interval-route-confirm__panel" ref={panelRef}>
        <div className="interval-route-confirm__heading"><span className="interval-route-confirm__icon" aria-hidden="true">!</span><h2 id="interval-route-confirm-title">운동시간이 더 길어요</h2></div>
        <p id="interval-route-confirm-copy">설정된 경로의 예상 주행시간이 인터벌 운동시간보다 짧아요. 이대로 주행하시겠습니까?</p>
        <p className="interval-route-confirm__basis">예상 속도 {speedKmh.toFixed(1)} km/h 기준</p>
        <div className="interval-route-confirm__actions">
          <button type="button" onClick={onCancel}>취소</button>
          <button type="button" className="interval-route-confirm__primary" onClick={onConfirm}>주행 시작</button>
        </div>
      </div>
    </div>
  );
}

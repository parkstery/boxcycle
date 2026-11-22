import { useRef } from "react";
import type { IntervalRouteHintVariant } from "../../lib/route/intervalRouteDistance";
import { formatRideIntervalClock } from "../../lib/ride/rideInterval";
import { useDialogFocus } from "../ui/useDialogFocus";
import { useEscapeKeyClose } from "../ui/useEscapeKeyClose";
import "./IntervalRouteConfirm.css";

type Props = {
  open: boolean;
  variant: IntervalRouteHintVariant;
  intervalSec: number;
  minKm: number;
  routeKm: number;
  basisKmh: number;
  onClose: () => void;
};

/** 경로 거리 부족 안내 — 주행 시작 경고(IntervalRouteConfirm, 고정48)와 같은 흰 창, 버튼은 「확인」 하나. */
export function IntervalRouteHint({ open, variant, intervalSec, minKm, routeKm, basisKmh, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);
  useEscapeKeyClose(open, onClose);
  if (!open) return null;
  const clock = formatRideIntervalClock(intervalSec);
  const min = minKm.toFixed(1);
  const route = routeKm.toFixed(1);
  return (
    <div className="interval-route-confirm" role="dialog" aria-modal="true" aria-labelledby="interval-route-hint-title" aria-describedby="interval-route-hint-copy" data-variant={variant}>
      <button type="button" className="interval-route-confirm__scrim" aria-label="안내 닫기" onClick={onClose} />
      <div className="interval-route-confirm__panel" ref={panelRef}>
        <div className="interval-route-confirm__heading"><span className="interval-route-confirm__icon" aria-hidden="true">!</span><h2 id="interval-route-hint-title">경로가 짧아요</h2></div>
        <p id="interval-route-hint-copy">
          {variant === "route"
            ? `인터벌 운동(${clock})을 마치려면 경로가 최소 ${min} km 필요해요. 지금 경로는 ${route} km예요. 경로를 더 길게 잡아 주세요.`
            : `이 인터벌 설정(${clock})에는 ${min} km 이상의 경로를 권해요. 지금 경로는 ${route} km예요.`}
        </p>
        <p className="interval-route-confirm__basis">시속 {basisKmh} km 기준</p>
        <div className="interval-route-confirm__actions">
          <button type="button" className="interval-route-confirm__primary" onClick={onClose}>확인</button>
        </div>
      </div>
    </div>
  );
}

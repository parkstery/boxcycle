import "./RideStartCountdown.css";

export function RideStartCountdown({ value }: { value: number | null }) {
  if (value == null) return null;
  return <div className="ride-start-countdown" role="status" aria-label="출발 카운트다운" aria-live="assertive" aria-atomic="true">
    <span className="ride-start-countdown__label">잠시 후 출발</span>
    <strong className="ride-start-countdown__number">{value}</strong>
  </div>;
}

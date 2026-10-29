import "./QuickIntervalStatus.css";

type QuickIntervalStatusProps = {
  /** 안내 문구. null 이면 그리지 않는다 */
  message: string | null;
  /** 실패 안내 — 붉은 배경과 닫기 버튼을 쓴다 */
  failed: boolean;
  onDismiss: () => void;
};

/** 간편 인터벌 주행 진행 안내 — 출발 클릭 요청·탐색 중·실패를 지도 위 한 줄로 알린다 */
export function QuickIntervalStatus({ message, failed, onDismiss }: QuickIntervalStatusProps) {
  if (!message) return null;
  return (
    <div
      className={`quick-interval-status quick-interval-status--${failed ? "error" : "info"}`}
      role="status"
      aria-live="polite"
      data-quick-interval-status
    >
      <span className="quick-interval-status__text">{message}</span>
      {failed ? (
        <button
          type="button"
          className="quick-interval-status__close"
          aria-label="안내 닫기"
          title="안내 닫기"
          onClick={onDismiss}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

import "./FirstRideIntroCard.css";

export type FirstRideIntroCardProps = {
  /** 입문 경로를 로드해 ready-to-start 까지 만든다 — Go 는 기존 게이트 그대로 */
  onStartIntro: () => void;
};

/**
 * 이전 주행이 없는 idle 에서 입문 코스 CTA 를 제시하는 카드(RIDE-NEXT-VISIT-2 §3).
 *
 * NextRideCard 와 동일한 좌하단 anchor 를 공유하며 동시에 표시되지 않는다.
 */
export function FirstRideIntroCard({ onStartIntro }: FirstRideIntroCardProps) {
  return (
    <div className="first-ride-anchor" aria-label="입문 경로">
      <div className="first-ride__card hud-glass" role="group">
        <p className="first-ride__title">RTW를 시작해보세요</p>
        <p className="first-ride__body">입문 경로로 첫 도로를 달려봐요</p>
        <button type="button" className="first-ride__btn" onClick={onStartIntro}>
          입문 경로 시작
        </button>
      </div>
    </div>
  );
}

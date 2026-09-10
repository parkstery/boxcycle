import "./NextRideCard.css";

export type FirstRideIntroCardProps = {
  /** 입문 코스 열기 → 기존 BasicHub 진입 경로를 그대로 탄다 */
  onEnterIntro: () => void;
};

/**
 * 첫 사용자(주행 후보 없음) idle 화면의 1급 입문 CTA(RIDE-NEXT-VISIT-2 §3.2).
 * NextRideCard 와 같은 좌하단 슬롯에 나타나며 동시에 표시되지 않는다.
 * NextRideCard.css 의 클래스를 재사용해 글래스·위계를 통일한다.
 */
export function FirstRideIntroCard(props: FirstRideIntroCardProps) {
  return (
    <div className="next-ride-anchor" aria-label="입문 코스 시작">
      <div className="next-ride__card hud-glass" role="group" aria-labelledby="intro-card-title">
        <div className="next-ride__head">
          <h2 id="intro-card-title" className="next-ride__title">
            시작하기
          </h2>
        </div>
        <p className="next-ride__line next-ride__line--muted">
          입문 코스로 지구 도로를 달려 보세요
        </p>
        <div className="next-ride__actions">
          <button
            type="button"
            className="next-ride__btn next-ride__btn--primary"
            onClick={props.onEnterIntro}
          >
            입문 코스 열기
          </button>
        </div>
      </div>
    </div>
  );
}

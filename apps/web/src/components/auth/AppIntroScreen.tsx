import "./AppIntroScreen.css";

type AppIntroScreenProps = {
  onStartGuest: () => void;
  onLogin: () => void;
};

/**
 * 최초 인증 전 인트로. 좌측 포슬린 그라데이션 위 브랜드·제목·소개.
 * onStartGuest·onLogin만 받는다. 인증·라우팅·저장·효과·타이머·지도 초기화는 하지 않는다.
 * 우측은 비어 있어 이미 떠 있는 맵박스 지도가 비친다. 새 지도 인스턴스를 만들지 않는다.
 * 셸은 포인터를 받아 하위 지도 조작을 막는다. 맵박스 출처 표기는 가리지 않는다.
 * FirstRideIntroCard와 별개이며 그 컴포넌트를 바꾸지 않는다.
 */
export function AppIntroScreen({ onStartGuest, onLogin }: AppIntroScreenProps) {
  return (
    <section className="app-intro" aria-label="앱 소개">
      <div className="app-intro__scroll">
        <div className="app-intro__content">
          <p className="app-intro__brand">
            <span className="app-intro__brand-dot" aria-hidden="true" />
            <span className="app-intro__brand-name">RTW</span>
            <span className="app-intro__brand-sub">RIDE THE WORLD</span>
          </p>
          <h1 className="app-intro__headline">
            <span className="app-intro__headline-line">달린 길이,</span>
            <span className="app-intro__headline-line">내 도로망이 됩니다.</span>
          </h1>
          <p className="app-intro__support">실내 자전거로 실제 지구의 도로를 달려보세요.</p>
          <div className="app-intro__actions">
            <button type="button" className="app-intro__guest" onClick={onStartGuest}>
              게스트로 시작
            </button>
            <button type="button" className="app-intro__login" onClick={onLogin}>
              로그인
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import "./AppIntroScreen.css";

type AppIntroScreenProps = {
  onStartGuest: () => void;
  onLogin: () => void;
};

/**
 * 최초 인증 전 인트로. 좌측 짙은 남색 패널 위 브랜드·제목·소개, 우측은 실제 지도.
 * onStartGuest·onLogin만 받는다. 인증·라우팅·저장·효과·타이머·지도 초기화는 하지 않는다.
 * 우측은 비어 있어 이미 떠 있는 맵박스 지도가 비친다. 새 지도 인스턴스를 만들지 않는다.
 * 셸은 포인터를 받아 하위 지도 조작을 막는다. 맵박스 출처 표기는 가리지 않는다.
 * FirstRideIntroCard와 별개이며 그 컴포넌트를 바꾸지 않는다.
 */
export function AppIntroScreen({ onStartGuest, onLogin }: AppIntroScreenProps) {
  return (
    <section className="app-intro" aria-label="앱 소개">
      <p className="app-intro__brand">
        <span className="app-intro__brand-mark" aria-hidden="true">
          <svg
            className="app-intro__brand-svg"
            viewBox="0 0 100 100"
            focusable="false"
            aria-hidden="true"
          >
            <defs>
              <clipPath id="app-intro-mark-clip">
                <circle cx="50" cy="50" r="50" />
              </clipPath>
            </defs>
            <g clipPath="url(#app-intro-mark-clip)">
              <circle cx="50" cy="50" r="50" fill="#0061fd" />
              <path
                fill="#fff"
                d="M 75.56 12.47 L 81.55 16.21 L 84.29 18.95 L 86.28 21.95 L 87.28 26.68 L 86.78 28.93 L 84.54 32.67 L 79.8 36.91 L 71.32 42.14 L 28.43 64.84 L 21.45 69.08 L 17.46 73.07 L 16.46 75.31 L 16.46 78.05 L 17.46 80.55 L 19.45 83.29 L 25.69 88.53 L 18.2 84.04 L 13.97 79.8 L 11.47 75.31 L 11.22 71.07 L 13.22 66.83 L 17.46 62.84 L 21.7 60.1 L 70.32 33.42 L 77.31 28.68 L 80.55 25.19 L 81.55 23.19 L 81.8 20.2 L 80.3 16.96 L 75.81 12.47 Z"
              />
            </g>
          </svg>
        </span>
        <span className="app-intro__brand-name">SPINATLAS</span>
      </p>
      <div className="app-intro__scroll">
        <div className="app-intro__content">
          <p className="app-intro__eyebrow">INDOOR RIDE · REAL ROADS</p>
          <h1 className="app-intro__headline">
            <span className="app-intro__headline-line">땀으로 그리는,</span>
            <span className="app-intro__headline-line">나만의 지구 지도.</span>
          </h1>
          <p className="app-intro__support">
            <span>실내 자전거로 실제 도로를 달리면,</span>{" "}
            <span>달린 길이 내 지도에 남습니다.</span>
          </p>
          <div className="app-intro__actions">
            <button type="button" className="app-intro__guest" onClick={onStartGuest}>
              게스트로 시작
              <span className="app-intro__guest-arrow" aria-hidden="true">→</span>
            </button>
            <button type="button" className="app-intro__login" onClick={onLogin}>
              로그인
            </button>
          </div>
        </div>
        <ol className="app-intro__steps">
          <li className="app-intro__steps-item">
            <span className="app-intro__steps-no">01</span>
            <span className="app-intro__steps-text">페달을 밟고</span>
          </li>
          <li className="app-intro__steps-item">
            <span className="app-intro__steps-no">02</span>
            <span className="app-intro__steps-text">실제 도로를 달리고</span>
          </li>
          <li className="app-intro__steps-item">
            <span className="app-intro__steps-no">03</span>
            <span className="app-intro__steps-text">내 도로망을 쌓으세요</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

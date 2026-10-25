import { SpinatlasMark } from "../brand/SpinatlasMark";
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
          <SpinatlasMark className="app-intro__brand-svg" />
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

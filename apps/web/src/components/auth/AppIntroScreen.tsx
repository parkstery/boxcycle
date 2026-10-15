import "./AppIntroScreen.css";

export type AppIntroScreenProps = {
  /**
   * 「시작하기」를 누를 때 호출된다.
   * 순수 표현 컴포넌트 — 인증·라우팅·저장·효과·타이머·지도 초기화를 하지 않으며,
   * 마운트 시 자동 호출하지 않고 CTA 클릭 때만 호출한다.
   * App은 이 콜백으로 메모리 dismiss만 한다.
   */
  onStart: () => void;
};

/**
 * 최초 인증 전 앱 소개. 좌측 포슬린 그라데이션 위 브랜드·제목·소개·단일 CTA.
 * 우측은 기존 지도가 비치도록 투명하고, 스크롤 히트는 좌측 본문만 받는다.
 * 하단 띠는 기존 지도 저작권·하단 컨트롤이 통과할 비인터랙티브 공간이다.
 * 자체 지도·타일·외부 이미지를 두지 않는다.
 * FirstRideIntroCard와 별개이며 그 컴포넌트를 바꾸지 않는다.
 */
export function AppIntroScreen({ onStart }: AppIntroScreenProps) {
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
          <button
            type="button"
            className="app-intro__cta"
            onClick={onStart}
            onFocus={(event) => {
              const scroller = event.currentTarget.closest(".app-intro__scroll");
              if (!(scroller instanceof HTMLElement)) return;
              const frame = scroller.getBoundingClientRect();
              const box = event.currentTarget.getBoundingClientRect();
              if (box.bottom > frame.bottom) scroller.scrollTop += box.bottom - frame.bottom;
            }}
          >
            시작하기
            <span className="app-intro__cta-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>
      <div className="app-intro__map-reserve" aria-hidden="true" />
    </section>
  );
}

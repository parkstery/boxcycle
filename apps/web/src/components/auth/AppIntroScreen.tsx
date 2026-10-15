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

/** 수직 정사투영 위성영상, 온라인 고정영역 이미지. 앱에 저장·재배포하지 않는다. */
const INTRO_SATELLITE_SRC =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=12.4865%2C41.8875%2C12.4979%2C41.8929&bboxSR=4326&imageSR=3857&size=1600%2C1000&format=jpg&f=image";

/**
 * 최초 인증 전 앱 소개. 좌측 포슬린 그라데이션 위 브랜드·제목·소개·단일 CTA.
 * 우측은 수직 정사투영 위성영상, 온라인 고정영역 이미지다. 지도·Mapbox·사용자 위치와 무관하다.
 * 셸은 불투명하고 포인터를 받아 하위 지도와 컨트롤을 가린다.
 * FirstRideIntroCard와 별개이며 그 컴포넌트를 바꾸지 않는다.
 */
export function AppIntroScreen({ onStart }: AppIntroScreenProps) {
  return (
    <section className="app-intro" aria-label="앱 소개">
      <img
        className="app-intro__photo"
        src={INTRO_SATELLITE_SRC}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        fetchPriority="high"
        loading="eager"
      />
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
      <a
        className="app-intro__credit"
        href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"
        target="_blank"
        rel="noopener noreferrer"
      >
        Esri · Vantor · Earthstar Geographics · GIS User Community
      </a>
    </section>
  );
}

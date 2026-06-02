import "./RotateOverlay.css";

/**
 * 스마트폰 세로 모드 차단.
 * - CSS @media 만으로 노출 제어한다(자바스크립트 상태 불필요).
 * - 데스크톱·태블릿(가로폭 ≥ 901px)에서는 노출되지 않는다.
 */
export function RotateOverlay() {
  return (
    <div className="rotate-overlay" role="alertdialog" aria-label="화면 회전 안내">
      <div className="rotate-overlay__icon" aria-hidden />
      <p className="rotate-overlay__title">가로 모드로 돌려주세요</p>
      <p className="rotate-overlay__hint">
        RTW Pro 는 스마트폰 가로 모드에 최적화돼 있어요.
      </p>
    </div>
  );
}

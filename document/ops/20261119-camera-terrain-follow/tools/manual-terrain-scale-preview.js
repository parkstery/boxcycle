/* Isolated production preview only. No camera/paint/layer mutation. */
(() => {
  const selectedScale = new URLSearchParams(location.search).get('terrainscale') === '1.3' ? 1.3 : 1;
  const panel = document.createElement('details');
  panel.open = true;
  panel.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647;background:#17202eee;color:white;padding:6px;border-radius:8px;font:12px/1.5 system-ui;max-width:300px';
  panel.innerHTML = `<summary>지형 높이 비교 · 기본 렌더 · ${selectedScale}배</summary>
    <button data-scale="1.3">1.3배</button> <button data-scale="1">원래 높이 1배</button>
    <button data-copy>결과 복사</button>
    <div data-status>지도 준비 중</div>
    <div>배율 변경 시 새로고침·주행 종료. 같은 코스로 다시 시작하세요.<br>접으면 지도를 넓게 볼 수 있습니다. 성능 Lab 결과와 함께 복사하세요.</div>`;
  document.body.append(panel);
  const status = panel.querySelector('[data-status]');
  for (const button of panel.querySelectorAll('[data-scale]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.scale) === selectedScale));
  }
  let latest = {};
  panel.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.scale) {
      if (Number(button.dataset.scale) === selectedScale) return;
      if (!confirm('배율을 변경하면 페이지를 새로 열고 현재 주행이 종료됩니다. 계속할까요?')) return;
      const url = new URL(location.href);
      url.searchParams.set('terrainscale', button.dataset.scale);
      location.assign(url.href);
    } else if (button.hasAttribute('data-copy')) {
      try { await navigator.clipboard.writeText(JSON.stringify(latest, null, 2)); button.textContent = '복사 완료'; }
      catch { button.textContent = '복사 실패'; }
    }
  });
  setInterval(() => {
    const map = window.__RTW_MAP__;
    if (!map) return;
    const terrain = map.getTerrain();
    const actualScale = terrain?.exaggeration ?? null;
    const view = actualScale === null ? '3D OFF' : actualScale === 0 ? '자동평면' : `3D ${actualScale}배`;
    const mismatch = actualScale !== null && actualScale !== 0 && actualScale !== selectedScale;
    status.textContent = `선택 ${selectedScale}배 · 실제 ${view}${mismatch ? ' · 배율 불일치!' : ''}`;
    latest = { mode: 'baseline', selectedScale, actualScale, view, mismatch,
      terrainView: map.getContainer().dataset.terrainView ?? null,
      zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(),
      cameraAltitudeM: map.getFreeCameraOptions()?.position?.toAltitude() ?? null,
      viewport: [innerWidth, innerHeight], deviceDpr: devicePixelRatio,
      canvas: [map.getCanvas().width, map.getCanvas().height],
      style: map.getStyle()?.name ?? null, at: new Date().toISOString() };
    window.__manualTerrainScalePreview = latest;
  }, 1000);
})();

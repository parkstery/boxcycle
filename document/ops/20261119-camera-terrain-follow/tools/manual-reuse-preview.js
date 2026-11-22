/* Only served by run-manual-reuse-preview.mjs. Camera methods are never replaced. */
(() => {
  const panel = document.createElement('details');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#17202eee;color:white;padding:8px;border-radius:8px;font:12px/1.5 system-ui;max-width:340px';
  panel.open = true;
  panel.innerHTML = `<summary>40FPS 실험 · 로컬 v2</summary>
    <div>주행 시작 → 카메라2/3 → 기준/후보 비교</div>
    <button data-mode="baseline">기준</button> <button data-mode="paint">선 표현식만 고정</button>
    <button data-mode="custom">40FPS 후보</button> <button data-reset title="왼쪽 실험판의 표본만 초기화">통계 초기화</button>
    <div data-status>기준 · 카메라 추적 유지</div><div data-stats>지도 준비 중</div>
    <div>후보: 선 폭·발광의 줌 반응 고정 + 동적 선/점 별도 렌더.<br>합성 선 없음. 스타일 변경·종료 전 「기준」을 누르세요.</div>`;
  document.body.append(panel);
  const status = panel.querySelector('[data-status]');
  const stats = panel.querySelector('[data-stats]');
  let active = null;
  let mode = 'baseline';
  let frameTimes = [], renderTimes = [];
  let attached = null;
  let message = '기준 · 카메라 추적 유지';
  let resetAt = performance.now(), measurement = 0;
  const modeLabel = value => ({ baseline: '기준', paint: '선 표현식만 고정', custom: '40FPS 후보' })[value];
  function publish(values = {}) {
    window.__manualReusePreview = { version: 2, mode, message, measurement,
      elapsedMs: performance.now() - resetAt, frameSamples: frameTimes.length,
      renderSamples: renderTimes.length, ...values };
    for (const button of panel.querySelectorAll('[data-mode]')) {
      const selected = button.dataset.mode === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.style.fontWeight = selected ? 'bold' : 'normal';
      button.style.outline = selected ? '2px solid #60bfff' : '';
    }
  }
  const reset = () => {
    frameTimes = []; renderTimes = []; resetAt = performance.now(); measurement++;
    stats.textContent = `측정 #${measurement} 초기화 완료 · 새 표본 수집 중 (0.0/10초)`;
    publish();
  };
  const note = text => { message = text; status.textContent = text; };
  const freeze = (value, zoom) => Array.isArray(value)
    ? value.length === 1 && value[0] === 'zoom' ? zoom : value.map(part => freeze(part, zoom)) : value;
  function restore() {
    if (!active) { mode = 'baseline'; reset(); return; }
    const state = active;
    active = null;
    if (state.onStyleLoad) state.map.off('style.load', state.onStyleLoad);
    if (state.onRemove) state.map.off('remove', state.onRemove);
    state.overlay?.remove();
    state.map.setPaintProperty = state.paint;
    if (state.map.style === state.style) {
      for (const entry of state.frozen) if (state.map.getLayer(entry.id)) {
        state.paint.call(state.map, entry.id, entry.key, entry.original);
      }
      for (const entry of state.hidden) if (state.map.getLayer(entry.id)) {
        state.map.setLayoutProperty(entry.id, 'visibility', entry.visibility);
      }
    }
    mode = 'baseline';
    reset();
  }
  function apply(nextMode) {
    restore();
    if (nextMode === 'baseline') { note('기준 · 카메라 추적 유지'); return; }
    const map = window.__RTW_MAP__;
    // isStyleLoaded() also waits for live GeoJSON/source work to finish. During
    // riding that work is continuous; only require the style/layers we mutate.
    if (!map?.getStyle()?.layers?.length || map.getTerrain()?.exaggeration !== 1.3) {
      throw new Error('3D 지도가 필요합니다. 주행의 3D 뷰를 켠 뒤 선택하세요.');
    }
    const state = { map, style: map.style, paint: map.setPaintProperty, frozen: [], hidden: [], overlay: null };
    active = state;
    const zoom = map.getZoom();
    const keys = ['line-width', 'line-emissive-strength'];
    map.setPaintProperty = function(id, key, value, ...rest) {
      if (keys.includes(key)) {
        const saved = state.frozen.find(entry => entry.id === id && entry.key === key);
        if (saved) saved.original = value;
        else if (JSON.stringify(value) !== JSON.stringify(freeze(value, zoom))) state.frozen.push({ id, key, original: value });
        value = freeze(value, zoom);
      }
      return state.paint.call(this, id, key, value, ...rest);
    };
    for (const layer of map.getStyle().layers) if (layer.type === 'line') {
      for (const key of keys) {
        const original = map.getPaintProperty(layer.id, key);
        if (JSON.stringify(original) !== JSON.stringify(freeze(original, zoom))) map.setPaintProperty(layer.id, key, original);
      }
    }
    if (nextMode === 'custom') {
      const descriptors = [];
      for (const layer of map.getStyle().layers) {
        if (!layer.source || ['route', 'boxcycle-conquest-traces'].includes(layer.source) ||
            map.getSource(layer.source)?.type !== 'geojson' || !['line', 'fill', 'circle', 'heatmap', 'raster'].includes(layer.type)) continue;
        const visibility = map.getLayoutProperty(layer.id, 'visibility') ?? 'visible';
        // Respect layers already hidden by the app; do not resurrect them in the overlay.
        if (visibility === 'none') continue;
        descriptors.push({ id: layer.id, source: layer.source, type: layer.type, paint: layer.paint ?? {} });
        state.hidden.push({ id: layer.id, visibility });
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
      state.overlay = window.installTerrainOverlayProbe(map, descriptors, id => map.getSource(id)?._data);
    }
    state.onStyleLoad = () => { restore(); note('스타일 변경으로 기준 복원 · 필요하면 후보를 다시 선택하세요.'); };
    state.onRemove = () => {
      map.setPaintProperty = state.paint;
      map.off('style.load', state.onStyleLoad);
      active = null; mode = 'baseline'; reset();
    };
    map.on('style.load', state.onStyleLoad);
    map.on('remove', state.onRemove);
    mode = nextMode;
    note(`${modeLabel(nextMode)} 적용 · 표현식 ${state.frozen.length}개 / 별도 레이어 ${state.hidden.length}개 · 카메라 추적 유지`);
    reset();
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    try {
      if (button.hasAttribute('data-reset')) {
        note(`통계 초기화 완료 · ${modeLabel(mode)} 유지 (왼쪽 실험판)`);
        reset();
      }
      else apply(button.dataset.mode);
    } catch (error) {
      try { restore(); } catch { /* Keep the original error visible. */ }
      note(`적용 실패: ${error.message} · 새로고침으로 초기화 가능`);
    }
  });
  function tick(now) {
    frameTimes.push(now);
    while (frameTimes[0] < now - 10000) frameTimes.shift();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const onRender = () => {
    const now = performance.now(); renderTimes.push(now);
    while (renderTimes[0] < now - 10000) renderTimes.shift();
  };
  setInterval(() => {
    const map = window.__RTW_MAP__;
    if (!map) return;
    if (attached !== map) { attached?.off('render', onRender); attached = map; map.on('render', onRender); reset(); }
    const gaps = frameTimes.slice(1).map((time, index) => time - frameTimes[index]).sort((a, b) => a - b);
    const fps = frameTimes.length > 1 ? (frameTimes.length - 1) * 1000 / (frameTimes.at(-1) - frameTimes[0]) : 0;
    const now = performance.now();
    while (renderTimes[0] < now - 10000) renderTimes.shift();
    const renderFps = renderTimes.length > 1 ? (renderTimes.length - 1) * 1000 / (renderTimes.at(-1) - renderTimes[0]) : 0;
    const altitude = map.getFreeCameraOptions()?.position?.toAltitude();
    const elapsed = Math.min(10, (now - resetAt) / 1000);
    stats.textContent = `측정 #${measurement} · 수집 ${elapsed.toFixed(1)}/10초 · rAF ${fps.toFixed(1)} FPS / 지도 ${renderFps.toFixed(1)} FPS · p95 ${(gaps[Math.floor(gaps.length * .95)] ?? 0).toFixed(1)}ms · 줌 ${map.getZoom().toFixed(3)} / pitch ${map.getPitch().toFixed(1)}° / 고도 ${altitude?.toFixed(1) ?? '?'}m`;
    if (active?.overlay) stats.textContent += ` · 선분 ${active.overlay.stats.segments} / 점 ${active.overlay.stats.points}`;
    publish({ fps, renderFps, zoom: map.getZoom(), pitch: map.getPitch(), altitude, overlay: active?.overlay?.stats });
  }, 1000);
  publish();
})();

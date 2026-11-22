import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('./manual-reuse-preview.js', import.meta.url), 'utf8');
function setup() {
  const button = mode => ({ dataset: { mode }, style: {}, attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; }, hasAttribute() { return false; } });
  const buttons = ['baseline', 'paint', 'custom'].map(button);
  const reset = { hasAttribute: key => key === 'data-reset' };
  const nodes = { '[data-status]': {}, '[data-stats]': {} };
  let click;
  const panel = { style: {}, querySelector: key => nodes[key], querySelectorAll: () => buttons,
    addEventListener: (_event, listener) => { click = listener; } };
  const original = ['interpolate', ['linear'], ['zoom'], 10, 2, 22, 8];
  const layers = [
    { id: 'road', type: 'line', source: 'composite', paint: { 'line-width': original } },
    { id: 'route-line', type: 'line', source: 'route', paint: { 'line-width': 3 } },
    { id: 'live', type: 'line', source: 'live-source', paint: { 'line-width': 5 } },
    { id: 'hidden', type: 'circle', source: 'live-source', paint: { 'circle-radius': 3 }, visibility: 'none' },
  ];
  const callbacks = new Map();
  const map = {
    style: {},
    isStyleLoaded: () => false, // Reproduce a visible map with live source updates.
    getStyle: () => ({ layers: structuredClone(layers) }),
    getLayer: id => layers.find(layer => layer.id === id),
    getTerrain: () => ({ exaggeration: 1.3 }),
    getZoom: () => 21.5, getPitch: () => 84,
    getFreeCameraOptions: () => ({ position: { toAltitude: () => 214 } }),
    getSource: id => ({ type: id === 'composite' ? 'vector' : 'geojson', _data: { type: 'FeatureCollection', features: [] } }),
    getPaintProperty(id, key) { return this.getLayer(id).paint[key]; },
    setPaintProperty(id, key, value) { this.getLayer(id).paint[key] = value; return this; },
    getLayoutProperty(id) { return this.getLayer(id).visibility; },
    setLayoutProperty(id, _key, value) { this.getLayer(id).visibility = value; },
    on(event, callback) { callbacks.set(event, callback); },
    off(event, callback) { if (callbacks.get(event) === callback) callbacks.delete(event); },
    jumpTo() {}, setFreeCameraOptions() {},
  };
  let time = 0, frame, interval, installs = [], removes = 0;
  const window = { __RTW_MAP__: map, installTerrainOverlayProbe(_map, descriptors) {
    installs.push(descriptors); return { stats: { segments: 3, points: 0 }, remove() { removes++; } };
  } };
  vm.runInNewContext(source, { document: { createElement: () => panel, body: { append() {} } }, window,
    performance: { now: () => time }, requestAnimationFrame: callback => { frame = callback; },
    setInterval: callback => { interval = callback; } });
  return { map, window, nodes, buttons, layers, original, installs,
    get removes() { return removes; },
    click(mode) { const target = mode === 'reset' ? reset : buttons.find(b => b.dataset.mode === mode); click({ target: { closest: () => target } }); },
    advance() { time += 1000; frame(time); callbacks.get('render')?.(); interval(); },
  };
}

test('live source updates do not block paint/custom switching; camera methods stay intact', () => {
  const t = setup(), jump = t.map.jumpTo, free = t.map.setFreeCameraOptions;
  t.click('paint');
  assert.equal(t.window.__manualReusePreview.mode, 'paint');
  assert.ok(!JSON.stringify(t.map.getPaintProperty('road', 'line-width')).includes('"zoom"'));
  assert.equal(t.buttons[1].attrs['aria-pressed'], 'true');
  t.click('custom');
  assert.equal(t.window.__manualReusePreview.mode, 'custom');
  assert.deepEqual(Array.from(t.installs[0], d => d.id), ['live']);
  assert.equal(t.map.getLayoutProperty('live'), 'none');
  assert.equal(t.map.jumpTo, jump); assert.equal(t.map.setFreeCameraOptions, free);
});

test('baseline restores paint/visibility and frees custom overlay', () => {
  const t = setup(), originalPaint = t.map.setPaintProperty;
  t.click('custom'); t.click('baseline');
  assert.deepEqual(t.map.getPaintProperty('road', 'line-width'), t.original);
  assert.equal(t.map.getLayoutProperty('live'), 'visible');
  assert.equal(t.map.getLayoutProperty('hidden'), 'none');
  assert.equal(t.map.setPaintProperty, originalPaint);
  assert.equal(t.removes, 1);
  assert.equal(t.window.__manualReusePreview.mode, 'baseline');
});

test('reset acknowledges immediately, clears only panel samples, retains current mode', () => {
  const t = setup(); t.advance(); t.click('custom'); t.advance(); t.advance();
  assert.ok(t.window.__manualReusePreview.frameSamples > 0);
  const before = t.window.__manualReusePreview.measurement;
  t.click('reset');
  const value = t.window.__manualReusePreview;
  assert.equal(value.mode, 'custom'); assert.equal(value.measurement, before + 1);
  assert.equal(value.frameSamples, 0); assert.equal(value.renderSamples, 0);
  assert.match(t.nodes['[data-status]'].textContent, /통계 초기화 완료/);
  assert.match(t.nodes['[data-stats]'].textContent, /0.0\/10초/);
  t.advance();
  assert.match(t.nodes['[data-stats]'].textContent, /수집 1.0\/10초/);
});

test('overlay installation error rolls paint/visibility back and reports failure', () => {
  const t = setup(), originalPaint = t.map.setPaintProperty;
  t.window.installTerrainOverlayProbe = () => { throw new Error('WebGL unavailable'); };
  t.click('custom');
  assert.equal(t.window.__manualReusePreview.mode, 'baseline');
  assert.equal(t.map.setPaintProperty, originalPaint);
  assert.deepEqual(t.map.getPaintProperty('road', 'line-width'), t.original);
  assert.equal(t.map.getLayoutProperty('live'), 'visible');
  assert.match(t.nodes['[data-status]'].textContent, /WebGL unavailable/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('./manual-terrain-scale-preview.js', import.meta.url), 'utf8');
function setup() {
  const buttons = ['1.3', '1'].map(scale => ({ dataset: { scale }, setAttribute() {} }));
  const status = {};
  let click, tick, destination, copied, allow = false, terrain = { exaggeration: 1 };
  const panel = { style: {}, querySelector: () => status, querySelectorAll: () => buttons,
    addEventListener: (_event, fn) => { click = fn; } };
  // A read-only map: any attempted camera/terrain/layer mutation fails the test.
  const map = Object.freeze({ getTerrain: () => terrain, getContainer: () => ({ dataset: { terrainView: '3d' } }),
    getZoom: () => 20, getPitch: () => 80, getBearing: () => 10,
    getFreeCameraOptions: () => ({ position: { toAltitude: () => 103 } }),
    getCanvas: () => ({ width: 1200, height: 540 }), getStyle: () => ({ name: 'Outdoors' }) });
  const window = { __RTW_MAP__: map };
  const location = { search: '?maxdpr=1.5&perflab=1&terrainscale=1',
    href: 'http://127.0.0.1:5216/?maxdpr=1.5&perflab=1&terrainscale=1', assign: url => { destination = url; } };
  vm.runInNewContext(source, { document: { createElement: () => panel, body: { append() {} } },
    window, location, URL, URLSearchParams, confirm: () => allow, innerWidth: 800, innerHeight: 360,
    devicePixelRatio: 1.5, setInterval: fn => { tick = fn; },
    navigator: { clipboard: { writeText: async text => { copied = text; } } } });
  return { window, status, tick: () => tick(), setTerrain: value => { terrain = value; },
    approve: () => { allow = true; }, get destination() { return destination; }, get copied() { return copied; },
    click: button => click({ target: { closest: () => button } }), buttons };
}

test('read-only panel reports selected scale, actual 3D, auto-flat, OFF and mismatch; copies attribution', async () => {
  const t = setup(); t.tick();
  assert.equal(t.window.__manualTerrainScalePreview.mode, 'baseline');
  assert.equal(t.window.__manualTerrainScalePreview.selectedScale, 1);
  assert.match(t.status.textContent, /실제 3D 1배/);
  await t.click({ dataset: {}, hasAttribute: key => key === 'data-copy' });
  assert.equal(JSON.parse(t.copied).actualScale, 1);
  t.setTerrain({ exaggeration: 0 }); t.tick(); assert.match(t.status.textContent, /자동평면/);
  t.setTerrain(null); t.tick(); assert.match(t.status.textContent, /3D OFF/);
  t.setTerrain({ exaggeration: 1.3 }); t.tick(); assert.match(t.status.textContent, /배율 불일치/);
});

test('switch requires acknowledging reload and preserves all other query conditions', async () => {
  const t = setup();
  await t.click(t.buttons[0]); assert.equal(t.destination, undefined);
  t.approve(); await t.click(t.buttons[0]);
  const url = new URL(t.destination);
  assert.equal(url.searchParams.get('terrainscale'), '1.3');
  assert.equal(url.searchParams.get('maxdpr'), '1.5');
  assert.equal(url.searchParams.get('perflab'), '1');
});

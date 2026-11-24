import fs from 'node:fs';
import { test } from '../../../../../apps/web/e2e/open-meteo-stub';
import { guestStart, prepareManualRideInput, setSpeedKmh } from '../../../../../apps/web/e2e/rideEntryHelpers';

const cases = JSON.parse(fs.readFileSync(process.env.APP_FPS_CASES!, 'utf8'));
const out = process.env.APP_FPS_OUT!;
fs.mkdirSync(out, { recursive: true });

for (const c of cases) test(c.id, async ({ page }) => {
  await page.goto(`/?perflab=1&maxdpr=1.5&viewdist=${c.viewdist}${c.query ?? ''}`);
  await guestStart(page);
  await prepareManualRideInput(page);
  const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
  const location = page.getByRole('dialog', { name: '어디에서 시작할까요?' });
  await menu.or(location).first().waitFor({ timeout: 15000 });
  if (await location.isVisible()) await location.getByRole('button', { name: '기본 위치' }).click();
  await menu.click();
  await page.locator('#menu-panel').getByRole('button', { name: '내 경로 목록', exact: true }).click();
  await page.getByRole('navigation', { name: '경로 출처' }).getByRole('button', { name: '입문', exact: true }).click();
  const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') });
  await modal.locator('button.oc-modal__item').filter({ hasText: c.course }).first().click();
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await setSpeedKmh(page, c.kmh ?? 15);
  await page.waitForFunction(() => {
    const m = (window as any).__RTW_MAP__;
    return m && m.getPitch() > 70 && m.getZoom() > 18;
  }, undefined, { timeout: 30000 });
  if (c.kind === 'diag') {
    await page.waitForTimeout(10000);
    const r = await page.evaluate(async () => {
      const map = (window as any).__RTW_MAP__;
      const ev: any[] = [], frames: any[] = [], tasks: any[] = [], prog: any[] = [], tiles: any[] = [];
      const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => tasks.push([Math.round(e.startTime), Math.round(e.duration)]))); po.observe({ entryTypes: ['longtask'] });
      map.on('sourcedata', (e: any) => { if (e.tile) tiles.push([performance.now(), e.sourceId, e.tile?.tileID?.canonical?.z]); });
      const gp = map.painter.getOrCreateProgram.bind(map.painter); let n = Object.keys(map.painter.cache ?? {}).length;
      map.painter.getOrCreateProgram = (...x: any[]) => { const t = performance.now(); const p = gp(...x); const m = Object.keys(map.painter.cache).length; if (m !== n) { prog.push([t, x[0], +(performance.now() - t).toFixed(1)]); n = m; } return p; };
      let start = 0; map.on('renderstart', () => { start = performance.now(); });
      map.on('render', () => { const t = performance.now(); frames.push([t, start ? t - start : null, map.getBearing(), map.getCenter().toArray()]); });
      await new Promise((r2) => setTimeout(r2, 24000));
      const slow: any[] = [];
      for (let i = 1; i < frames.length; i++) { const dt = frames[i][0] - frames[i - 1][0]; if (dt > 80) slow.push({ at: Math.round(frames[i][0] - frames[0][0]), dt: Math.round(dt), render: frames[i][1] == null ? null : Math.round(frames[i][1]), turn: +(frames[i][2] - frames[i - 1][2]).toFixed(1),
        tiles: tiles.filter((t) => t[0] > frames[i - 1][0] - 30 && t[0] <= frames[i][0]).map((t) => t[1] + ':' + t[2]).slice(0, 8), nt: tiles.filter((t) => t[0] > frames[i - 1][0] - 30 && t[0] <= frames[i][0]).length,
        prog: prog.filter((t) => t[0] > frames[i - 1][0] && t[0] <= frames[i][0]).length, task: tasks.filter((t) => t[0] < frames[i][0] && t[0] + t[1] > frames[i - 1][0]).map((t) => t[1]) }); }
      const secs: any[] = []; for (let k = 0; k < 24; k++) { const f = frames.filter((x) => x[0] >= frames[0][0] + k * 1000 && x[0] < frames[0][0] + (k + 1) * 1000); secs.push([f.length, f.length > 1 ? +(f[f.length - 1][2] - f[0][2]).toFixed(0) : 0, tiles.filter((x) => x[0] >= frames[0][0] + k * 1000 && x[0] < frames[0][0] + (k + 1) * 1000).length]); }
      const names: any = {}; try { for (const id of ['transit', 'poi']) { names[id] = [...new Set(map.queryRenderedFeatures({ target: { featuresetId: 'poi', importId: 'basemap' } }).map((f: any) => f.properties.name + '/' + (f.properties.group ?? f.properties.class)))].slice(0, 15); } } catch (e: any) { names.err = e.message; }
      return { slow, secs, names, n: frames.length };
    });
    console.log('DIAG', c.id, JSON.stringify(r.secs)); for (const x of r.slow) console.log('SLOW', JSON.stringify(x)); console.log('NAMES', JSON.stringify(r.names));
    fs.writeFileSync(`${out}/${c.id}.json`, JSON.stringify(r, null, 1));
    return;
  }
  if (c.kind === 'shadow') {
    await setSpeedKmh(page, 5);
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${out}/${c.id}-on.png` });
    await page.evaluate(() => {
      const map = (window as any).__RTW_MAP__;
      const key: any = { building: 'building-cast-shadows', 'fill-extrusion': 'fill-extrusion-cast-shadows', model: 'model-cast-shadows' };
      const visit = (s2: any) => { for (const l of Object.values(s2._layers ?? {}) as any[]) if (key[l.type]) s2.setPaintProperty(l.id, key[l.type], false); for (const x of s2.fragments ?? []) if (x.style) visit(x.style); };
      visit(map.style); map._update(true);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${c.id}-off.png` });
    return;
  }
  if (c.kind === 'trees') {
    page.on('console', (m) => { if (/MAPERR|model/i.test(m.text())) console.log('PAGE', m.text().slice(0, 220)); });
    page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)));
    const { loadLocalData, toLocal, toLngLat } = await import('../trees/tile-data.mjs');
    const { placeTrees, speciesFor } = await import('../trees/placement.mjs');
    await setSpeedKmh(page, c.kmh ?? 15);
    await page.waitForTimeout(c.waitMs ?? 8000);
    const info = await page.evaluate(() => {
      const m = (window as any).__RTW_MAP__; const src = m.getSource('route');
      const d = src?._data ?? src?.serialize?.().data;
      return { center: m.getCenter().toArray(), route: d?.geometry?.coordinates ?? d?.features?.[0]?.geometry?.coordinates ?? [] };
    });
    const L = toLocal(info.center), U = toLngLat(info.center);
    const data = await loadLocalData(info.center, 480);
    console.log('TREES data', c.id, 'route', info.route.length, 'roads', data.roads.length, 'green', data.greens.length, 'bld', data.buildings.length, 'real', data.realTrees.length);
    await page.screenshot({ path: `${out}/${c.id}-none.png` });
    const fps = () => page.evaluate(async () => {
      const map = (window as any).__RTW_MAP__; let n = 0; const f = () => n++; map.on('render', f);
      const t = performance.now(); await new Promise((r) => setTimeout(r, 4000)); map.off('render', f);
      return +(n * 1000 / (performance.now() - t)).toFixed(1);
    });
    const show = (on: boolean) => page.evaluate((v2) => { const m = (window as any).__RTW_MAP__; if (m.getLayer('tr')) m.setLayoutProperty('tr', 'visibility', v2 ? 'visible' : 'none'); }, on);
    for (const v of c.variants) {
      const trees = v.mapbox ? placeTrees(data, [0, 0], { ...v.opt, route: info.route.map(L) }) : placeTrees(data, [0, 0], { ...v.opt, route: info.route.map(L) });
      const features = trees.map((t: any) => ({ type: 'Feature', properties: { m: v.mapbox ? (t.kind === 'shrub' ? 'tree-shrub' : t.kind === 'wood' && t.h > 0.6 ? 'mb-pine' : 'mb-oak') : 'tree-' + speciesFor(t, v.style), r: Math.floor(t.rot / 45) % 8, k: Math.min(3, Math.floor((t.scale - 0.82) / 0.1)) }, geometry: { type: 'Point', coordinates: U([t.x, t.y]) } }));
      await page.evaluate(({ features, token }: any) => {
        const m = (window as any).__RTW_MAP__;
        if (!(window as any).__treeModels) {
          (window as any).__treeModels = true;
          m.on('error', (e: any) => console.log('MAPERR', String(e?.error?.message ?? e).slice(0, 200)));
          for (const id of ['round-broad', 'round-tall', 'round-conifer', 'facet-broad', 'facet-tall', 'facet-conifer', 'shrub']) m.addModel('tree-' + id, location.origin + '/trees/' + id + '.glb');
          m.addModel('mb-oak', 'mapbox://models/mapbox/oak1-v4-lod2.glb'); m.addModel('mb-pine', 'mapbox://models/mapbox/pine1-v4-lod2.glb');
        }
        const fc = { type: 'FeatureCollection', features };
        if (m.getSource('tr')) m.getSource('tr').setData(fc);
        else {
          m.addSource('tr', { type: 'geojson', data: fc, maxzoom: 15 });
          const rot: any = ['match', ['get', 'r']]; for (let i = 0; i < 8; i++) rot.push(i, ['literal', [0, 0, i * 45]]); rot.push(['literal', [0, 0, 0]]);
          const sc: any = ['match', ['get', 'k']]; [0.85, 0.95, 1.05, 1.18].forEach((x, i) => sc.push(i, ['literal', [x, x, x]])); sc.push(['literal', [1, 1, 1]]);
          m.addLayer({ id: 'tr', type: 'model', source: 'tr', slot: 'middle', layout: { 'model-id': ['get', 'm'] }, paint: { 'model-rotation': rot, 'model-scale': sc, 'model-cutoff-fade-range': 0, 'model-cast-shadows': false, 'model-receive-shadows': false } });
        }
      }, { features });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${out}/${c.id}-${v.id}.png` });
      const on1 = await fps(); await show(false); await page.waitForTimeout(600); const off1 = await fps(); await show(true); await page.waitForTimeout(600); const on2 = await fps();
      console.log('TREEFPS', c.id, v.id, 'on', on1, 'off', off1, 'on', on2);
      console.log('TREES', c.id, v.id, trees.length, JSON.stringify(trees.reduce((a: any, t: any) => { a[t.kind] = (a[t.kind] ?? 0) + 1; return a; }, {})));
    }
    return;
  }
  if (c.kind === 'product-trees') {
    page.on('console', (m) => { if (/rideTrees|rideViewDistance|MAPERR/i.test(m.text())) console.log('PAGE', m.text().slice(0, 200)); });
    page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)));
    await page.evaluate(() => { const w = window as any; w.__tasks = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__tasks.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); });
    for (let i = 0; i < (c.shots ?? 4); i++) {
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${out}/${c.id}-${i}.png` });
    }
    const info = await page.evaluate(async () => {
      const m = (window as any).__RTW_MAP__;
      const src = m.getSource('boxcycle-ride-trees-src');
      const data = src?._data ?? null;
      const by: any = {}; for (const f of data?.features ?? []) by[f.properties.m] = (by[f.properties.m] ?? 0) + 1;
      const fps = async (ms: number) => { let n = 0; const f = () => n++; m.on('render', f); const t = performance.now(); await new Promise((r) => setTimeout(r, ms)); m.off('render', f); return +(n * 1000 / (performance.now() - t)).toFixed(1); };
      const on: number[] = [], off: number[] = [];
      for (let i = 0; i < 4; i++) {
        on.push(await fps(2500)); m.setLayoutProperty('boxcycle-ride-trees', 'visibility', 'none'); await new Promise((r) => setTimeout(r, 500));
        off.push(await fps(2500)); m.setLayoutProperty('boxcycle-ride-trees', 'visibility', 'visible'); await new Promise((r) => setTimeout(r, 500));
      }
      return { total: data?.features?.length ?? null, by, on, off, tasks: (window as any).__tasks.filter((x: number) => x > 80).length };
    });
    console.log('PT', c.id, JSON.stringify(info));
    fs.writeFileSync(`${out}/${c.id}.json`, JSON.stringify(info, null, 1));
    if (c.end) {
      const stop = page.getByRole('button', { name: '주행 종료' });
      if (!(await stop.isVisible())) await page.mouse.click(700, 200);
      await stop.click();
      await page.waitForTimeout(5000);
      console.log('PTEND', c.id, JSON.stringify(await page.evaluate(() => { const m = (window as any).__RTW_MAP__; return { layer: !!m.getLayer('boxcycle-ride-trees'), src: !!m.getSource('boxcycle-ride-trees-src'), data: !!m.getLayer('boxcycle-ride-tree-data') }; })));
    }
    return;
  }
  if (c.kind === 'ablate') {
    await setSpeedKmh(page, 5);
    await page.waitForTimeout(8000);
    const rows = await page.evaluate(async () => {
      const map = (window as any).__RTW_MAP__;
      const all = (): any[] => Object.values(map.style._mergedLayers);
      const pick: any = {
        base: () => [],
        supplementText: () => all().filter((l) => l.id.startsWith('boxcycle-standard-')),
        standardText: () => all().filter((l) => l.type === 'symbol' && l.scope === 'basemap'),
        building2d: () => all().filter((l) => l.id === '2d-building'),
        buildings3d: () => all().filter((l) => ['3d-building', 'procedural-buildings', 'building-models'].includes(l.id)),
        trees: () => all().filter((l) => l.id === 'trees'),
        standardLines: () => all().filter((l) => l.type === 'line' && l.scope === 'basemap'),
        appOverlays: () => all().filter((l) => l.scope !== 'basemap' && l.id.startsWith('boxcycle-') && !l.id.startsWith('boxcycle-standard-') && l.type !== 'custom'),
        riders: () => all().filter((l) => l.type === 'custom'),
      };
      const hide = (ls: any[], off: boolean) => { for (const l of ls) { if (off) { l.__v = l.visibility; l.visibility = 'none'; } else if (l.__v !== undefined) { l.visibility = l.__v; delete l.__v; } } };
      const measure = async (ms: number) => { let n = 0; const f = () => n++; map.on('render', f); const t = performance.now(); await new Promise((r) => setTimeout(r, ms)); map.off('render', f); return +(n * 1000 / (performance.now() - t)).toFixed(1); };
      const out: any = {};
      for (let round = 0; round < 2; round++) for (const k of Object.keys(pick)) {
        const b = await measure(2000);
        const ls = pick[k]();
        const orig = map.style._mergedLayers;
        const saved = ls.map((l: any) => [l, l.isHidden]);
        for (const l of ls) l.isHidden = () => true;
        await new Promise((r) => setTimeout(r, 400));
        const v = await measure(2500);
        for (const [l, f] of saved) { delete l.isHidden; void f; }
        await new Promise((r) => setTimeout(r, 400));
        (out[k] ??= []).push({ n: ls.length, base: b, off: v, gainMs: +(1000 / b - 1000 / v).toFixed(1) });
        void orig; void hide;
      }
      return out;
    });
    for (const [k, v] of Object.entries(rows)) console.log('ABL', c.id, k, JSON.stringify(v));
    fs.writeFileSync(`${out}/${c.id}.json`, JSON.stringify(rows, null, 1));
    return;
  }
  if (c.kind === 'lifecycle') {
    const state = () => page.evaluate(() => {
      const m = (window as any).__RTW_MAP__, t = m.transform;
      return { far: Math.round(t._farZ / t.pixelsPerMeter), center: +(t.cameraToCenterDistance / t.pixelsPerMeter).toFixed(1), pitch: +t.pitch.toFixed(1), zoom: +t.zoom.toFixed(1), terrain: !!m.getTerrain() };
    });
    const log: any[] = [];
    const mark = async (step: string) => { const r = { step, ...(await state()) }; log.push(r); console.log('LIFE', JSON.stringify(r)); };
    await page.waitForTimeout(6000);
    await mark('riding-cam2');
    const qc = page.getByRole('button', { name: /카메라 메뉴/ }).first();
    await page.mouse.move(700, 300); await page.mouse.click(700, 200);
    await qc.click();
    await page.getByRole('menuitemradio', { name: '평면 카메라 · 500m 상공' }).click();
    await page.waitForTimeout(4000);
    await mark('cam1-500m');
    await qc.click();
    await page.getByRole('menuitemradio', { name: /카메라 2/ }).first().click();
    await page.waitForTimeout(4000);
    await mark('back-cam2');
    if (c.terrainOn) {
      if (!(await page.getByRole('button', { name: /카메라 메뉴/ }).first().isVisible())) await page.mouse.click(700, 200);
      await page.getByRole('button', { name: /카메라 메뉴/ }).first().click();
      await page.getByRole('menuitemcheckbox', { name: /3D 뷰/ }).click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(6000);
      await mark('terrain-on');
    }
    await setSpeedKmh(page, 40);
    await page.evaluate(() => {
      const m = (window as any).__RTW_MAP__; const w = window as any; w.__calls = [];
      for (const k of ['easeTo', 'setFreeCameraOptions', 'flyTo', 'fitBounds']) { const o = m[k].bind(m); m[k] = (x: any, ...r: any[]) => { w.__calls.push([Math.round(performance.now()), k, JSON.stringify({ pitch: x?.pitch, zoom: x?.zoom, duration: x?.duration })]); return o(x, ...r); }; }
    });
    const seen = { arrival: 0, shot: false };
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      const r = await page.evaluate(() => ({ label: Array.from(document.querySelectorAll('.ride-milestone-label')).map((e) => e.textContent).join('|'), pitch: (window as any).__RTW_MAP__.getPitch() }));
      if (r.label.includes('완주')) { if (!seen.arrival) seen.arrival = Date.now(); if (!seen.shot && Date.now() - seen.arrival > 900) { seen.shot = true; await page.screenshot({ path: `${out}/${c.id}-arrival.png` }); await mark('arrival'); } }
      else if (seen.arrival) { console.log('LIFE arrival scene ms', Date.now() - seen.arrival); break; }
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(4000);
    await mark('after-ride');
    console.log('LIFE calls', JSON.stringify(await page.evaluate(() => (window as any).__calls.slice(-12))));
    await page.screenshot({ path: `${out}/${c.id}-after-ride.png` });
    fs.writeFileSync(`${out}/${c.id}.json`, JSON.stringify({ log, arrivalSeen: !!seen.arrival }, null, 1));
    if (!seen.arrival) throw new Error('도착 연출이 나오지 않았다');
    return;
  }
  if (c.lite) await page.evaluate((lite: any) => {
    const map = (window as any).__RTW_MAP__;
    if (lite.poi) for (const k of ['showPointOfInterestLabels', 'showTransitLabels']) map.setConfigProperty('basemap', k, false);
    if (lite.shadow) {
      const key: any = { building: 'building-cast-shadows', 'fill-extrusion': 'fill-extrusion-cast-shadows', model: 'model-cast-shadows' };
      const visit = (s: any) => {
        for (const l of Object.values(s._layers ?? {}) as any[]) if (key[l.type]) s.setPaintProperty(l.id, key[l.type], false);
        for (const x of s.fragments ?? []) if (x.style) visit(x.style);
      };
      visit(map.style);
      map._update(true);
    }
  }, c.lite);
  await page.waitForTimeout(12000);
  const row = await page.evaluate(async (sec: number) => {
    const map = (window as any).__RTW_MAP__;
    const ts: number[] = [];
    const rec = () => ts.push(performance.now());
    map.on('render', rec);
    await new Promise((r) => setTimeout(r, sec * 1000));
    map.off('render', rec);
    const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
    const span = (ts[ts.length - 1] - ts[0]) / 1000;
    let min1 = 1e9;
    for (let s = 0; s < Math.floor(span); s++) min1 = Math.min(min1, ts.filter((t) => t >= ts[0] + s * 1000 && t < ts[0] + (s + 1) * 1000).length);
    const tr = map.transform;
    const tiles: any = {};
    for (const [k, sc] of Object.entries(map.style._mergedSourceCaches) as any) {
      const h: any = {};
      for (const id of sc.getRenderableIds()) { const z = sc.getTileByID(id).tileID.canonical.z; h[z] = (h[z] ?? 0) + 1; }
      if (Object.keys(h).length) tiles[k] = h;
    }
    const mb = performance.getEntriesByType('resource').filter((e: any) => /mapbox\.com/.test(e.name));
    return {
      fps: +((ts.length - 1) / span).toFixed(1), min1, p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: Math.round(d[d.length - 1]),
      farM: Math.round(tr._farZ / tr.pixelsPerMeter), centerM: +(tr.cameraToCenterDistance / tr.pixelsPerMeter).toFixed(1),
      altM: +map.getFreeCameraOptions().position.toAltitude().toFixed(2), pitch: +tr.pitch.toFixed(1), zoom: +tr.zoom.toFixed(2),
      proj: tr.projection.name, terrain: !!map.getTerrain(), style: map.getStyle().name ?? null, tiles,
      req: mb.length, kb: Math.round(mb.reduce((a: number, e: any) => a + (e.transferSize || 0), 0) / 1024), center: map.getCenter().toArray(),
    };
  }, 10);
  fs.appendFileSync(`${out}/rows.jsonl`, JSON.stringify({ id: c.id, course: c.course, viewdist: c.viewdist, lite: c.lite ?? null, ...row }) + '\n');
  await page.screenshot({ path: `${out}/${c.id}.png` });
  const main = Object.fromEntries(Object.entries(row.tiles).filter(([k]: any) => /^(fill-extrusion|other):(composite|procedural)/.test(k)));
  console.log('MEASURE', c.id, 'fps', row.fps, 'min', row.min1, 'p95', row.p95, 'far', row.farM, 'center', row.centerM, 'alt', row.altM, row.proj, 'terrain', row.terrain, 'req', row.req, 'kb', row.kb, JSON.stringify(main));
});

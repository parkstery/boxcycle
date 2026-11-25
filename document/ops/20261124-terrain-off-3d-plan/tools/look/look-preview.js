/* 개발 서버 전용 — 4단계(건물 외관·먼 풍경) 비교 패널. ?look=1 로 켠다. 선택이 끝나면 제거한다. */
(() => {
  if (window.__lookPreview) return;
  const KEY = 'rtw.lookPreview', POS = 'rtw.lookPreview.pos';
  const PRESET = {
    now: { b: 'now', sky: 'now', ridge: false }, color: { b: 'color', sky: 'now', ridge: false }, windows: { b: 'windows', sky: 'now', ridge: false },
    fog: { b: 'color', sky: 'clear', ridge: false }, ridge: { b: 'color', sky: 'clear', ridge: true }, all: { b: 'windows', sky: 'clear', ridge: true },
  };
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 못 해도 이번 화면에서는 동작 */ } };
  const asked = new URLSearchParams(location.search).get('look');
  const state = { ...PRESET.all, ...(load(KEY) ?? {}), ...(PRESET[asked] ?? {}) };

  // ── 패널 ──────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `#look-preview{position:fixed;z-index:9998;right:12px;top:250px;width:248px;max-height:calc(100dvh - 16px);overflow:auto;background:rgba(10,14,18,.86);color:#edeff2;border-radius:12px;padding:4px 10px 10px;font:13px/1.35 system-ui}
#look-preview .h{display:flex;align-items:center;gap:6px}#look-preview .g{min-width:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;color:#9fb0c0;cursor:grab;touch-action:none;user-select:none}
#look-preview .h strong{flex:1}#look-preview .t{margin:6px 0 4px;color:#9fb0c0}#look-preview .r{display:flex;flex-wrap:wrap;gap:5px}
#look-preview button{min-height:34px;padding:0 9px;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}
#look-preview.idle .t,#look-preview.idle .r{display:none}#look-preview button.on{background:#005ffd;border-color:#005ffd;color:#fff}#look-preview output{display:block;margin-top:8px;font-size:12px;color:#9fb0c0}`;
  document.head.append(css);
  const el = document.createElement('section');
  el.id = 'look-preview';
  el.className = 'idle';
  el.innerHTML = `<div class="h"><span class="g" title="끌어서 옮기기">⠿</span><strong>4단계 비교</strong></div>
<div class="t">건물</div><div class="r" data-k="b"><button data-v="now">지금</button><button data-v="color">색 변화</button><button data-v="windows">색+창문</button></div>
<div class="t">안개·하늘</div><div class="r" data-k="sky"><button data-v="now">지금</button><button data-v="clear">1km까지 맑게</button></div>
<div class="t">먼 산 능선</div><div class="r" data-k="ridge"><button data-v="0">끔</button><button data-v="1">켬</button></div>
<div class="t">한 번에</div><div class="r"><button data-p="now">모두 지금</button><button data-p="all">모두 적용</button></div>
<output>주행을 시작하면 적용됩니다.</output>`;
  document.body.append(el);
  const status = el.querySelector('output');
  const paint = () => {
    for (const row of el.querySelectorAll('[data-k]')) for (const b of row.querySelectorAll('button')) {
      const v = row.dataset.k === 'ridge' ? b.dataset.v === '1' : b.dataset.v;
      b.classList.toggle('on', state[row.dataset.k] === v);
    }
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.p) Object.assign(state, PRESET[b.dataset.p]);
    else { const k = b.parentElement.dataset.k; state[k] = k === 'ridge' ? b.dataset.v === '1' : b.dataset.v; }
    save(KEY, state); paint(); tick();
  });
  for (const n of ['pointerdown', 'touchstart']) el.addEventListener(n, (e) => e.stopPropagation());
  const place = (x, y) => { el.style.right = 'auto'; el.style.left = Math.max(0, Math.min(innerWidth - el.offsetWidth, x)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 48, y)) + 'px'; };
  const p0 = load(POS); if (p0) place(p0.x, p0.y);
  const grip = el.querySelector('.g'); let drag = null;
  grip.addEventListener('pointerdown', (e) => { const r = el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', (e) => { if (drag) place(e.clientX - drag.dx, e.clientY - drag.dy); });
  for (const n of ['pointerup', 'pointercancel']) grip.addEventListener(n, () => { if (drag) { const r = el.getBoundingClientRect(); save(POS, { x: r.left, y: r.top }); } drag = null; });
  paint();

  // ── 지도 ──────────────────────────────────────────────
  let m = null, base = null, orig = null, done = {}, bands = null, ridgeAt = null, ridgeBusy = false, patternAt = null;
  const metersBetween = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 110540);
  const findBase = () => {
    let found = null;
    const visit = (s) => { if (s?._layers?.['3d-building']) found = s; for (const x of s?.fragments ?? []) if (x.style) visit(x.style); };
    visit(m.style);
    return found;
  };
  const HEIGHT = ['coalesce', ['get', 'est_height'], ['number', ['get', 'height'], 3]];
  const SEED = ['%', ['abs', ['number', ['id'], 0]], 7];
  const LOW = ['#d9c3ad', '#cfa58b', '#e6dccb', '#c9c6bd', '#bf8f78', '#dcd3b8', '#b9c0ae'];
  const MID = ['#e4ded2', '#c8cdd0', '#d8c9b4', '#b8c4cc', '#d9d6d0', '#c4ada0', '#e9e6df'];
  const HIGH = ['#e6e3dc', '#b4c3cf', '#d3d7d9', '#c7bfb2', '#a9bac6', '#dcd5c8', '#cfd6d4'];
  const pick = (arr) => ['match', SEED, ...arr.flatMap((c, i) => [i, c]), arr[0]];
  const COLOR = ['step', HEIGHT, pick(LOW), 9, pick(MID), 24, pick(HIGH)];
  const FLOOR_M = 3.3, NEAR_M = 250;

  /** 벽 그림 한 장 = 가로 4칸 × 세로 4층. */
  function wallImage(wall, kind, seed) {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); g.fillStyle = wall; g.fillRect(0, 0, S, S);
    {
      let r = seed * 7919 + 13; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const cell = S / 4, glass = ['#7f97a6', '#8aa3b1', '#748b99', '#93a9b4'];
      for (let y = 0; y < 4; y++) {
        if (kind !== 'house') { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, y * cell + cell - 5, S, 5); }
        for (let x = 0; x < 4; x++) {
          g.fillStyle = glass[Math.floor(rnd() * 4)];
          if (kind === 'house') {
            if ((x + y) % 2 === 0 || rnd() > 0.35) { g.fillRect(x * cell + 18, y * cell + 16, 28, 28); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x * cell + 18, y * cell + 42, 28, 3); }
          } else if (kind === 'flat') { g.fillRect(x * cell + 9, y * cell + 14, 46, 34); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x * cell + 31, y * cell + 14, 2, 34); } else g.fillRect(x * cell + 4, y * cell + 16, 56, 36);
        }
      }
    }
    return g.getImageData(0, 0, S, S);
  }
  /** 이미지 이름표·자료 형식은 SDK 내부 클래스라, 지도에 한 번 올린 것을 빌려 Standard 조각에도 올린다. */
  function putImage(name, image, pixelRatio) {
    if (m.hasImage(name)) m.removeImage(name);
    m.addImage(name, image, { pixelRatio });
    const id = m.style.listImages().find((x) => (x.name ?? x) === name);
    if (base.getImage(id)) base.removeImage(id);
    base.addImage(id, { ...m.style.getImage(id) });
  }
  let imagesFor = null;
  const WIN = 'look-win';
  const SOLID = [['==', ['get', 'extrude'], 'true'], ['==', ['get', 'underground'], 'false']];
  const dropWindows = () => { if (base._layers[WIN]) { base.removeLayer(WIN); m.style.mergeLayers(); } };
  function ensureImages() {
    const tz = m.transform.tileZoom;
    if (imagesFor && imagesFor.tz === tz && imagesFor.base === base) return false;
    dropWindows();
    const ratio = 256 / (FLOOR_M * 4 / (40075016.686 * Math.cos(m.getCenter().lat * Math.PI / 180) / (512 * 2 ** tz)));
    LOW.forEach((c, i) => putImage('lk-l' + i, wallImage(c, 'house', i), ratio));
    MID.forEach((c, i) => putImage('lk-m' + i, wallImage(c, 'flat', i + 10), ratio));
    HIGH.forEach((c, i) => putImage('lk-h' + i, wallImage(c, i % 2 ? 'strip' : 'flat', i + 20), ratio));
    imagesFor = { tz, base };
    return true;
  }
  const setPaint = (k, v) => { base.setPaintProperty('3d-building', k, v); };
  /** 창문은 Standard 의 건물 자료(est_height 포함)를 그대로 쓰는 별도 레이어로 250m 안에만 그린다. */
  function applyBuildings(mode) {
    if (mode !== 'windows') {
      if (done.b === mode) return;
      dropWindows(); patternAt = null;
      base.setFilter('3d-building', orig.filter);
      setPaint('fill-extrusion-color', mode === 'color' ? COLOR : orig.color);
    } else {
      const here = m.getCenter().toArray(), fresh = ensureImages();
      if (done.b === mode && !fresh && patternAt && metersBetween(patternAt, here) < 100) return;
      const near = ['<', ['distance', { type: 'Point', coordinates: here }], NEAR_M];
      setPaint('fill-extrusion-color', COLOR);
      if (base._layers[WIN]) base.setFilter(WIN, ['all', ...SOLID, near]);
      else base.addLayer({
        id: WIN, type: 'fill-extrusion', source: 'composite', 'source-layer': 'building', minzoom: 15, filter: ['all', ...SOLID, near],
        layout: { 'fill-extrusion-edge-radius': 0.4 },
        paint: {
          'fill-extrusion-pattern': ['concat', 'lk-', ['step', HEIGHT, 'l', 9, 'm', 24, 'h'], SEED], 'fill-extrusion-height': HEIGHT,
          'fill-extrusion-base': ['case', ['>=', ['number', ['get', 'min_height'], 0], 0], ['number', ['get', 'min_height'], 0], 0],
          'fill-extrusion-opacity': 1, 'fill-extrusion-cast-shadows': false, 'fill-extrusion-cutoff-fade-range': 0,
          'fill-extrusion-ambient-occlusion-intensity': 0.15, 'fill-extrusion-ambient-occlusion-ground-radius': 8,
        },
      }, '3d-building');
      m.style.mergeLayers();
      base.setFilter('3d-building', ['all', ...SOLID, ['!', near]]);
      patternAt = here;
    }
    done.b = mode; m.style._changed = true; m._update(true);
  }
  /** SDK 안개 거리 단위는 「화면 높이만큼의 거리」, 0 은 화면 중심. 250m 에서 시작해 1km 에서 약 90%. */
  function applySky(mode) {
    const unit = m.transform.height / m.transform.pixelsPerMeter;
    if (done.sky === mode && (mode === 'now' || Math.abs(unit / done.unit - 1) < 0.08)) return;
    m.setFog(mode === 'now' ? orig.fog : {
      range: [250, 1590].map((d) => d / unit - 1.5), color: 'hsla(208, 62%, 91%, 0.95)', 'high-color': 'hsl(208, 78%, 80%)',
      'space-color': 'hsl(212, 82%, 68%)', 'horizon-blend': 0.07, 'star-intensity': 0, 'vertical-range': [80, 400],
    });
    done.sky = mode; done.unit = unit;
  }

  // ── 먼 산 능선 — 실제 표고에서 방향별 올려본 각 ───────
  const Z = 11, EARTH = 6371000, STEPS = 720, BANDS = [[1200, 4000], [4000, 9000], [9000, 25000]];
  const tiles = new Map();
  async function demTile(x, y) {
    const k = x + '/' + y;
    if (!tiles.has(k)) tiles.set(k, (async () => {
      const r = await fetch(`https://api.mapbox.com/v4/mapbox.terrain-rgb/${Z}/${x}/${y}.pngraw?access_token=${window.__LOOK_TOKEN__}`);
      if (!r.ok) return null;
      const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const cv = new OffscreenCanvas(bmp.width, bmp.height), g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data };
    })().catch(() => null));
    return tiles.get(k);
  }
  async function ridgeProfile([lng, lat]) {
    const n = 2 ** Z, X = (lo) => (lo + 180) / 360 * n, Y = (la) => (1 - Math.asinh(Math.tan(la * Math.PI / 180)) / Math.PI) / 2 * n;
    const dLat = 25000 / EARTH * 180 / Math.PI, dLng = dLat / Math.cos(lat * Math.PI / 180), got = new Map(), jobs = [];
    for (let x = Math.floor(X(lng - dLng)); x <= Math.floor(X(lng + dLng)); x++) for (let y = Math.floor(Y(lat + dLat)); y <= Math.floor(Y(lat - dLat)); y++) jobs.push(demTile(x, y).then((t) => got.set(x + '/' + y, t)));
    await Promise.all(jobs);
    const elev = (lo, la) => {
      const fx = X(lo), fy = Y(la), t = got.get(Math.floor(fx) + '/' + Math.floor(fy));
      if (!t) return 0;
      const i = (Math.min(t.h - 1, Math.floor((fy % 1) * t.h)) * t.w + Math.min(t.w - 1, Math.floor((fx % 1) * t.w))) * 4;
      return -10000 + (t.d[i] * 65536 + t.d[i + 1] * 256 + t.d[i + 2]) * 0.1;
    };
    const h0 = elev(lng, lat) + 2, out = [];
    for (const [d0, d1] of BANDS) {
      const deg = new Float32Array(STEPS);
      for (let s = 0; s < STEPS; s++) {
        const b = s / STEPS * 2 * Math.PI; let best = 0;
        for (let d = d0; d <= d1; d *= 1.02) {
          const la = lat + d * Math.cos(b) / EARTH * 180 / Math.PI, lo = lng + d * Math.sin(b) / (EARTH * Math.cos(lat * Math.PI / 180)) * 180 / Math.PI;
          best = Math.max(best, (elev(lo, la) - h0 - d * d / (2 * EARTH * 1.16)) / d);
        }
        deg[s] = Math.atan(best);
      }
      out.push(deg);
    }
    return out;
  }
  const RIDGE = 'look-ridge', RADII = [880, 925, 965];
  const TINT = [[[0.62, 0.71, 0.66], [0.43, 0.55, 0.47]], [[0.74, 0.81, 0.84], [0.55, 0.66, 0.69]], [[0.82, 0.89, 0.95], [0.66, 0.76, 0.85]]];
  const ridgeLayer = () => ({
    id: RIDGE, type: 'custom', renderingMode: '3d', slot: 'middle',
    onAdd(_map, gl) {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
      this.p = gl.createProgram();
      gl.attachShader(this.p, sh(gl.VERTEX_SHADER, 'uniform mat4 u_m; attribute vec4 a; varying float v_t; void main(){ v_t=a.w; gl_Position=u_m*vec4(a.xyz,1.0); }'));
      gl.attachShader(this.p, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec3 u_lo; uniform vec3 u_hi; varying float v_t; void main(){ gl_FragColor=vec4(mix(u_lo,u_hi,smoothstep(0.0,1.0,v_t)),1.0); }'));
      gl.linkProgram(this.p);
      this.at = gl.getAttribLocation(this.p, 'a');
      this.u = { m: gl.getUniformLocation(this.p, 'u_m'), lo: gl.getUniformLocation(this.p, 'u_lo'), hi: gl.getUniformLocation(this.p, 'u_hi') };
      this.parts = RADII.map(() => gl.createBuffer());
      this.fill(gl);
    },
    fill(gl) {
      bands.forEach((deg, k) => {
        const r = RADII[k], v = new Float32Array((STEPS + 1) * 8);
        let maxH = 1; for (const a of deg) maxH = Math.max(maxH, r * Math.tan(a));
        for (let i = 0; i <= STEPS; i++) {
          const a = i / STEPS * 2 * Math.PI, h = r * Math.tan(deg[i % STEPS]), x = Math.sin(a) * r, y = -Math.cos(a) * r;
          v.set([x, y, 0, 0, x, y, h, 0.25 + 0.75 * h / maxH], i * 8);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.parts[k]); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
      });
      this.filled = bands;
    },
    onRemove(_map, gl) { for (const b of this.parts ?? []) gl.deleteBuffer(b); if (this.p) gl.deleteProgram(this.p); },
    render(gl, matrix) {
      if (!bands) return;
      if (this.filled !== bands) this.fill(gl);
      const pos = m.getFreeCameraOptions().position, s = 1 / (40075016.686 * Math.cos(m.getCenter().lat * Math.PI / 180)), M = matrix, o = new Float32Array(16);
      for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = M[c * 4 + r] * s;
      for (let r = 0; r < 4; r++) o[12 + r] = M[r] * pos.x + M[4 + r] * pos.y + M[12 + r];
      gl.useProgram(this.p); gl.uniformMatrix4fv(this.u.m, false, o);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
      gl.bindVertexArray?.(null);
      for (let k = RADII.length - 1; k >= 0; k--) {
        gl.uniform3fv(this.u.lo, TINT[k][0]); gl.uniform3fv(this.u.hi, TINT[k][1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.parts[k]); gl.enableVertexAttribArray(this.at); gl.vertexAttribPointer(this.at, 4, gl.FLOAT, false, 16, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (STEPS + 1) * 2);
      }
    },
  });
  function applyRidge(on) {
    const has = !!m.getLayer(RIDGE);
    if (!on) { if (has) m.removeLayer(RIDGE); return; }
    const here = m.getCenter().toArray();
    if (!ridgeBusy && (!ridgeAt || metersBetween(ridgeAt, here) > 600)) {
      ridgeBusy = true; ridgeAt = here;
      ridgeProfile(here).then((b) => { bands = b; m?.triggerRepaint(); }, () => { ridgeAt = null; }).finally(() => { ridgeBusy = false; });
    }
    if (bands && !has) m.addLayer(ridgeLayer());
  }

  // ── 0.5초마다 상태 맞추기 ─────────────────────────────
  let problem = null;
  function tick() {
    const next = window.__RTW_MAP__;
    if (!next?.style) return;
    try {
      if (next !== m) { m = next; base = null; }
      const b = findBase();
      if (!b) { status.textContent = 'Standard 낮 지도를 선택하세요.'; return; }
      if (b !== base) { base = b; done = { b: 'now', sky: 'now' }; imagesFor = null; patternAt = null; orig = { color: base.getPaintProperty('3d-building', 'fill-extrusion-color'), filter: base.getFilter('3d-building'), fog: m.getFog() }; }
      const riding = m.getPitch() >= 60 && m.getZoom() >= 15 && !m.getTerrain();
      el.classList.toggle('idle', !riding);
      const want = riding ? state : PRESET.now;
      applyBuildings(want.b); applySky(want.sky); applyRidge(want.ridge);
      problem = null;
      status.textContent = riding ? '적용됨' + (want.ridge && !bands ? ' · 능선 계산 중' : '') : '주행을 시작하면 적용됩니다.';
    } catch (err) {
      if (problem !== String(err)) console.warn('[lookPreview]', err);
      problem = String(err);
      status.textContent = '적용 대기: ' + String(err?.message ?? err).slice(0, 80);
    }
  }
  setInterval(tick, 500);
  window.__lookPreview = { state, set(next) { Object.assign(state, next); paint(); tick(); }, info: () => ({ done: { ...done }, ridge: !!m?.getLayer(RIDGE), bands: bands?.map((b) => +(Math.max(...b) * 180 / Math.PI).toFixed(1)) ?? null, status: status.textContent, windows: !!base?._layers[WIN] }) };
})();

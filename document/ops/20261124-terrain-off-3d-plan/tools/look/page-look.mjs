// 브라우저 안에서 도는 시안 적용기(함수 하나를 통째로 page.evaluate 로 넘긴다).
export function installLook() {
  const m = window.__RTW_MAP__;
  m.on('error', (e) => console.log('MAPERR', String(e?.error?.message ?? e).slice(0, 250)));
  const styles = [];
  const visit = (s) => { styles.push(s); for (const x of s.fragments ?? []) if (x.style) visit(x.style); };
  visit(m.style);
  const base = styles.find((s) => s._layers && s._layers['3d-building']);
  const origColor = base.getPaintProperty('3d-building', 'fill-extrusion-color');
  const origFog = m.getFog();

  // ── 건물 ──────────────────────────────────────────────
  const LOW = ['#d9c3ad', '#cfa58b', '#e6dccb', '#c9c6bd', '#bf8f78', '#dcd3b8', '#b9c0ae'];
  const MID = ['#e4ded2', '#c8cdd0', '#d8c9b4', '#b8c4cc', '#d9d6d0', '#c4ada0', '#e9e6df'];
  const HIGH = ['#e6e3dc', '#b4c3cf', '#d3d7d9', '#c7bfb2', '#a9bac6', '#dcd5c8', '#cfd6d4'];
  const HEIGHT = ['coalesce', ['get', 'est_height'], ['number', ['get', 'height'], 3]];
  const KEY = ['%', ['abs', ['number', ['id'], 0]], 7];
  const pick = (arr) => { const e = ['match', KEY]; arr.forEach((c, i) => e.push(i, c)); e.push(arr[0]); return e; };
  const colorExpr = () => ['step', HEIGHT, pick(LOW), 9, pick(MID), 24, pick(HIGH)];

  /** 벽 그림 한 장 = 가로 4칸 × 세로 4층. */
  const wallImage = (wall, kind, seed) => {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); g.fillStyle = wall; g.fillRect(0, 0, S, S);
    let r = seed * 7919 + 13; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const cell = S / 4;
    const glass = ['#7f97a6', '#8aa3b1', '#748b99', '#93a9b4'];
    for (let y = 0; y < 4; y++) {
      if (kind !== 'house') { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, y * cell + cell - 5, S, 5); }
      for (let x = 0; x < 4; x++) {
        g.fillStyle = glass[Math.floor(rnd() * 4)];
        if (kind === 'house') { if ((x + y) % 2 === 0 || rnd() > 0.35) { g.fillRect(x * cell + 18, y * cell + 18, 28, 28); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x * cell + 18, y * cell + 44, 28, 3); } }
        else if (kind === 'flat') { g.fillRect(x * cell + 9, y * cell + 14, 46, 34); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x * cell + 31, y * cell + 14, 2, 34); }
        else { g.fillRect(x * cell + 4, y * cell + 16, 56, 36); }
      }
    }
    return g.getImageData(0, 0, S, S);
  };
  const FLOOR_M = 3.3;
  let imagesFor = null;
  const addImages = () => {
    const tz = m.transform.tileZoom;
    if (imagesFor === tz) return;
    const mPerPx = 40075016.686 * Math.cos(m.getCenter().lat * Math.PI / 180) / (512 * 2 ** tz);
    const ratio = 256 / (FLOOR_M * 4 / mPerPx);
    const put = (id, im) => { if (base.getImage?.(id)) base.removeImage(id); m.addImage(id, im, { pixelRatio: ratio }); };
    LOW.forEach((c, i) => put('lk-l' + i, wallImage(c, 'house', i)));
    MID.forEach((c, i) => put('lk-m' + i, wallImage(c, 'flat', i + 10)));
    HIGH.forEach((c, i) => put('lk-h' + i, wallImage(c, i % 2 ? 'strip' : 'flat', i + 20)));
    imagesFor = tz;
    console.log('LOOK images tileZoom', tz, 'pixelRatio', ratio.toFixed(3));
  };
  const patternExpr = () => ['step', HEIGHT, ['concat', 'lk-l', KEY], 9, ['concat', 'lk-m', KEY], 24, ['concat', 'lk-h', KEY]];
  const WIN = 'look-win';
  const removeWindows = () => { if (m.getLayer(WIN)) m.removeLayer(WIN); };
  const setBuilding = (mode, nearM) => {
    removeWindows();
    base.setPaintProperty('3d-building', 'fill-extrusion-color', mode === 'now' ? origColor : colorExpr());
    base.setFilter('3d-building', ['all', ['==', ['get', 'extrude'], 'true'], ['==', ['get', 'underground'], 'false']]);
    if (mode === 'windows') {
      addImages();
      if (!m.getSource('look-b')) m.addSource('look-b', { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' });
      const here = { type: 'Point', coordinates: m.getCenter().toArray() };
      const near = ['<', ['distance', here], nearM];
      const solid = [['==', ['get', 'extrude'], 'true'], ['==', ['get', 'underground'], 'false']];
      base.setFilter('3d-building', ['all', ...solid, ['!', near]]);
      m.addLayer({
        id: WIN, type: 'fill-extrusion', source: 'look-b', 'source-layer': 'building', minzoom: 15, slot: 'middle',
        filter: ['all', ...solid, near],
        paint: {
          'fill-extrusion-pattern': patternExpr(), 'fill-extrusion-height': HEIGHT,
          'fill-extrusion-base': ['case', ['>=', ['number', ['get', 'min_height'], 0], 0], ['number', ['get', 'min_height'], 0], 0],
          'fill-extrusion-opacity': 1, 'fill-extrusion-cast-shadows': false, 'fill-extrusion-ambient-occlusion-intensity': 0.15,
          'fill-extrusion-ambient-occlusion-ground-radius': 8, 'fill-extrusion-cutoff-fade-range': 0,
        },
      });
    }
    m.style._changed = true; m._update(true);
  };

  // ── 하늘·안개 ────────────────────────────────────────
  const FOGS = {
    now: () => origFog,
    // SDK 안개 거리의 단위는 「화면 높이만큼의 거리」이고 0 은 화면 중심이다. 실제 m 로 바꿔 적는다.
    // 250m 에서 시작해 1km 에서 약 90% (지수식이라 끝값을 더 멀리 둔다).
    clear: () => ({ range: [250, 1590].map((d) => +(d / (m.transform.height / m.transform.pixelsPerMeter) - 1.5).toFixed(1)), color: 'hsla(208, 62%, 91%, 0.95)', 'high-color': 'hsl(208, 78%, 80%)', 'space-color': 'hsl(212, 82%, 68%)', 'horizon-blend': 0.07, 'star-intensity': 0, 'vertical-range': [80, 400] }),
  };

  // ── 먼 산 능선(별도 얇은 물체) ───────────────────────
  let bands = null;
  const RIDGE = 'look-ridge';
  const RADII = [880, 925, 965];
  const COLORS = [[[0.62, 0.71, 0.66], [0.43, 0.55, 0.47]], [[0.74, 0.81, 0.84], [0.55, 0.66, 0.69]], [[0.82, 0.89, 0.95], [0.66, 0.76, 0.85]]];
  const ridgeLayer = () => ({
    id: RIDGE, type: 'custom', renderingMode: '3d', slot: 'middle',
    onAdd(map, gl) {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.log('LOOK shader', gl.getShaderInfoLog(o)); return o; };
      this.p = gl.createProgram();
      gl.attachShader(this.p, sh(gl.VERTEX_SHADER, 'uniform mat4 u_m; attribute vec4 a; varying float v_t; void main(){ v_t=a.w; gl_Position=u_m*vec4(a.xyz,1.0); }'));
      gl.attachShader(this.p, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec3 u_lo; uniform vec3 u_hi; varying float v_t; void main(){ gl_FragColor=vec4(mix(u_lo,u_hi,smoothstep(0.0,1.0,v_t)),1.0); }'));
      gl.linkProgram(this.p);
      this.parts = bands.map((b, k) => {
        const n = b.deg.length, r = RADII[k], v = [];
        const maxH = Math.max(1, ...b.deg.map((d) => r * Math.tan(d * Math.PI / 180)));
        for (let i = 0; i <= n; i++) {
          const a = i / n * 2 * Math.PI, h = r * Math.tan(b.deg[i % n] * Math.PI / 180);
          v.push(Math.sin(a) * r, -Math.cos(a) * r, 0, 0, Math.sin(a) * r, -Math.cos(a) * r, h, 0.25 + 0.75 * h / maxH);
        }
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
        return { buf, count: (n + 1) * 2, k };
      });
    },
    render(gl, matrix) {
      const pos = m.getFreeCameraOptions().position, lat = m.getCenter().lat;
      const s = 1 / (40075016.686 * Math.cos(lat * Math.PI / 180));
      const M = Array.from(matrix), o = new Float32Array(16);
      for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = M[c * 4 + r] * s;
      for (let r = 0; r < 4; r++) o[12 + r] = M[r] * pos.x + M[4 + r] * pos.y + M[12 + r];
      gl.useProgram(this.p);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.p, 'u_m'), false, o);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
      const at = gl.getAttribLocation(this.p, 'a');
      gl.bindVertexArray?.(null);
      for (const q of [...this.parts].reverse()) {
        gl.uniform3fv(gl.getUniformLocation(this.p, 'u_lo'), COLORS[q.k][0]); gl.uniform3fv(gl.getUniformLocation(this.p, 'u_hi'), COLORS[q.k][1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, q.buf); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 4, gl.FLOAT, false, 16, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, q.count);
      }
    },
  });

  let fogMode = 'now', bMode = 'now';
  window.__look = {
    dump() {
      const ls = Object.values(base._layers).filter((l) => /build|landmark|facade|sky/i.test(l.id)).map((l) => l.serialize());
      return { layers: ls, fog: origFog, tz: m.transform.tileZoom, zoom: m.getZoom() };
    },
    freeze() { for (const k of ['jumpTo', 'easeTo', 'setFreeCameraOptions', 'flyTo', 'panTo', 'setCenter', 'setZoom', 'setPitch', 'setBearing']) m[k] = () => m; },
    setRidgeData(b) { bands = b; },
    apply(v) {
      if ((v.building ?? 'now') !== bMode || v.building === 'windows') { bMode = v.building ?? 'now'; setBuilding(bMode, v.nearM ?? 250); }
      if ((v.fog ?? 'now') !== fogMode) { fogMode = v.fog ?? 'now'; m.setFog(FOGS[fogMode]()); }
      const want = !!v.ridge, has = !!m.getLayer(RIDGE);
      if (want && !has) m.addLayer(ridgeLayer()); if (!want && has) m.removeLayer(RIDGE);
    },
  };
}

// 4단계 시안 — 실제 주행 화면에 건물 외관·원경을 시험으로 얹는다. 제품 코드는 바꾸지 않는다.
import fs from 'node:fs';
import { ridgeProfile } from './ridge.mjs';
import { installLook } from './page-look.mjs';

export async function runLook(page, c, out, setSpeed) {
  page.on('console', (m) => { if (/LOOK|MAPERR|WebGL|shader/i.test(m.text())) console.log('PAGE', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)));
  await page.waitForTimeout(c.runMs ?? 6000);
  if (!(await page.getByRole('button', { name: '주행 종료' }).isVisible())) await page.mouse.click(700, 200);
  await setSpeed(c.slowKmh ?? 5);
  await page.waitForTimeout(5000);
  if (c.panel) {
    const token = fs.readFileSync('C:/20.HDev/boxcycle/apps/web/.env', 'utf8').match(/VITE_MAPBOX_ACCESS_TOKEN=(.*)/)[1].trim().replace(/['"]/g, '');
    page.on('console', (m) => { if (/lookPreview|Image|pattern|Expression/i.test(m.text())) console.log('PAGE', m.text().slice(0, 300)); });
    await page.evaluate(() => { window.__RTW_MAP__.on('error', (e) => console.log('MAPERR', String(e?.error?.message ?? e).slice(0, 250))); });
    await page.evaluate((x) => { window.__LOOK_TOKEN__ = x; }, token);
    await page.addScriptTag({ content: fs.readFileSync('C:/20.HDev/boxcycle/document/ops/20261124-terrain-off-3d-plan/tools/look/look-preview.js', 'utf8') });
    const now = { b: 'now', sky: 'now', ridge: false };
    for (const st of [{ ...now }, { ...now, b: 'color' }, { ...now, b: 'windows' }, { b: 'color', sky: 'clear', ridge: false }, { b: 'windows', sky: 'clear', ridge: true }, { ...now }]) {
      await page.evaluate((x) => window.__lookPreview.set(x), st);
      await page.waitForTimeout(6000);
      const r = await page.evaluate(async () => {
        const m = window.__RTW_MAP__; let n = 0; const f = () => n++; m.on('render', f);
        const t = performance.now(); await new Promise((q) => setTimeout(q, 4000)); m.off('render', f);
        const gl = m.painter.context.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const px = await new Promise((q) => m.once('render', () => { const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); const s = new Set(); for (let y = Math.floor(h * 0.55); y < h * 0.95; y += 3) for (let x = 0; x < w; x += 3) { const i = (y * w + x) * 4; s.add((a[i] >> 4) * 256 + (a[i + 1] >> 4) * 16 + (a[i + 2] >> 4)); } q(s.size); }));
        return { fps: +(n * 1000 / (performance.now() - t)).toFixed(1), colors: px, ...window.__lookPreview.info() };
      });
      console.log('LOOKP', c.id, JSON.stringify(st), JSON.stringify(r));
      if (c.shot) await page.screenshot({ path: `${out}/${c.id}-${st.b}-${st.sky}-${st.ridge}.png` });
    }
    return;
  }
  await page.evaluate(installLook);
  const center = await page.evaluate(() => window.__RTW_MAP__.getCenter().toArray());
  console.log('LOOK center', c.id, center.join(','));
  if (c.dump) {
    const d = await page.evaluate(() => window.__look.dump());
    fs.writeFileSync(`${out}/${c.id}-dump.json`, JSON.stringify(d, null, 1));
  }
  await page.evaluate(() => window.__look.freeze());
  let ridge = null;
  for (const v of c.variants ?? []) {
    if (v.ridge && !ridge) {
      ridge = await ridgeProfile(center);
      await page.evaluate((r) => window.__look.setRidgeData(r), ridge);
      console.log('LOOK ridge max deg', ridge.map((b) => Math.max(...b.deg).toFixed(1)).join(' '));
    }
    await page.evaluate((x) => window.__look.apply(x), v);
    await page.waitForTimeout(v.waitMs ?? 4000);
    await page.screenshot({ path: `${out}/${c.id}-${v.id}.png` });
  }
  // 같은 화면(카메라 고정)에서 차례를 바꿔 두 번 잰다.
  const rows = {};
  for (const list of [c.variants, [...c.variants].reverse()]) for (const v of list) {
    await page.evaluate((x) => window.__look.apply(x), v);
    await page.waitForTimeout(v.building === 'windows' ? 5000 : 1800);
    (rows[v.id] ??= []).push(await page.evaluate(async () => {
      const m = window.__RTW_MAP__; let n = 0; const f = () => n++; m.on('render', f);
      const t = performance.now(); await new Promise((r) => setTimeout(r, 3000)); m.off('render', f);
      return +(n * 1000 / (performance.now() - t)).toFixed(1);
    }));
  }
  console.log('LOOKFPS', c.id, JSON.stringify(rows));
}

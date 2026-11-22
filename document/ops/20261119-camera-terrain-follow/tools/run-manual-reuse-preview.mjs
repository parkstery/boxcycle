// Manual-only production preview. No ride automation or deployment.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const web = path.join(root, 'apps/web');
const outDir = path.join(root, 'tmp/terrain-perf/manual-preview-dist');
const self = fileURLToPath(import.meta.url);
const firebase = path.join(process.env.APPDATA ?? '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const localImport = relative => import(pathToFileURL(path.join(root, relative)).href);
const vite = await localImport('node_modules/vite/dist/node/index.js');
const isolation = await localImport('apps/web/e2eIsolation.ts');

function mapboxToken() {
  const base = vite.loadEnv('', web, 'VITE_').VITE_MAPBOX_ACCESS_TOKEN;
  const mode = vite.loadEnv('emulator', web, 'VITE_').VITE_MAPBOX_ACCESS_TOKEN;
  const token = [process.env.VITE_MAPBOX_ACCESS_TOKEN, mode, base]
    .find(value => value?.startsWith('pk.') && !value.includes('fake-token'));
  if (!token) throw new Error('실제 Mapbox 공개 토큰을 찾지 못했습니다. apps/web/.env 설정을 확인하세요.');
  return token;
}

async function buildPreview() {
  Object.assign(process.env, isolation.isolatedWebEnvironment(process.env), {
    VITE_MAPBOX_ACCESS_TOKEN: mapboxToken(), RTW_DEV_PORT: '5212',
  });
  process.chdir(web);
  await vite.build({ root: web, mode: 'emulator', build: { outDir, emptyOutDir: false } });
  const htmlPath = path.join(outDir, 'index.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  await fs.writeFile(htmlPath, html.replace('</body>', '<script src="/reuse-preview.js"></script></body>'));
  await refreshUi();
}

async function refreshUi() {
  const html = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  if (!html.includes('/reuse-preview.js')) throw new Error('먼저 프리뷰 실행기로 빌드를 준비하세요.');
  const scripts = await Promise.all(['terrain-overlay-probe.js', 'manual-reuse-preview.js']
    .map(name => fs.readFile(path.join(here, name), 'utf8')));
  await fs.writeFile(path.join(outDir, 'reuse-preview.js'), scripts.join('\n;\n'));
}

if (process.argv.includes('--refresh-ui')) {
  await refreshUi();
  console.log('PASS: 전환판 v2 갱신 완료. 기존 5212 서버를 유지하고 브라우저를 새로고침하세요.');
} else if (process.argv.includes('--check')) {
  await fs.access(firebase);
  mapboxToken();
  for (const name of ['run-manual-reuse-preview.mjs', 'manual-reuse-preview.js', 'terrain-overlay-probe.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(here, name)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
  }
  console.log('PASS: launcher/controller/overlay syntax, Firebase CLI, Mapbox public token');
} else if (process.argv.includes('--serve') || process.argv.includes('--build-only') || process.argv.includes('--http-check')) {
  if (!process.argv.includes('--http-check')) {
    await isolation.default();
    await buildPreview();
  }
  {
    const server = await vite.preview({ root: web, mode: 'emulator', build: { outDir },
      preview: { host: '127.0.0.1', port: 5212, strictPort: true,
        headers: { 'Content-Security-Policy': isolation.E2E_CONNECT_POLICY, 'Cache-Control': 'no-store' } } });
    if (process.argv.includes('--build-only') || process.argv.includes('--http-check')) {
      try {
        const html = await fetch('http://127.0.0.1:5212/').then(response => response.text());
        const script = await fetch('http://127.0.0.1:5212/reuse-preview.js').then(response => response.text());
        if (!html.includes('/reuse-preview.js') || !script.includes('installTerrainOverlayProbe') || !script.includes('data-mode="custom"')) {
          throw new Error('프리뷰 HTML/후보 스크립트 연결 확인 실패');
        }
        console.log('PASS: production build + HTTP preview/controller linkage (no browser/ride automation)');
      } finally {
        server.httpServer.closeAllConnections();
        await new Promise(resolve => server.httpServer.close(resolve));
      }
    } else {
      server.printUrls();
      console.log('준비 완료: http://127.0.0.1:5212/?maxdpr=1.5&perflab=1');
      console.log('직접 주행을 시작한 뒤 왼쪽 아래 「40FPS 실험」에서 기준/후보를 선택하세요. 종료: Ctrl+C');
    }
  }
} else {
  await fs.access(firebase);
  mapboxToken();
  const command = `"${process.execPath}" "${self}" ${process.argv.includes('--prepare') ? '--build-only' : '--serve'}`;
  const child = spawn(process.execPath, [firebase, 'emulators:exec', '--only', 'auth,firestore,database,functions',
    '--project', 'boxcycle-dc2df', '--config', path.join(root, 'firebase.json'), command], {
    cwd: web, stdio: 'inherit', env: { ...process.env, RTW_E2E_WITH_FUNCTIONS: '1', FUNCTIONS_DISCOVERY_TIMEOUT: '45' },
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

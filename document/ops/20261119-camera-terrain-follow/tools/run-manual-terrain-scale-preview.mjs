// Manual-only production preview. No ride automation or deployment.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const web = path.join(root, 'apps/web');
const outDir = path.join(root, 'tmp/terrain-perf/terrain-scale-preview-dist');
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
    VITE_MAPBOX_ACCESS_TOKEN: mapboxToken(), RTW_DEV_PORT: '5216', VITE_TERRAIN_SCALE_PREVIEW: '1',
  });
  process.chdir(web);
  await vite.build({ root: web, mode: 'emulator', build: { outDir, emptyOutDir: false } });
  const htmlPath = path.join(outDir, 'index.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  await fs.writeFile(htmlPath, html.replace('</body>', '<script src="/terrain-scale-preview.js"></script></body>'));
  await refreshUi();
}

async function refreshUi() {
  const html = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  if (!html.includes('/terrain-scale-preview.js')) throw new Error('먼저 프리뷰 실행기로 빌드를 준비하세요.');
  const scripts = await Promise.all(['manual-terrain-scale-preview.js']
    .map(name => fs.readFile(path.join(here, name), 'utf8')));
  await fs.writeFile(path.join(outDir, 'terrain-scale-preview.js'), scripts.join('\n;\n'));
}

if (process.argv.includes('--refresh-ui')) {
  await refreshUi();
  console.log('PASS: 지형 배율 전환판 갱신 완료. 기존 5216 서버를 유지하고 브라우저를 새로고침하세요.');
} else if (process.argv.includes('--check')) {
  await fs.access(firebase);
  mapboxToken();
  for (const name of ['run-manual-terrain-scale-preview.mjs', 'manual-terrain-scale-preview.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(here, name)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
  }
  console.log('PASS: launcher/controller syntax, Firebase CLI, Mapbox public token');
} else if (process.argv.includes('--serve') || process.argv.includes('--build-only') || process.argv.includes('--rebuild-only') || process.argv.includes('--http-check')) {
  if (!process.argv.includes('--http-check')) {
    await isolation.default();
    await buildPreview();
  }
  if (process.argv.includes('--rebuild-only')) {
    console.log('PASS: 기존 서버용 프리뷰 재빌드 완료. 브라우저에서 Ctrl+F5 하세요.');
    process.exit(0);
  }
  {
    const server = await vite.preview({ root: web, mode: 'emulator', build: { outDir },
      preview: { host: '127.0.0.1', port: 5216, strictPort: true,
        headers: { 'Content-Security-Policy': isolation.E2E_CONNECT_POLICY, 'Cache-Control': 'no-store' } } });
    if (process.argv.includes('--build-only') || process.argv.includes('--http-check')) {
      try {
        const html = await fetch('http://127.0.0.1:5216/').then(response => response.text());
        const script = await fetch('http://127.0.0.1:5216/terrain-scale-preview.js').then(response => response.text());
        if (!html.includes('/terrain-scale-preview.js') || !script.includes('data-scale="1"') || script.includes('installTerrainOverlayProbe')) {
          throw new Error('프리뷰 HTML/배율 스크립트 연결 확인 실패');
        }
        console.log('PASS: production build + HTTP preview/controller linkage (no browser/ride automation)');
      } finally {
        server.httpServer.closeAllConnections();
        await new Promise(resolve => server.httpServer.close(resolve));
      }
    } else {
      server.printUrls();
      console.log('준비 완료: http://127.0.0.1:5216/?maxdpr=1.5&perflab=1&terrainscale=1');
      console.log('왼쪽 위 「지형 높이 비교」에서 배율 선택 후 직접 주행하세요. 배율 변경은 페이지를 새로 엽니다. 종료: Ctrl+C');
    }
  }
} else {
  // A repeated launch should reuse our existing server, not rebuild then fail.
  const existing = await fetch('http://127.0.0.1:5216/terrain-scale-preview.js', {
    signal: AbortSignal.timeout(2000),
  }).then(async response => response.ok ? response.text() : '').catch(() => '');
  if (existing.includes('__manualTerrainScalePreview') && !process.argv.includes('--prepare')) {
    console.log('기존 지형 배율 프리뷰를 재사용합니다. 서버 재시작은 필요 없습니다.');
    console.log('http://127.0.0.1:5216/?maxdpr=1.5&perflab=1&terrainscale=1');
    console.log('브라우저에서 Ctrl+F5 하세요. 코드 수정 후 재빌드는 --rebuild-only를 사용하세요.');
    process.exit(0);
  }
  await fs.access(firebase);
  mapboxToken();
  // Reuse already-running isolated emulators without interrupting other previews.
  try {
    Object.assign(process.env, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
      FIREBASE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001', RTW_E2E_WITH_FUNCTIONS: '1' });
    await isolation.default();
    const child = spawn(process.execPath, [self, process.argv.includes('--prepare') ? '--build-only' : '--serve'],
      { cwd: web, stdio: 'inherit', env: process.env });
    child.on('exit', code => { process.exitCode = code ?? 1; });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  } catch {
    const command = `"${process.execPath}" "${self}" ${process.argv.includes('--prepare') ? '--build-only' : '--serve'}`;
    const child = spawn(process.execPath, [firebase, 'emulators:exec', '--only', 'auth,firestore,database,functions',
      '--project', 'boxcycle-dc2df', '--config', path.join(root, 'firebase.json'), command], {
      cwd: web, stdio: 'inherit', env: { ...process.env, RTW_E2E_WITH_FUNCTIONS: '1', FUNCTIONS_DISCOVERY_TIMEOUT: '45' },
    });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  }
}

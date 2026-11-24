// 실제 앱(운영과 분리된 에뮬레이터 빌드)을 5231에 띄워 시야 거리별 FPS 를 잰다.
// Firestore 8080·RTDB 9000 에뮬레이터는 이미 떠 있어야 하고, 인증 9099 만 이 도구가 띄운다.
// 사용: node run-app-fps.mjs cases-smoke.json [--skip-build]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const web = path.join(root, 'apps/web');
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const outDir = path.join(root, 'tmp/view-distance/app-dist');
const cases = path.resolve(here, process.argv[2] ?? 'cases-distance.json');
const resultDir = path.join(root, 'tmp/view-distance', 'app-' + path.basename(cases, '.json'));
const skipBuild = process.argv.includes('--skip-build');

if (!process.argv.includes('--inner')) {
  const firebase = path.join(process.env.APPDATA ?? '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
  const cfg = path.join(root, 'tmp/view-distance/auth-only.firebase.json');
  fs.mkdirSync(path.dirname(cfg), { recursive: true });
  fs.writeFileSync(cfg, JSON.stringify({ emulators: { auth: { host: '127.0.0.1', port: 9099 }, hub: { port: 4411 }, logging: { port: 4511 }, ui: { enabled: false } } }));
  const inner = `"${process.execPath}" "${fileURLToPath(import.meta.url)}" "${cases}" --inner${skipBuild ? ' --skip-build' : ''}`;
  const r = spawnSync(process.execPath, [firebase, 'emulators:exec', '--only', 'auth', '--project', 'boxcycle-dc2df', '--config', cfg, inner], { cwd: web, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

Object.assign(process.env, {
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
});
const vite = await imp('node_modules/vite/dist/node/index.js');
const isolation = await imp('apps/web/e2eIsolation.ts');
const token = ['emulator', ''].map((m) => vite.loadEnv(m, web, 'VITE_').VITE_MAPBOX_ACCESS_TOKEN)
  .find((v) => v?.startsWith('pk.') && !v.includes('fake-token'));
Object.assign(process.env, isolation.isolatedWebEnvironment(process.env), { VITE_MAPBOX_ACCESS_TOKEN: token, RTW_DEV_PORT: '5231' });
process.chdir(web);
if (!skipBuild) await vite.build({ root: web, mode: 'emulator', logLevel: 'warn', build: { outDir, emptyOutDir: true } });
const server = await vite.preview({
  root: web, mode: 'emulator', build: { outDir },
  preview: { host: '127.0.0.1', port: 5231, strictPort: true, headers: { 'Content-Security-Policy': isolation.E2E_CONNECT_POLICY, 'Cache-Control': 'no-store' } },
});
fs.rmSync(path.join(resultDir, 'rows.jsonl'), { force: true });
const child = spawn(process.execPath, [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', path.join(here, 'app-fps.config.ts')],
  { cwd: root, stdio: 'inherit', env: { ...process.env, APP_FPS_CASES: cases, APP_FPS_OUT: resultDir } });
child.on('exit', async (code) => {
  server.httpServer.closeAllConnections();
  await new Promise((r) => server.httpServer.close(r));
  process.exit(code ?? 1);
});

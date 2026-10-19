/** Demo-emulator-only runner: real Rules/HTTP integration, then actual app ride entry. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) {
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/, `${key}: emulator required`);
}
const project = 'demo-boxcycle-guest';
async function run(args, cwd = root, extraEnv = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...extraEnv }, stdio: 'inherit', windowsHide: true });
    child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
  });
}
const rideOnly = process.argv.includes('--ride-only');
const lifecycleOnly = process.argv.includes('--lifecycle-only');
const serveOnly = process.argv.includes('--serve');
if (rideOnly || lifecycleOnly || serveOnly) console.log('browser-only: Rules suite is intentionally excluded; report separately.');
const rulesExit = rideOnly || lifecycleOnly || serveOnly ? 0 : await run(['--test', 'scripts/guest-rules-supervisor.test.mjs']);
if (rulesExit) process.exit(rulesExit);
const require = createRequire(path.join(root, 'functions/package.json'));
const { getApp, deleteApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const webRequire = createRequire(path.join(web, 'package.json'));
const { loadEnv } = webRequire('vite');
const env = loadEnv('', web, 'VITE_');
const token = env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
// The production HTTP handlers initialize the default Admin app themselves.
// Pin that app to the demo project before loading them; never use ambient credentials.
process.env.GCLOUD_PROJECT = project;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: project, databaseURL: `https://${project}-default-rtdb.firebaseio.com` });
if (serveOnly && token?.startsWith('pk.')) process.env.MAPBOX_ACCESS_TOKEN = token;
const { getDistanceAutoRoute, getMapboxDirections } = require('../functions/lib/index.js');
const app = getApp();
const express = require('express');
const { guestActivityHttp, guestLinkHttp } = require('../functions/lib/guestLifecycleHttp.js');
const { ensureRouteTokenOnboardingHttp } = require('../functions/lib/routeTokenEnsureOnboarding.js');
const { assertTierQuotaHttp } = require('../functions/lib/tierQuotaHttp.js');
const api = express(); api.use(express.json());
api.all(`/${project}/asia-northeast3/guestActivityHttp`, guestActivityHttp);
api.all(`/${project}/asia-northeast3/guestLinkHttp`, guestLinkHttp);
api.all(`/${project}/asia-northeast3/ensureRouteTokenOnboardingHttp`, ensureRouteTokenOnboardingHttp);
api.all(`/${project}/asia-northeast3/getDistanceAutoRoute`, getDistanceAutoRoute);
api.all(`/${project}/asia-northeast3/getMapboxDirections`, getMapboxDirections);
api.all(`/${project}/asia-northeast3/assertTierQuotaHttp`, assertTierQuotaHttp);
const server = createServer(api);
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${server.address().port}`;
  const cli = webRequire.resolve('@playwright/test/cli');
  const browserEnv = {
    RTW_DEV_PORT: '5004', RTW_E2E_PLAYWRIGHT_GLOBAL_MS: '180000',
    VITE_USE_EMULATOR: '1', VITE_FIREBASE_PROJECT_ID: project,
    VITE_FIREBASE_API_KEY: 'demo-emulator-key', VITE_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
    VITE_FIREBASE_APP_ID: 'demo-emulator-app', VITE_FIREBASE_DATABASE_URL: `https://${project}-default-rtdb.firebaseio.com`,
    VITE_FUNCTIONS_EMULATOR_HOST: host,
  };
  let code = 0;
  if (serveOnly) {
    const viteCli = path.join(path.dirname(webRequire.resolve('vite/package.json')), 'bin/vite.js');
    console.log('Guest demo sandbox: http://localhost:5004 (Ctrl+C to stop; local demo data only)');
    code = await run([viteCli, '--mode', 'emulator', '--host', '127.0.0.1', '--port', '5004', '--strictPort'], web, {
      ...browserEnv,
      ...(token?.startsWith('pk.') ? { VITE_MAPBOX_ACCESS_TOKEN: token } : {}),
    });
  } else {
    if (!lifecycleOnly) code = await run([cli, 'test', 'ride-entry.spec.ts', '--project=chromium', '--workers=1', '--timeout=90000', '--grep', '게스트 → 주행 입력 준비'], web, browserEnv);
    if (!code && !rideOnly) code = await run([cli, 'test', 'guest-lifecycle.spec.ts', '--project=chromium', '--workers=1', '--timeout=90000'], web, browserEnv);
  }
  process.exitCode = code;
} finally {
  await new Promise(resolve => server.close(resolve)); getDatabase(app).goOffline(); await deleteApp(app);
}

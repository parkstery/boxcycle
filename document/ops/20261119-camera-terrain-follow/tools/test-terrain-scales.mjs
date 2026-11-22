import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const tests = ['ride-camera-terrain.test.ts', 'ride-terrain-guard.test.ts',
  'ride-terrain-lifecycle.test.mjs', 'ride-terrain-scale.test.ts']
  .map(name => path.join(root, 'apps/web/scripts/map', name));
for (const [preview, scale, expected] of [['1', '1', '1'], ['1', '1.3', '1.3'], ['0', '1.3', '1']]) {
  console.log(`\nPreview=${preview}, query scale=${scale}, expected=${expected}`);
  const bootstrap = `globalThis.window={location:{search:'?terrainscale=${scale}'}}`;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--import',
    pathToFileURL(path.join(root, 'apps/web/scripts/s42/register-vite-env.mjs')).href,
    '--import', `data:text/javascript,${encodeURIComponent(bootstrap)}`, '--test', ...tests], {
    cwd: root, stdio: 'inherit', env: { ...process.env,
      RTW_VITE_ENV_OVERRIDES: JSON.stringify({ VITE_TERRAIN_SCALE_PREVIEW: preview }),
      RTW_EXPECT_TERRAIN_SCALE: expected },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

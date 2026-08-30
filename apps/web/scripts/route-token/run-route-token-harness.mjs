import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readMapboxPkForUiSmoke } from "./read-mapbox-pk.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const functionsDir = path.join(repoRoot, "functions");
const pkgPath = path.join(functionsDir, "package.json");
const secretLocalPath = path.join(functionsDir, ".secret.local");
const outDir = path.join(__dirname, ".out");
const logPath = path.join(outDir, "emulator.log");
const contractRel = "apps/web/scripts/route-token/route-token-contract.mjs";

const FORBIDDEN_LOG = [
  "secretmanager.googleapis.com",
  "Trying to access secret",
  "MAPBOX_ACCESS_TOKEN@latest",
];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: opts.inherit ? "inherit" : "pipe",
    encoding: opts.inherit ? undefined : "utf8",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.error) throw result.error;
  return result;
}

function assertNodeMajor20() {
  const major = Number(process.version.slice(1).split(".")[0]);
  if (major !== 20) {
    console.warn(
      `[route-token] WARN: host Node ${process.version} — Functions 선언은 Node 20. build 는 현재 Node 로 수행합니다.`,
    );
  }
}

function runUnitTests() {
  const tests = [
    "scripts/route-token/harness-active.test.mjs",
    "scripts/route-token/isolation-guards.test.mjs",
    "scripts/route-token/production-surface.test.mjs",
  ];
  for (const file of tests) {
    const result = run("node", ["--test", file], {
      cwd: path.join(repoRoot, "apps/web"),
      inherit: true,
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

function patchHarnessEntry() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const originalMain = pkg.main;
  pkg.main = "lib/index.harness.js";
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return originalMain;
}

function restorePackageMain(originalMain) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.main = originalMain;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function ensureSecretPlaceholder() {
  if (fs.existsSync(secretLocalPath)) {
    throw new Error(
      "functions/.secret.local 이 이미 있습니다. harness runner 가 덮어쓰지 않습니다.",
    );
  }
  fs.writeFileSync(
    secretLocalPath,
    "MAPBOX_ACCESS_TOKEN=harness-emulator-placeholder-not-real\n",
    "utf8",
  );
  return true;
}

function assertCleanLog(output) {
  for (const needle of FORBIDDEN_LOG) {
    if (output.includes(needle)) {
      throw new Error(`금지 로그 패턴 발견: ${needle}`);
    }
  }
}

function runEmulatorContract() {
  fs.mkdirSync(outDir, { recursive: true });
  const childEnv = {
    ...process.env,
    RTW_ROUTE_TOKEN_HARNESS: "1",
    VITE_DIRECTIONS_DIRECT: "0",
  };
  const command = `firebase emulators:exec --only "auth,firestore,functions" --project demo-rtw-route-token "node ${contractRel}"`;
  const result = spawnSync(command, {
    cwd: repoRoot,
    env: childEnv,
    shell: true,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  fs.writeFileSync(logPath, combined, "utf8");
  if (result.status !== 0) {
    console.error(combined.slice(-4000));
    process.exit(result.status ?? 1);
  }
  assertCleanLog(combined);
  console.log("[route-token] emulator log gate PASS (no Secret Manager / Mapbox secret fetch)");
}

function runUiSmoke() {
  const webDir = path.join(repoRoot, "apps/web");
  const mapboxPk = readMapboxPkForUiSmoke();
  const childEnv = {
    ...process.env,
    RTW_ROUTE_TOKEN_HARNESS: "1",
    ROUTE_TOKEN_UI_LIVE: "1",
    VITE_DIRECTIONS_DIRECT: "0",
    VITE_MAPBOX_ACCESS_TOKEN: mapboxPk,
    RTW_DEV_PORT: "5010",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  };
  const command =
    'firebase emulators:exec --only "auth,firestore,functions" --project demo-rtw-route-token --config ../../firebase.json "npx playwright test route-token-ui-smoke --workers=1"';
  const result = spawnSync(command, {
    cwd: webDir,
    env: childEnv,
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  assertNodeMajor20();
  process.chdir(path.join(repoRoot, "apps/web"));

  console.log("[route-token] functions build…");
  const buildResult = run("npm", ["run", "build"], { cwd: functionsDir, inherit: true });
  if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);

  console.log("[route-token] unit tests…");
  runUnitTests();

  let createdSecret = false;
  let originalMain = "lib/index.js";
  try {
    createdSecret = ensureSecretPlaceholder();
    originalMain = patchHarnessEntry();
    console.log("[route-token] emulator contract…");
    runEmulatorContract();
    console.log("[route-token] UI smoke…");
    runUiSmoke();
  } finally {
    restorePackageMain(originalMain);
    if (createdSecret && fs.existsSync(secretLocalPath)) {
      fs.unlinkSync(secretLocalPath);
    }
  }

  console.log("[route-token] ROUTE-TOKEN-1R harness PASS");
}

main();

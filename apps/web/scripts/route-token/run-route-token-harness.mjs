import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertNodeMajor20, node20Env, resolveNode20Executable } from "./node20.mjs";
import {
  assertNoTrackedSecret,
  assertTrackedPackageUnchanged,
  prepareFunctionsMirror,
  removeFunctionsMirror,
  writeMirrorSecret,
} from "./functions-mirror.mjs";
import { assertPortsFree } from "./port-guard.mjs";
import { runFirebaseEmulatorsExec } from "./firebase-exec.mjs";
import { readMapboxPkForUiSmoke } from "./read-mapbox-pk.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const functionsDir = path.join(repoRoot, "functions");
const pkgPath = path.join(functionsDir, "package.json");
const trackedSecretPath = path.join(functionsDir, ".secret.local");
const cacheRoot = path.join(__dirname, ".runner-cache");
const outDir = path.join(__dirname, ".out");
const logPath = path.join(outDir, "emulator.log");
const lastRunPath = path.join(outDir, ".last-run.json");
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
    env: node20Env(opts.env),
    ...opts,
  });
  if (result.error) throw result.error;
  return result;
}

function assertNodeMajor20Gate() {
  const { nodeExe, version } = assertNodeMajor20();
  console.log(`[route-token] Node 20 runtime: ${version} (${nodeExe})`);
}

function runUnitTests(extraTests = []) {
  const tests = [
    "scripts/route-token/harness-active.test.mjs",
    "scripts/route-token/isolation-guards.test.mjs",
    "scripts/route-token/directions-direct-guard.test.mjs",
    "scripts/route-token/production-surface.test.mjs",
    ...extraTests,
  ];
  for (const file of tests) {
    const result = spawnSync(resolveNode20Executable(), ["--test", file], {
      cwd: path.join(repoRoot, "apps/web"),
      stdio: "inherit",
      env: node20Env(),
    });
    if (result.status !== 0) {
      throw new Error(`unit test failed: ${file}`);
    }
  }
}

function assertCleanLog(output) {
  for (const needle of FORBIDDEN_LOG) {
    if (output.includes(needle)) {
      throw new Error(`금지 로그 패턴 발견: ${needle}`);
    }
  }
}

function prepareHarnessEnv(runId) {
  fs.mkdirSync(cacheRoot, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const mirrorDir = prepareFunctionsMirror(functionsDir, cacheRoot);
  writeMirrorSecret(mirrorDir);
  return { mirrorDir, runId };
}

function cleanupHarnessState(expectedPkgBytes) {
  removeFunctionsMirror(cacheRoot);
  assertTrackedPackageUnchanged(pkgPath, expectedPkgBytes);
  assertNoTrackedSecret(trackedSecretPath);
  assertPortsFree();
}

function runEmulatorContract() {
  const childEnv = node20Env({
    RTW_ROUTE_TOKEN_HARNESS: "1",
    VITE_DIRECTIONS_DIRECT: "0",
  });
  const { result } = runFirebaseEmulatorsExec({
    cwd: repoRoot,
    configPath: "firebase.harness.json",
    innerCommand: `node ${contractRel}`,
    env: childEnv,
    stdio: "pipe",
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  fs.writeFileSync(logPath, combined, "utf8");
  if (result.status !== 0) {
    console.error(combined.slice(-4000));
    throw new Error(`emulator contract failed (exit ${result.status ?? 1})`);
  }
  if (combined.includes("Using node@24 from host")) {
    throw new Error("Functions Emulator 가 Node 24 를 사용했습니다 — Node 20 이어야 합니다.");
  }
  assertCleanLog(combined);
  console.log("[route-token] emulator log gate PASS (no Secret Manager / Mapbox secret fetch)");
}

function runUiSmoke(runId, { forceFail = false } = {}) {
  const webDir = path.join(repoRoot, "apps/web");
  const mapboxPk = readMapboxPkForUiSmoke();
  const childEnv = node20Env({
    RTW_ROUTE_TOKEN_HARNESS: "1",
    ROUTE_TOKEN_UI_LIVE: "1",
    ROUTE_TOKEN_RUN_ID: runId,
    VITE_DIRECTIONS_DIRECT: "0",
    VITE_MAPBOX_ACCESS_TOKEN: mapboxPk,
    RTW_DEV_PORT: "5010",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    ...(forceFail ? { ROUTE_TOKEN_UI_FORCE_FAIL: "1" } : {}),
  });

  const testName = forceFail ? "route-token-ui-force-fail" : "route-token-ui-smoke";
  const nodeExe = resolveNode20Executable();
  const { result } = runFirebaseEmulatorsExec({
    cwd: webDir,
    configPath: "../../firebase.harness.json",
    innerCommand: `${nodeExe} ../../node_modules/@playwright/test/cli.js test ${testName} --workers=1`,
    env: childEnv,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`UI smoke failed (exit ${result.status ?? 1})`);
  }
}

function writeLastRun(runId, passed, nodeVersion) {
  fs.writeFileSync(
    lastRunPath,
    `${JSON.stringify(
      {
        runId,
        passed,
        nodeVersion,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function runHarness({ cleanupTestOnly = false } = {}) {
  const expectedPkgBytes = fs.readFileSync(pkgPath);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  let harnessPrepared = false;

  try {
    assertNodeMajor20Gate();
    process.chdir(path.join(repoRoot, "apps/web"));

    console.log("[route-token] functions build…");
    const buildResult = run("npm", ["run", "build"], { cwd: functionsDir, inherit: true });
    if (buildResult.status !== 0) {
      throw new Error("functions build failed");
    }

    if (!cleanupTestOnly) {
      console.log("[route-token] unit tests…");
      runUnitTests(["scripts/route-token/runner-fail-recovery.test.mjs"]);
    }

    prepareHarnessEnv(runId);
    harnessPrepared = true;

    if (cleanupTestOnly) {
      console.log("[route-token] cleanup regression — intentional UI fail…");
      try {
        runUiSmoke(runId, { forceFail: true });
        throw new Error("intentional UI fail 이 발생하지 않았습니다");
      } catch (err) {
        if (String(err?.message ?? err).includes("intentional UI fail 이 발생하지 않았습니다")) {
          throw err;
        }
        console.log("[route-token] cleanup regression — expected UI failure");
        return 1;
      }
    }

    console.log("[route-token] emulator contract…");
    runEmulatorContract();
    console.log("[route-token] UI smoke…");
    runUiSmoke(runId);
    writeLastRun(runId, true, assertNodeMajor20().version);
    console.log("[route-token] ROUTE-TOKEN-1R2 harness PASS");
    return 0;
  } finally {
    if (harnessPrepared) {
      try {
        cleanupHarnessState(expectedPkgBytes);
      } catch (cleanupErr) {
        console.error("[route-token] CLEANUP FAILED:", cleanupErr);
        if (!process.exitCode) process.exitCode = 2;
        throw cleanupErr;
      }
    }
  }
}

function main() {
  const cleanupTestOnly = process.env.ROUTE_TOKEN_HARNESS_CLEANUP_TEST === "1";
  try {
    const code = runHarness({ cleanupTestOnly });
    process.exitCode = code;
  } catch (err) {
    console.error(err);
    if (!process.exitCode) process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main();
}

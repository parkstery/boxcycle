/**
 * TASK-28C — run public-trail 1v2 traffic meters under Functions emulator,
 * capture emulator stdout/stderr, parse CF invocations by name (whole-run only),
 * merge into JSON top-level (no solo/dual twin attribution).
 *
 * Usage (from apps/web):
 *   node scripts/e2e/run-public-trail-traffic-meter.mjs
 *   # or: npm run test:e2e:public-trail-traffic
 *
 * Env:
 *   RTW_DEV_PORT — Vite port (default playwright config)
 *   RTW_TRAFFIC_MEASURE_MS — measure window ms (default 45000)
 *   RTW_TRAFFIC_SETTLE_MS — post-setup settle before meter reset (default 3000)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(webRoot, "../..");
const opsDir = path.resolve(repoRoot, "document/ops/20260929-public-trail-traffic");
const outDir = path.resolve(webRoot, ".out/firebase-traffic");
/** Unique ops tag — never overwrite 28D-B baseline or prior TASK evidence. */
const artifactTag = (process.env.RTW_TRAFFIC_ARTIFACT_TAG ?? "").trim();
const emuLogPath = path.join(outDir, "task28-emulator.log");
const resultJsonPath = path.join(outDir, "public-trail-traffic-1-2.json");
const phaseJsonlPath = path.join(outDir, "public-trail-traffic-1-2-phases.jsonl");
const opsResultCopy = artifactTag
  ? path.join(opsDir, `${artifactTag}.json`)
  : path.join(opsDir, "public-trail-traffic-1-2.json");
const opsPhaseCopy = artifactTag
  ? path.join(opsDir, `${artifactTag}-phases.jsonl`)
  : path.join(opsDir, "public-trail-traffic-1-2-phases.jsonl");
const opsEmuLogCopy = artifactTag
  ? path.join(opsDir, `.${artifactTag}-emulator.log`)
  : path.join(opsDir, ".task28-emulator.log");

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(opsDir, { recursive: true });

// Avoid merging CF counts into a prior run's result JSON when Playwright fails
// before writing a fresh payload (TASK-31B: stale 28D-B file was rewritten).
if (fs.existsSync(resultJsonPath)) {
  fs.unlinkSync(resultJsonPath);
}

process.env.RTW_E2E_WITH_FUNCTIONS = "1";

const configPath = path.join(repoRoot, "firebase.json");
const deadlineMs = 12 * 60_000;
const measureMs = process.env.RTW_TRAFFIC_MEASURE_MS ?? "45000";
const settleMs = process.env.RTW_TRAFFIC_SETTLE_MS ?? "3000";

const inner =
  `playwright test public-trail-traffic-1-2 --workers=1 --retries=0`;
const quotedInner = `"${inner.replace(/"/g, '\\"')}"`;
const command =
  `firebase emulators:exec --only auth,firestore,database,functions ` +
  `--project boxcycle-dc2df --config "${configPath}" ${quotedInner}`;

/**
 * Parse Firebase Functions emulator lines for Beginning execution markers.
 * Returns counts by bare function name (region prefix stripped).
 */
export function parseFunctionsInvocations(logText) {
  const byName = Object.create(null);
  const beginRe =
    /Beginning execution of ["']?(?:[a-z0-9-]+-)?([A-Za-z0-9_]+)["']?/gi;
  let m;
  while ((m = beginRe.exec(logText)) != null) {
    const name = m[1];
    byName[name] = (byName[name] ?? 0) + 1;
  }
  const finishedRe =
    /Finished ["']?(?:[a-z0-9-]+-)?([A-Za-z0-9_]+)["']?/gi;
  const finishedByName = Object.create(null);
  while ((m = finishedRe.exec(logText)) != null) {
    const name = m[1];
    finishedByName[name] = (finishedByName[name] ?? 0) + 1;
  }
  return {
    status: Object.keys(byName).length > 0 ? "ok" : "empty",
    beginCountsByName: byName,
    finishedCountsByName: finishedByName,
    totalBegin: Object.values(byName).reduce((a, b) => a + b, 0),
    method:
      "Regex on firebase emulators:exec stdout/stderr for Beginning execution of \"…\". Emulator invocations ≠ production billed executions.",
  };
}

/**
 * Merge CF counts at top-level only.
 * Do NOT copy identical whole-run totals into solo/dual — that misattributes
 * setup+solo+dual+teardown to each phase.
 */
function mergeFunctionsIntoResult(result, logText) {
  const whole = parseFunctionsInvocations(logText);

  // Strip any prior solo/dual CF blocks left by older harness versions.
  if (result.solo && result.solo.functionsInvocationsByName != null) {
    delete result.solo.functionsInvocationsByName;
  }
  if (result.dual && result.dual.functionsInvocationsByName != null) {
    delete result.dual.functionsInvocationsByName;
  }

  result.functionsInvocationsWholeRun = {
    ...whole,
    attribution: "whole_emulators_exec_run",
    note:
      "Whole firebase emulators:exec stdout/stderr (setup + solo + dual + teardown). Not measure-window-sliced and not solo/dual-attributed. Prefer client meter deltas for 1v2 ratios. Emulator invocations ≠ production billed executions.",
  };
  result.functionsLogPath = emuLogPath;
  result.functionsAttributionPolicy =
    "top_level_whole_run_only — no solo/dual twin copies of CF begin counts";
  return result;
}

function copyArtifacts() {
  if (fs.existsSync(resultJsonPath)) {
    fs.copyFileSync(resultJsonPath, opsResultCopy);
  }
  if (fs.existsSync(phaseJsonlPath)) {
    fs.copyFileSync(phaseJsonlPath, opsPhaseCopy);
  }
  if (fs.existsSync(emuLogPath)) {
    fs.copyFileSync(emuLogPath, opsEmuLogCopy);
  }
}

console.log(
  `[task28c] measureMs=${measureMs} settleMs=${settleMs} artifactTag=${artifactTag || "(default)"} log=${emuLogPath}`,
);
console.log(`[task28c] ops copies → ${opsResultCopy}`);
console.log(`[task28c] ${command}`);

const logStream = fs.createWriteStream(emuLogPath, { flags: "w" });
const child = spawn(command, {
  cwd: webRoot,
  shell: true,
  env: {
    ...process.env,
    RTW_E2E_WITH_FUNCTIONS: "1",
    RTW_TRAFFIC_MEASURE_MS: String(measureMs),
    RTW_TRAFFIC_SETTLE_MS: String(settleMs),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let settled = false;
const killTimer = setTimeout(() => {
  if (settled) return;
  console.error(`[task28c] deadline ${deadlineMs}ms — killing emulator child`);
  child.kill("SIGTERM");
}, deadlineMs);

function onChunk(buf, stream) {
  const s = buf.toString("utf8");
  process[stream].write(s);
  logStream.write(s);
}

child.stdout.on("data", (b) => onChunk(b, "stdout"));
child.stderr.on("data", (b) => onChunk(b, "stderr"));

child.on("close", (code) => {
  settled = true;
  clearTimeout(killTimer);
  logStream.end(() => {
    let logText = "";
    try {
      logText = fs.readFileSync(emuLogPath, "utf8");
    } catch {
      logText = "";
    }

    if (fs.existsSync(resultJsonPath)) {
      try {
        const result = JSON.parse(fs.readFileSync(resultJsonPath, "utf8"));
        const merged = mergeFunctionsIntoResult(result, logText);
        merged.runnerExitCode = code ?? 1;
        fs.writeFileSync(resultJsonPath, JSON.stringify(merged, null, 2), "utf8");
      } catch (e) {
        console.error("[task28c] failed to merge functions counts:", e);
      }
    } else {
      console.error("[task28c] missing result JSON — playwright likely failed before write");
      const stub = {
        task: "TASK-28C",
        pass: false,
        runnerExitCode: code ?? 1,
        functionsInvocationsWholeRun: {
          ...parseFunctionsInvocations(logText),
          attribution: "whole_emulators_exec_run",
          note: "Partial run — result JSON missing. Counts are whole-run only.",
        },
        functionsAttributionPolicy:
          "top_level_whole_run_only — no solo/dual twin copies of CF begin counts",
        error: "result JSON missing",
      };
      fs.writeFileSync(resultJsonPath, JSON.stringify(stub, null, 2), "utf8");
    }

    copyArtifacts();
    console.log(`[task28c] artifacts → ${opsDir}`);
    process.exit(code ?? 1);
  });
});

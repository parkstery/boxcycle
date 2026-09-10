/** Nested hang helper for deadline tree-kill self-test. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const grandchild = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
  stdio: "ignore",
});

// Expose PIDs for tree-kill verifier (test reads this to assert post-kill cleanup).
const pidFile =
  process.env.HANG_PID_FILE ||
  path.join(HERE, "../../test-results/hang-pids.json");
try {
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(
    pidFile,
    JSON.stringify({ parentPid: process.pid, grandchildPid: grandchild.pid }),
  );
} catch {
  /* ignore */
}

setInterval(() => {}, 1000);

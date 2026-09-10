/** Nested hang helper for deadline tree-kill self-test. */
import { spawn } from "node:child_process";

spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
  stdio: "ignore",
});
setInterval(() => {}, 1000);

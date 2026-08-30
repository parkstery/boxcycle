import { execSync } from "node:child_process";

const HARNESS_PORTS = [5001, 5010, 8080, 9099];

/** Windows netstat 기준 — 포트 LISTENING 잔류 검사 */
export function findListeningPorts(ports = HARNESS_PORTS) {
  let output = "";
  try {
    output = execSync("netstat -ano", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return [];
  }

  const busy = [];
  for (const port of ports) {
    const re = new RegExp(`[:\\.]${port}\\s+.*LISTENING`, "i");
    if (re.test(output)) busy.push(port);
  }
  return busy;
}

export function assertPortsFree(ports = HARNESS_PORTS) {
  const busy = findListeningPorts(ports);
  if (busy.length > 0) {
    throw new Error(`Harness 포트 잔류: ${busy.join(", ")}`);
  }
}

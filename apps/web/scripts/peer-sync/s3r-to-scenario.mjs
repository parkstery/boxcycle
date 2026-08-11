/**
 * S3R-chain-events.json → replay 시나리오 (수신 최초 pt4).
 *   node scripts/peer-sync/s3r-to-scenario.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const RAW = resolve(DIR, "S3R-chain-events.json");
const OUT = resolve(DIR, "s3r-z15-cruise-scenario.json");

const raw = JSON.parse(readFileSync(RAW, "utf8"));
const pub = raw.publisherUid;
const first = [];
const seen = new Set();
for (const e of raw.events) {
  if (e.side !== "B" || e.pt !== 4) continue;
  if (pub && e.uid && e.uid !== pub) continue;
  if (e.seq == null || seen.has(e.seq)) continue;
  if (Number(e.first) !== 1) continue;
  seen.add(e.seq);
  const atMs = Number(e.firstSeenAt ?? e.recvAt);
  const distM = Number(e.d);
  if (!Number.isFinite(atMs) || !Number.isFinite(distM)) continue;
  first.push({
    atMs,
    packet: {
      uid: "peer-A",
      publicationId: "s3r-cruise",
      distM,
      speedMps: 8.33,
      phase: "live",
      serverAtMs: Number(e.t) || atMs,
    },
  });
}
first.sort((a, b) => a.atMs - b.atMs);
const forward = [];
let lastDist = -Infinity;
for (const ev of first) {
  if (ev.packet.distM + 0.05 < lastDist) continue;
  if (ev.packet.distM > lastDist) lastDist = ev.packet.distM;
  forward.push(ev);
}

const scenario = {
  name: "s3r-z15-cruise-firstseen",
  routeLenM: 2000,
  stepIntervalMs: 100,
  expectFail: true,
  events: forward,
  meta: {
    source: "S3R-chain-events.json",
    firstSeen: first.length,
    forward: forward.length,
    publisherUid: pub,
  },
};
writeFileSync(OUT, JSON.stringify(scenario, null, 2), "utf8");
console.log(JSON.stringify({ out: OUT, firstSeen: first.length, forward: forward.length }, null, 2));

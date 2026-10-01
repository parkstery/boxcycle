import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";
import {
  approxUtf8JsonBytes,
  deltaTrafficPublishMeters,
  noteFsLiveRideUnderlyingDelivery,
  noteFsLiveRideUnderlyingDocChanges,
  noteLivePublicationRideWriteAttempt,
  noteLivePublicationRideWriteError,
  noteLivePublicationRideWriteOk,
  noteRtdbMotionUnderlyingDelivery,
  noteRtdbMotionWriteAttempt,
  noteRtdbMotionWriteError,
  noteRtdbMotionWriteOk,
  resetTrafficPublishMeters,
  snapshotTrafficPublishMeters,
} from "../../src/lib/debug/trafficPublishMeters.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string) => fs.readFileSync(path.join(webRoot, rel), "utf8");

describe("trafficPublishMeters", () => {
  beforeEach(() => {
    resetTrafficPublishMeters();
  });

  it("reset clears all counters", () => {
    const fsTicket = noteLivePublicationRideWriteAttempt();
    noteLivePublicationRideWriteOk(fsTicket);
    noteLivePublicationRideWriteError(fsTicket);
    const rtdbTicket = noteRtdbMotionWriteAttempt();
    noteRtdbMotionWriteOk(rtdbTicket, { p: "x", d: 1 });
    noteRtdbMotionWriteError(rtdbTicket);
    noteFsLiveRideUnderlyingDelivery();
    noteFsLiveRideUnderlyingDocChanges(3);
    noteRtdbMotionUnderlyingDelivery();
    resetTrafficPublishMeters();
    const snap = snapshotTrafficPublishMeters();
    assert.equal(snap.livePublicationRideWriteAttempts, 0);
    assert.equal(snap.livePublicationRideWrites, 0);
    assert.equal(snap.livePublicationRideWriteErrors, 0);
    assert.equal(snap.rtdbMotionWriteAttempts, 0);
    assert.equal(snap.rtdbMotionWrites, 0);
    assert.equal(snap.rtdbMotionWriteErrors, 0);
    assert.equal(snap.rtdbMotionWriteBytesApprox, 0);
    assert.equal(snap.fsLiveRideUnderlyingDeliveries, 0);
    assert.equal(snap.fsLiveRideUnderlyingDocChanges, 0);
    assert.equal(snap.rtdbMotionUnderlyingDeliveries, 0);
  });

  it("delta is end − start for a measure window", () => {
    const t0 = noteLivePublicationRideWriteAttempt();
    noteLivePublicationRideWriteOk(t0);
    const r0 = noteRtdbMotionWriteAttempt();
    noteRtdbMotionWriteOk(r0, { a: 1 });
    noteFsLiveRideUnderlyingDelivery();
    noteFsLiveRideUnderlyingDocChanges(2);
    const start = snapshotTrafficPublishMeters();

    const tA = noteLivePublicationRideWriteAttempt();
    const tB = noteLivePublicationRideWriteAttempt();
    noteLivePublicationRideWriteOk(tA);
    noteLivePublicationRideWriteError(tB);
    const r1 = noteRtdbMotionWriteAttempt();
    noteRtdbMotionWriteOk(r1, { a: 1, b: 2 });
    noteFsLiveRideUnderlyingDelivery();
    noteFsLiveRideUnderlyingDocChanges(1);
    noteRtdbMotionUnderlyingDelivery();
    const end = snapshotTrafficPublishMeters();

    const d = deltaTrafficPublishMeters(start, end);
    assert.equal(d.source, "trafficPublishMetersDelta");
    assert.equal(d.livePublicationRideWriteAttempts, 2);
    assert.equal(d.livePublicationRideWrites, 1);
    assert.equal(d.livePublicationRideWriteErrors, 1);
    assert.equal(d.rtdbMotionWriteAttempts, 1);
    assert.equal(d.rtdbMotionWrites, 1);
    assert.equal(d.fsLiveRideUnderlyingDeliveries, 1);
    assert.equal(d.fsLiveRideUnderlyingDocChanges, 1);
    assert.equal(d.rtdbMotionUnderlyingDeliveries, 1);
    assert.ok(d.rtdbMotionWriteBytesApprox > 0);
    assert.ok(d.windowMs >= 0);
  });

  it("post-reset completions from pre-reset attempts are ignored; in-window ok counts", () => {
    const staleFs = noteLivePublicationRideWriteAttempt();
    const staleRtdb = noteRtdbMotionWriteAttempt();
    assert.equal(snapshotTrafficPublishMeters().livePublicationRideWriteAttempts, 1);
    assert.equal(snapshotTrafficPublishMeters().rtdbMotionWriteAttempts, 1);

    resetTrafficPublishMeters();
    assert.equal(snapshotTrafficPublishMeters().livePublicationRideWriteAttempts, 0);
    assert.equal(snapshotTrafficPublishMeters().rtdbMotionWriteAttempts, 0);

    noteLivePublicationRideWriteOk(staleFs);
    noteLivePublicationRideWriteError(staleFs);
    noteRtdbMotionWriteOk(staleRtdb, { stale: true });
    noteRtdbMotionWriteError(staleRtdb);
    const afterStale = snapshotTrafficPublishMeters();
    assert.equal(afterStale.livePublicationRideWrites, 0);
    assert.equal(afterStale.livePublicationRideWriteErrors, 0);
    assert.equal(afterStale.rtdbMotionWrites, 0);
    assert.equal(afterStale.rtdbMotionWriteErrors, 0);
    assert.equal(afterStale.rtdbMotionWriteBytesApprox, 0);

    const freshFs = noteLivePublicationRideWriteAttempt();
    noteLivePublicationRideWriteOk(freshFs);
    const freshRtdb = noteRtdbMotionWriteAttempt();
    noteRtdbMotionWriteOk(freshRtdb, { fresh: true });
    const afterFresh = snapshotTrafficPublishMeters();
    assert.equal(afterFresh.livePublicationRideWriteAttempts, 1);
    assert.equal(afterFresh.livePublicationRideWrites, 1);
    assert.equal(afterFresh.rtdbMotionWriteAttempts, 1);
    assert.equal(afterFresh.rtdbMotionWrites, 1);
    assert.ok(afterFresh.rtdbMotionWriteBytesApprox > 0);
  });

  it("approxUtf8JsonBytes matches TextEncoder JSON length and accumulates on ok writes", () => {
    const payload = { p: "pub-1", d: 12.3, v: 4.5, ph: "live", t: 1_700_000_000_000 };
    const expected = new TextEncoder().encode(JSON.stringify(payload)).length;
    assert.equal(approxUtf8JsonBytes(payload), expected);

    const t1 = noteRtdbMotionWriteAttempt();
    noteRtdbMotionWriteOk(t1, payload);
    const t2 = noteRtdbMotionWriteAttempt();
    noteRtdbMotionWriteOk(t2, payload);
    const snap = snapshotTrafficPublishMeters();
    assert.equal(snap.rtdbMotionWrites, 2);
    assert.equal(snap.rtdbMotionWriteBytesApprox, expected * 2);
  });

  it("doc-change helper ignores non-positive counts", () => {
    noteFsLiveRideUnderlyingDocChanges(0);
    noteFsLiveRideUnderlyingDocChanges(-1);
    noteFsLiveRideUnderlyingDocChanges(Number.NaN);
    noteFsLiveRideUnderlyingDocChanges(4);
    assert.equal(snapshotTrafficPublishMeters().fsLiveRideUnderlyingDocChanges, 4);
  });

  it("every note* helper no-ops unless isDevMeter() (production-safe)", () => {
    const src = readSrc("src/lib/debug/trafficPublishMeters.ts");
    const voidNoteFns = [
      "noteLivePublicationRideWriteOk",
      "noteLivePublicationRideWriteError",
      "noteRtdbMotionWriteOk",
      "noteRtdbMotionWriteError",
      "noteFsLiveRideUnderlyingDelivery",
      "noteFsLiveRideUnderlyingDocChanges",
      "noteRtdbMotionUnderlyingDelivery",
    ];
    for (const name of voidNoteFns) {
      const re = new RegExp(
        `export function ${name}\\([\\s\\S]*?\\): void \\{[\\s\\S]*?if \\(!isDevMeter\\(\\)\\) return;`,
      );
      assert.match(src, re, `${name} must gate on isDevMeter()`);
    }
    for (const name of ["noteLivePublicationRideWriteAttempt", "noteRtdbMotionWriteAttempt"]) {
      const re = new RegExp(
        `export function ${name}\\(\\): TrafficMeterTicket \\| null \\{[\\s\\S]*?if \\(!isDevMeter\\(\\)\\) return null;`,
      );
      assert.match(src, re, `${name} must gate on isDevMeter() and return null`);
    }
    assert.match(src, /function isDevMeter\(\): boolean \{[\s\S]*?import\.meta\.env\?\.DEV/);
    assert.match(src, /meterGeneration \+= 1/);
    assert.match(src, /ticketMatches/);
    const install = readSrc("src/lib/debug/installTrafficPublishDebug.ts");
    assert.match(install, /if \(!import\.meta\.env\.DEV\) return;/);
    assert.match(install, /armPairedCapture/);
    assert.match(install, /getPairedCapture/);
  });

  it("FS setDoc meters wrap the actual setDoc only", () => {
    const src = readSrc("src/lib/trail/repo/firestoreTrailLivePublicationRides.ts");
    const idxAttempt = src.indexOf("const writeTicket = noteLivePublicationRideWriteAttempt();");
    const idxSetDoc = src.indexOf("await setDoc(ref, payload, { merge: true });");
    const idxOk = src.indexOf("noteLivePublicationRideWriteOk(writeTicket);");
    const idxErr = src.indexOf("noteLivePublicationRideWriteError(writeTicket);");
    assert.ok(idxAttempt >= 0 && idxSetDoc >= 0 && idxOk >= 0 && idxErr >= 0);
    assert.ok(idxAttempt < idxSetDoc, "attempt must precede setDoc");
    assert.ok(idxSetDoc < idxOk, "ok must follow setDoc");
    assert.ok(idxOk < idxErr, "error note stays in catch after ok path");
    const between = src.slice(idxAttempt, idxSetDoc);
    assert.ok(!between.includes("__rtwMotionWriteFaultOnce"));
    assert.equal(between.includes("await setDoc"), false);
  });

  it("RTDB set meters wrap the actual set only; DEV fault stays before attempt", () => {
    const src = readSrc("src/lib/peerMotion/repo/rtdbTrailMotion.ts");
    const fnStart = src.indexOf("export async function mergeTrailMotionSnapshot");
    assert.ok(fnStart >= 0);
    const body = src.slice(fnStart, src.indexOf("export async function deleteTrailMotion"));
    const idxFault = body.indexOf("__rtwMotionWriteFaultOnce");
    const idxAttempt = body.indexOf("const writeTicket = noteRtdbMotionWriteAttempt();");
    const idxSet = body.indexOf("await set(motionRef(db, trailId, user.uid), payload);");
    const idxOk = body.indexOf("noteRtdbMotionWriteOk(writeTicket, payload);");
    const idxErr = body.indexOf("noteRtdbMotionWriteError(writeTicket);");
    assert.ok(idxFault >= 0 && idxAttempt >= 0 && idxSet >= 0 && idxOk >= 0 && idxErr >= 0);
    assert.ok(idxFault < idxAttempt, "DEV fault injection must precede set-attempt meter");
    assert.ok(idxAttempt < idxSet, "attempt must precede actual set()");
    assert.ok(idxSet < idxOk, "ok must follow set()");
    assert.ok(idxOk < idxErr, "error note stays in catch after ok path");
    const betweenFaultAndAttempt = body.slice(idxFault, idxAttempt);
    assert.ok(
      betweenFaultAndAttempt.includes('throw new Error("rtw-motion-write-fault-once")'),
      "fault must still throw before meters",
    );
    assert.ok(!betweenFaultAndAttempt.includes("noteRtdbMotionWrite"));
  });
});

import { test, expect, type Page, type Browser } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureRiding, guestStart, loadIntroCourse, setSpeedKmh } from "./rideEntryHelpers";
import { hostFor } from "../../../scripts/emulatorPorts.mjs";

/**
 * TASK-29A — Public Trail 1·2인 기능 매트릭스 (에뮬레이터 only; stronger than TASK-25).
 *
 * Covers: create(+open meta/listing) → B join → dual peer/data (F3) →
 * A Stop (summary UI + liveRide clear; NOT summary-close gate) while B keeps riding + listing →
 * A rejoin (clean navigate) → both Stop → listing gone.
 * Max 2 guests. No product source changes. F6 is separate (`--grep F6`); not this task.
 *
 * Hard guard: FIRESTORE / Auth / RTDB / Functions emulator hosts must be local.
 * Refuses live Firebase even if RIDE_VERIFY_LIVE=1 alone.
 *
 * Run: npm run test:e2e:public-trail-functional-create  (set RTW_DEV_PORT if 5000 busy)
 */

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
const AUTH_EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim() ?? "";
const RTDB_EMU =
  process.env.FIREBASE_DATABASE_EMULATOR_HOST?.trim() ??
  process.env.FIREBASE_RTDB_EMULATOR_HOST?.trim() ??
  "";
/** firebase-tools 가 host 를 안 넘기는 Windows 케이스 — Functions 번들 e2e 는 firebase.json 포트로 폴백 */
const FUNCTIONS_EMU =
  process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST?.trim() ||
  (process.env.RTW_E2E_WITH_FUNCTIONS === "1" && EMULATOR_HOST ? hostFor("functions") : "");
const FS_PROJECT = process.env.GCLOUD_PROJECT?.trim() || "boxcycle-dc2df";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/firebase-traffic");
const PHASE_JSONL = path.join(OUT_DIR, "public-trail-functional-phases.jsonl");
const STOP_PROBE_PHASE_JSONL = path.join(
  OUT_DIR,
  "public-trail-functional-stop-probe-phases.jsonl",
);
const STOP_PROBE_JSON = path.join(OUT_DIR, "public-trail-functional-stop-probe.json");
/**
 * create→join→companion→stop→rejoin can take ~2–3 min; F7 needs Stop×2 + listing.
 * Per-substep caps fail fast (AGENTS: no 5min+ blind browser wait). Outer wall is last resort.
 *
 * TASK-29A-R2 / TASK-29B: Playwright locator / expect.poll timeouts do NOT fire when CDP is
 * wedged — they await protocol replies. Hard-cap must (1) reject on a real timer and
 * (2) fire-and-forget page.close (never await close — close itself can stall).
 * Orphan fn rejections are swallowed so attempts do not pile up.
 */
const WALL_MS = 8 * 60_000;
const F6_WALL_MS = 5 * 60_000;
/** TASK-29B focused single-rider Stop probe — wall AFTER emulator boot (process ≤5min incl boot). */
const STOP_PROBE_WALL_MS = 90_000;
/**
 * TASK-29D create-matrix wall AFTER emulator boot.
 * Process deadline is 300s incl boot; leave headroom so abort+JSON beat hard kill.
 */
const CREATE_MATRIX_WALL_MS = 240_000;
/** Budget for one rider's Stop chain (km→click→summary→liveClear). */
const F7_STEP_MS = 90_000;
/** page.evaluate / Firestore probe — hard-cap closes page if exceeded. */
const EVAL_BOUND_MS = 8_000;
/** Summary visibility poll budget (must FAIL with JSON, never hang >5m). */
const SUMMARY_WAIT_MS = 25_000;
/** Heartbeat while waiting so Supervisor sees progress / last subphase. */
const PHASE_HEARTBEAT_MS = 5_000;
/** Supervisor signal: log when phase progress quiet >10s. */
const HEARTBEAT_WARN_MS = 10_000;
/**
 * Abort if no markHb for this long (must exceed longest single hard-cap inside Stop chain,
 * e.g. setSpeedKmh 35s — 10s abort would false-fail during legitimate speed set).
 */
const HEARTBEAT_MISS_MS = 40_000;

type HudDiag = {
  liveRideRows: { uid: string; publicationId: string }[];
  motionRowsLength: number;
  motionPeersAfterPidFilter: number;
  coursePeerHud: { id: string; label: string }[];
  routeActivity: { activeRiderCount: number | null };
};

type MatrixRow = {
  id: string;
  label: string;
  pass: boolean;
  evidence: Record<string, unknown>;
};

type TrailMetaFields = {
  visibility: string | null;
  status: string | null;
  hostUid: string | null;
  displayNumber: number | null;
  publicationId: string | null;
  regionLabel: string | null;
};

function isLocalHost(raw: string): boolean {
  const host = raw.toLowerCase();
  return (
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost") ||
    host.startsWith("[::1]")
  );
}

function assertEmulatorHostOnly(): void {
  if (!EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST missing — refuse live Firebase. Use firebase emulators:exec.",
    );
  }
  if (!isLocalHost(EMULATOR_HOST)) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST=${EMULATOR_HOST} is not a local emulator — abort.`,
    );
  }
  if (!AUTH_EMU || !isLocalHost(AUTH_EMU)) {
    throw new Error(
      `FIREBASE_AUTH_EMULATOR_HOST missing/non-local (${AUTH_EMU || "unset"}) — refuse live Auth.`,
    );
  }
  if (!RTDB_EMU || !isLocalHost(RTDB_EMU)) {
    throw new Error(
      `FIREBASE_DATABASE_EMULATOR_HOST missing/non-local (${RTDB_EMU || "unset"}) — refuse live RTDB.`,
    );
  }
  if (!FUNCTIONS_EMU || !isLocalHost(FUNCTIONS_EMU)) {
    throw new Error(
      `FIREBASE_FUNCTIONS_EMULATOR_HOST missing/non-local (${FUNCTIONS_EMU || "unset"}) — refuse live Functions. ` +
        "Use npm run test:e2e:public-trail-functional-create (run-with-functions-emulator.mjs).",
    );
  }
}

type PhaseEvent = "start" | "ok" | "fail";
type PhaseLog = (phase: string, event: PhaseEvent, extra?: Record<string, unknown>) => void;

function appendPhaseRow(row: Record<string, unknown>): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(PHASE_JSONL, `${JSON.stringify(row)}\n`, "utf8");
}

function createPhaseLogger(
  sessionId: string,
  testName: string,
  opts?: { task?: string; phasePath?: string },
) {
  const task = opts?.task ?? "TASK-29A";
  const phasePath = opts?.phasePath;
  return (phase: string, event: PhaseEvent, extra?: Record<string, unknown>) => {
    const row = {
      task,
      sessionId,
      testName,
      phase,
      event,
      atMs: Date.now(),
      iso: new Date().toISOString(),
      ...extra,
    };
    console.log(`[${task}] ${event.toUpperCase()} ${phase}${extra?.detail ? ` — ${extra.detail}` : ""}`);
    if (phasePath) {
      fs.mkdirSync(path.dirname(phasePath), { recursive: true });
      fs.appendFileSync(phasePath, `${JSON.stringify(row)}\n`, "utf8");
    } else {
      appendPhaseRow(row);
    }
  };
}

function writeMatrixSnapshot(payload: Record<string, unknown>): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "public-trail-functional-1-2.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

function docsUrl(docPath: string): string {
  return `http://${EMULATOR_HOST}/v1/projects/${FS_PROJECT}/databases/(default)/documents/${docPath}`;
}

function fieldString(fields: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = fields?.[key] as { stringValue?: string } | undefined;
  return typeof raw?.stringValue === "string" ? raw.stringValue : null;
}

function fieldNumber(fields: Record<string, unknown> | null | undefined, key: string): number | null {
  const raw = fields?.[key] as { integerValue?: string; doubleValue?: number } | undefined;
  if (raw?.integerValue != null) {
    const n = Number(raw.integerValue);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw?.doubleValue === "number" && Number.isFinite(raw.doubleValue)) return raw.doubleValue;
  return null;
}

async function fetchDocFields(docPath: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(docsUrl(docPath), {
    headers: { authorization: "Bearer owner" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Firestore GET ${docPath} failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { fields?: Record<string, unknown> };
  return json.fields ?? null;
}

async function readTrailMeta(trailId: string): Promise<TrailMetaFields | null> {
  const fields = await fetchDocFields(`trails/${trailId}`);
  if (!fields) return null;
  return {
    visibility: fieldString(fields, "visibility"),
    status: fieldString(fields, "status"),
    hostUid: fieldString(fields, "hostUid"),
    displayNumber: fieldNumber(fields, "displayNumber"),
    publicationId: fieldString(fields, "publicationId"),
    regionLabel: fieldString(fields, "regionLabel"),
  };
}

async function openListingExists(trailId: string): Promise<boolean> {
  return (await fetchDocFields(`openTrailListings/${trailId}`)) != null;
}

async function expandRouteDockIfNeeded(page: Page): Promise<void> {
  const expand = page.getByRole("button", { name: /^경로 패널 펼치기/ });
  // DOM snapshot — avoid locator.isVisible hanging when CDP is wedged.
  const needExpand = await withPageHardCap(page, 3_000, "expandDock-dom", async () =>
    page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.some((b) => /^경로 패널 펼치기/.test(b.getAttribute("aria-label") ?? ""));
    }),
  ).catch(() => false);
  if (needExpand) {
    await expand.click({ timeout: 8_000 });
  }
}

/**
 * Hard wall around a page op (TASK-29B).
 * - Timer rejects deterministically (does not wait for CDP / page.close).
 * - page.close is fire-and-forget to cancel CDP; close stalls must not block rejection.
 * - Late fn settle/reject is swallowed so races do not pile unresolved attempts.
 */
async function withPageHardCap<T>(
  page: Page,
  ms: number,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (settled) return;
      console.error(
        `[TASK-29B] HARD-CAP ${ms}ms — ${label} (reject now; page.close not awaited)`,
      );
      try {
        void page.close({ runBeforeUnload: false }).catch(() => undefined);
      } catch {
        /* ignore sync close throw */
      }
      reject(new Error(`bounded-timeout ${ms}ms — ${label}`));
    }, ms);
  });

  const work = (async (): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Target (page|closed)|has been closed|browser has been closed/i.test(msg)) {
        throw new Error(`bounded-timeout ${ms}ms — ${label} (page closed to cancel: ${msg})`, {
          cause: err,
        });
      }
      throw err;
    }
  })();

  // Swallow late rejection/resolve after race loser so attempts do not accumulate.
  void work.then(
    () => undefined,
    () => undefined,
  );

  try {
    const value = await Promise.race([work, timeoutPromise]);
    settled = true;
    return value;
  } catch (err) {
    settled = true;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Sync DOM snapshot — one evaluate; no locator auto-wait (TASK-29A-R2). */
type RideDomSnap = {
  tag: string;
  url: string;
  hudKmText: string | null;
  hudKm: number | null;
  elapsedText: string | null;
  endEnabled: boolean;
  startVisible: boolean;
  summaryOpen: boolean;
  summaryRole: string | null;
  trailMenuExpanded: boolean;
  bodyHasRideSummary: boolean;
};

async function readRideDomSnap(page: Page, tag: string): Promise<RideDomSnap> {
  return withPageHardCap(page, EVAL_BOUND_MS, `domSnap:${tag}`, () =>
    page.evaluate((t) => {
      const kmEl = document.querySelector(
        ".hud-metrics__cell--w-distance .hud-metrics__value",
      ) as HTMLElement | null;
      const hudKmText = kmEl?.textContent?.trim() ?? null;
      const kmMatch = hudKmText?.match(/([\d.]+)/);
      const hudKm = kmMatch ? parseFloat(kmMatch[1]) : null;
      const timeEl = document.querySelector(
        ".hud-metrics__cell--w-time .hud-metrics__value",
      ) as HTMLElement | null;
      const endBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === "주행 종료",
      ) as HTMLButtonElement | undefined;
      const startBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === "주행 시작",
      );
      const summary =
        (document.querySelector(".ride-summary") as HTMLElement | null) ??
        (document.querySelector('[role="region"][aria-label="주행 결과"]') as HTMLElement | null) ??
        (document.querySelector('[role="dialog"][aria-labelledby="ride-summary-title"]') as HTMLElement | null);
      const trailMenu = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.getAttribute("aria-label") ?? "") === "Trail 메뉴",
      );
      const styleOk =
        summary != null &&
        (() => {
          const s = window.getComputedStyle(summary);
          return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
        })();
      return {
        tag: t,
        url: location.href.slice(0, 160),
        hudKmText,
        hudKm: hudKm != null && Number.isFinite(hudKm) ? hudKm : null,
        elapsedText: timeEl?.textContent?.trim() ?? null,
        endEnabled: Boolean(endBtn && !endBtn.disabled),
        startVisible: Boolean(startBtn),
        summaryOpen: Boolean(summary && styleOk),
        summaryRole: summary?.getAttribute("role") ?? null,
        trailMenuExpanded: trailMenu?.getAttribute("aria-expanded") === "true",
        bodyHasRideSummary: document.querySelector(".ride-summary") != null,
      };
    }, tag),
  );
}

async function readHudKm(page: Page): Promise<number> {
  const snap = await readRideDomSnap(page, "km");
  return snap.hudKm ?? NaN;
}

/** UI/progress snapshot — DOM evaluate only (no locator chain). */
async function captureRideUi(page: Page, tag: string): Promise<Record<string, unknown>> {
  try {
    const snap = await readRideDomSnap(page, tag);
    return { ...snap, summaryVisible: snap.summaryOpen };
  } catch (err) {
    return {
      tag,
      captureError: err instanceof Error ? err.message : String(err),
      summaryVisible: false,
    };
  }
}

/**
 * Stop 전 유효 주행 확보 — discard(≤100m **또는** ≤5s) 이면 결과 시트가 안 뜬다.
 * HUD ride mode shows cumulativeKm (= virtualDistance, may include resume offset).
 * Gate on **delta** from call start (>0.15km) + ≥7s wall so sessionDistance grows
 * even when cumulative already high. Bounded — hard-cap page close.
 */
async function ensureMeaningfulRideBeforeStop(
  page: Page,
  opts?: { timeoutMs?: number; alreadyFast?: boolean; phase?: PhaseLog; phasePrefix?: string },
): Promise<number> {
  const timeoutMs = opts?.timeoutMs ?? 40_000;
  const t0 = Date.now();
  const p = opts?.phasePrefix ?? "km";
  if (!opts?.alreadyFast) {
    await withPageHardCap(page, 35_000, "setSpeedKmh(50) before Stop", () => setSpeedKmh(page, 50));
  }
  const startSnap = await readRideDomSnap(page, `${p}-km0`);
  const km0 = startSnap.hudKm ?? 0;
  // Manual poll + hard wall — do not rely on expect.poll when CDP can wedge.
  let lastKm = km0;
  let lastBeat = 0;
  while (Date.now() - t0 < timeoutMs) {
    const snap = await readRideDomSnap(page, `${p}-wait`);
    lastKm = snap.hudKm ?? km0;
    const delta = lastKm - km0;
    if (Date.now() - lastBeat >= PHASE_HEARTBEAT_MS) {
      lastBeat = Date.now();
      opts?.phase?.(`${p}-km-wait`, "start", {
        detail: `hudKm=${lastKm} km0=${km0} delta=${delta.toFixed(3)} elapsedText=${snap.elapsedText} t=${Date.now() - t0}ms`,
        hudKm: lastKm,
        km0,
        delta,
        elapsedText: snap.elapsedText,
      });
    }
    // Session growth ≈ cumulative delta while offset fixed; >0.15km → >150m > discard 100m.
    if (delta > 0.15) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const deltaDone = lastKm - km0;
  if (!(deltaDone > 0.15)) {
    throw new Error(
      `need session Δ>0.15 km before Stop (km0=${km0} hudKm=${lastKm} delta=${deltaDone}) so summary is not discarded`,
    );
  }
  // MIN_MEANINGFUL_RIDE_DURATION_SEC=5 — also require wall ≥7s from speed-up.
  const remain = 7_000 - (Date.now() - t0);
  if (remain > 0) {
    await new Promise((r) => setTimeout(r, remain));
  }
  const finalSnap = await readRideDomSnap(page, `${p}-km-done`);
  return finalSnap.hudKm ?? lastKm;
}

/**
 * Wait for summary via DOM snapshot poll + page hard-cap.
 * Never uses locator.waitFor / expect.poll (those can outlive their timeouts when CDP wedges).
 */
async function waitSummaryVisibleOrFail(
  page: Page,
  opts: {
    phase?: PhaseLog;
    phasePrefix: string;
    kmBeforeStop: number;
    budgetMs?: number;
  },
): Promise<RideDomSnap> {
  const budget = opts.budgetMs ?? SUMMARY_WAIT_MS;
  const t0 = Date.now();
  let lastBeat = 0;
  let lastSnap: RideDomSnap | null = null;
  while (Date.now() - t0 < budget) {
    lastSnap = await readRideDomSnap(page, `${opts.phasePrefix}-summary-poll`);
    if (Date.now() - lastBeat >= PHASE_HEARTBEAT_MS) {
      lastBeat = Date.now();
      opts.phase?.(`${opts.phasePrefix}-summary`, "start", {
        detail: `waiting summaryOpen=${lastSnap.summaryOpen} t=${Date.now() - t0}ms hudKm=${lastSnap.hudKm}`,
        snap: lastSnap,
      });
    }
    if (lastSnap.summaryOpen) return lastSnap;
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error(
    `Stop must show 주행 결과 sheet (kmBefore=${opts.kmBeforeStop}; close not required) — ui=${JSON.stringify(lastSnap)}`,
  );
}

/**
 * Stop: 결과 시트 UI 표시 + liveRide 문서 제거.
 * Summary close 는 게이트가 아님 (TASK-28C 증거 · TASK-29A).
 * `phasePrefix` 있으면 F7-A-km / F7-A-stop … 세분 로그.
 */
async function stopRideAssertSummaryAndLiveClear(
  page: Page,
  trailId: string,
  uid: string,
  opts?: {
    phase?: PhaseLog;
    phasePrefix?: string;
    alreadyFast?: boolean;
    stepBudgetMs?: number;
  },
): Promise<{ summaryVisible: boolean; kmBeforeStop: number }> {
  const log = opts?.phase;
  const p = opts?.phasePrefix ?? "stop";
  const stepMs = opts?.stepBudgetMs ?? F7_STEP_MS;
  const stepStart = Date.now();
  const guard = (label: string) => {
    if (Date.now() - stepStart > stepMs) {
      throw new Error(`step wall exceeded (${stepMs}ms) — ${p}/${label}`);
    }
  };

  log?.(`${p}-ui-before`, "start", { ui: await captureRideUi(page, `${p}-before`) });
  guard("before-km");
  log?.(`${p}-km`, "start");
  const kmBeforeStop = await ensureMeaningfulRideBeforeStop(page, {
    timeoutMs: Math.min(40_000, Math.max(10_000, stepMs - 25_000)),
    alreadyFast: opts?.alreadyFast,
    phase: log,
    phasePrefix: p,
  });
  log?.(`${p}-km`, "ok", { kmBeforeStop, ui: await captureRideUi(page, `${p}-km`) });

  guard("before-click");
  log?.(`${p}-click`, "start");
  await expandRouteDockIfNeeded(page);
  // Prefer DOM enablement check; click still via role locator with explicit timeout.
  const end = page.getByRole("button", { name: "주행 종료" });
  await withPageHardCap(page, 12_000, `${p}-end-enabled`, async () => {
    await expect(end).toBeEnabled({ timeout: 10_000 });
  });
  await withPageHardCap(page, 10_000, `${p}-end-click`, async () => {
    await end.click({ force: true, timeout: 8_000 });
  });
  log?.(`${p}-click`, "ok", { ui: await captureRideUi(page, `${p}-after-click`) });

  guard("before-summary");
  log?.(`${p}-summary`, "start", { detail: "dom-snapshot poll (no locator.waitFor)" });
  const summarySnap = await waitSummaryVisibleOrFail(page, {
    phase: log,
    phasePrefix: p,
    kmBeforeStop,
    budgetMs: Math.max(
      8_000,
      Math.min(SUMMARY_WAIT_MS, stepMs - (Date.now() - stepStart) - 15_000),
    ),
  });
  log?.(`${p}-summary`, "ok", { snap: summarySnap });

  guard("before-liveClear");
  log?.(`${p}-liveClear`, "start");
  const liveClearDeadline = Date.now() + 25_000;
  let liveGone = false;
  let liveClearErr: string | null = null;
  let liveBeat = 0;
  while (Date.now() < liveClearDeadline) {
    guard("liveClear-loop");
    try {
      liveGone = (await liveRideExists(page, trailId, uid)) === false;
      if (liveGone) break;
    } catch (err) {
      liveClearErr = err instanceof Error ? err.message : String(err);
    }
    if (Date.now() - liveBeat >= PHASE_HEARTBEAT_MS) {
      liveBeat = Date.now();
      log?.(`${p}-liveClear`, "start", {
        detail: `waiting liveGone t=${Date.now() - (liveClearDeadline - 25_000)}ms lastErr=${liveClearErr}`,
      });
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  if (!liveGone) {
    const ui = await captureRideUi(page, `${p}-liveClear-miss`);
    throw new Error(
      `livePublicationRides must clear after Stop (summary close not required) — lastErr=${liveClearErr} ui=${JSON.stringify(ui)}`,
    );
  }
  log?.(`${p}-liveClear`, "ok", { ui: await captureRideUi(page, `${p}-liveClear`) });
  return { summaryVisible: true, kmBeforeStop };
}

async function waitLiveRideProbe(page: Page): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < 20_000) {
    const ready = await withPageHardCap(page, EVAL_BOUND_MS, "__rtwLiveRideExists typeof", () =>
      page.evaluate(
        () => typeof (window as Window & { __rtwLiveRideExists?: unknown }).__rtwLiveRideExists === "function",
      ),
    ).catch(() => false);
    if (ready) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("__rtwLiveRideExists not ready within 20s");
}

async function liveRideExists(page: Page, trailId: string, uid: string): Promise<boolean> {
  await waitLiveRideProbe(page);
  return withPageHardCap(
    page,
    EVAL_BOUND_MS,
    `__rtwLiveRideExists(${trailId.slice(0, 6)},…)`,
    () =>
      page.evaluate(
        async ({ tid, id }) => {
          const fn = (window as Window & { __rtwLiveRideExists?: (t: string, u: string) => Promise<boolean> })
            .__rtwLiveRideExists;
          if (!fn) throw new Error("__rtwLiveRideExists missing");
          return fn(tid, id);
        },
        { tid: trailId, id: uid },
      ),
  );
}

async function resolveUid(page: Page): Promise<string> {
  await expect
    .poll(
      async () => page.evaluate(() => (window as Window & { __rtwLastRouteUid?: string | null }).__rtwLastRouteUid ?? null),
      { timeout: 30_000, message: "__rtwLastRouteUid not set — route publish not started" },
    )
    .not.toBeNull();
  return page.evaluate(() => (window as Window & { __rtwLastRouteUid?: string }).__rtwLastRouteUid!);
}

async function readDiag(page: Page): Promise<HudDiag> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => typeof (window as Window & { __rtwHudDiag?: unknown }).__rtwHudDiag === "function",
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  return page.evaluate(() => {
    const fn = (window as Window & { __rtwHudDiag?: () => HudDiag }).__rtwHudDiag;
    if (typeof fn !== "function") throw new Error("__rtwHudDiag missing");
    return fn();
  });
}

/**
 * Companion signals — split internal peer/data from visible HUD DOM.
 * `__rtwOtherLiveRiderCount` is internal only; never used to claim visible rider UI.
 * Map 위 두 라이더 육안은 Chief/user L 증거로 별도 (이 게이트가 아님).
 */
async function companionSignals(page: Page): Promise<{
  visibleUiOk: boolean;
  activityCount: number | null;
  hasOtherLive: boolean;
  peerListCount: number;
  otherLiveSignal: number | null;
}> {
  return page.evaluate(() => {
    const activity = document.querySelector(".hud-ride-presence__activity") as HTMLElement | null;
    const rawCount = activity?.getAttribute("data-companion-count") ?? "";
    const activityCount = rawCount.trim() ? Number(rawCount) : null;
    const hasOtherLive =
      document.querySelector('.hud-ride-presence__block[data-has-other-live="1"]') != null;
    const peerListCount = document.querySelectorAll(
      ".hud-ride-presence__block .hud-ride-presence__list li",
    ).length;
    const otherLiveSignal =
      typeof (window as Window & { __rtwOtherLiveRiderCount?: number }).__rtwOtherLiveRiderCount ===
      "number"
        ? (window as Window & { __rtwOtherLiveRiderCount?: number }).__rtwOtherLiveRiderCount!
        : null;
    const visibleUiOk =
      hasOtherLive ||
      (activityCount != null && Number.isFinite(activityCount) && activityCount >= 1) ||
      peerListCount >= 1;
    return { visibleUiOk, activityCount, hasOtherLive, peerListCount, otherLiveSignal };
  });
}

async function openTrailheadMenuList(page: Page): Promise<void> {
  const menuBtn = page.getByRole("button", { name: "Trail 메뉴" });
  if ((await menuBtn.getAttribute("aria-expanded")) !== "true") {
    await menuBtn.click();
  }
  await expect(menuBtn).toHaveAttribute("aria-expanded", "true", { timeout: 10_000 });
}

/** Trailhead 목록(합류 버튼 aria)에 trailId 가 보이는지 — listing UI 교차 확인. */
async function trailListedInHub(page: Page, trailId: string): Promise<boolean> {
  await openTrailheadMenuList(page);
  const hub = page.locator(".trail-hub");
  await expect(hub).toBeVisible({ timeout: 15_000 });
  // 목록 로딩이 끝날 때까지 잠깐 poll
  await expect
    .poll(async () => hub.locator(".trail-hub__meta").count(), { timeout: 20_000 })
    .toBe(0);
  const joinBtns = hub.locator("button.trail-hub__row-card--join");
  const n = await joinBtns.count();
  for (let i = 0; i < n; i += 1) {
    const label = (await joinBtns.nth(i).getAttribute("aria-label")) ?? "";
    const title = (await joinBtns.nth(i).getAttribute("title")) ?? "";
    // displayNumber / region 만 있고 id 는 숨길 수 있어 listing doc 이 1차 증거.
    // HUD room title 에 trailId 가 있으면 교차.
    if (label.includes(trailId) || title.includes(trailId)) return true;
  }
  const room = page.locator(".hud-ride-presence__room");
  const roomTitle = (await room.first().getAttribute("title").catch(() => null)) ?? "";
  return roomTitle === trailId;
}

async function bootHost(
  page: Page,
  opts?: { pick?: "longest" | "shortest"; maxKm?: number },
): Promise<{ trailId: string; uid: string; selectedKm: number | null }> {
  await page.goto("/?peerSyncLogMs=200");
  await guestStart(page);
  const { selectedKm } = await loadIntroCourse(page, {
    pick: opts?.pick ?? "longest",
    maxKm: opts?.maxKm,
  });
  await ensureRiding(page);
  await expect
    .poll(async () => new URL(page.url()).searchParams.get("trail"), { timeout: 20_000 })
    .not.toBeNull();
  const trailId = new URL(page.url()).searchParams.get("trail")!;
  await setSpeedKmh(page, opts?.pick === "shortest" ? 50 : 12);
  const uid = await resolveUid(page);
  return { trailId, uid, selectedKm };
}

async function joinGuest(page: Page, trailId: string): Promise<string> {
  await page.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`);
  await guestStart(page);
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
  await ensureRiding(page);
  await setSpeedKmh(page, 12);
  return resolveUid(page);
}

test.describe("Public Trail functional matrix (1–2 riders, emulator)", () => {
  test.setTimeout(WALL_MS);

  /**
   * TASK-29B — focused SINGLE-rider Stop probe (grep: single-rider-stop-probe).
   * No 2-rider claims. Wall ≤90s after emulator boot; process deadline ≤5min incl boot.
   * Do not run full create-matrix until this PASS.
   */
  test("TASK-29B single-rider-stop-probe: Stop → RideSummarySheet + liveClear", async ({
    page,
  }: {
    page: Page;
  }) => {
    test.setTimeout(STOP_PROBE_WALL_MS);
    assertEmulatorHostOnly();
    const started = Date.now();
    const sessionId = `stop-probe-${started}`;
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(STOP_PROBE_PHASE_JSONL, "", "utf8");
    const phase = createPhaseLogger(sessionId, "single-rider-stop-probe", {
      task: "TASK-29B",
      phasePath: STOP_PROBE_PHASE_JSONL,
    });
    let lastPhase = "init";
    let lastHeartbeatAt = Date.now();
    const markHb = () => {
      lastHeartbeatAt = Date.now();
    };
    const abortIfLate = (label: string) => {
      if (Date.now() - started > STOP_PROBE_WALL_MS) {
        throw new Error(`TASK-29B stop-probe wall exceeded (${STOP_PROBE_WALL_MS}ms) — ${label}`);
      }
      if (Date.now() - lastHeartbeatAt > HEARTBEAT_MISS_MS) {
        throw new Error(
          `TASK-29B heartbeat miss >${HEARTBEAT_MISS_MS}ms — lastPhase=${lastPhase} label=${label}`,
        );
      }
    };
    const hb = setInterval(() => {
      const age = Date.now() - lastHeartbeatAt;
      phase("heartbeat", "start", {
        detail: `ageMs=${age} lastPhase=${lastPhase} wallMs=${Date.now() - started}`,
        lastPhase,
        ageMs: age,
      });
      if (age > HEARTBEAT_WARN_MS) {
        console.error(`[TASK-29B] HEARTBEAT-WARN ageMs=${age} lastPhase=${lastPhase}`);
      }
      if (age > HEARTBEAT_MISS_MS) {
        console.error(`[TASK-29B] HEARTBEAT-MISS ageMs=${age} lastPhase=${lastPhase} — closing page`);
        void page.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    }, PHASE_HEARTBEAT_MS);

    let trailId = "";
    let uid = "";
    const writeProbe = (payload: Record<string, unknown>) => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(STOP_PROBE_JSON, JSON.stringify(payload, null, 2), "utf8");
    };

    phase("emulator-guard", "ok", {
      firestore: EMULATOR_HOST,
      auth: AUTH_EMU,
      rtdb: RTDB_EMU,
      functions: FUNCTIONS_EMU,
    });
    markHb();

    try {
      lastPhase = "boot";
      phase("boot", "start");
      abortIfLate("boot");
      ({ trailId, uid } = await withPageHardCap(page, 55_000, "stop-probe bootHost", () =>
        bootHost(page),
      ));
      markHb();
      phase("boot", "ok", {
        trailId,
        uidPrefix: uid.slice(0, 6),
        ui: await captureRideUi(page, "boot"),
      });

      lastPhase = "live-before";
      phase("live-before", "start");
      abortIfLate("live-before");
      const liveBefore = await liveRideExists(page, trailId, uid);
      expect(liveBefore, "livePublicationRide must exist before Stop").toBe(true);
      markHb();
      phase("live-before", "ok", { liveBefore });

      // Speed 50 + session Δ>0.15km + ≥7s → real Stop → immediate/periodic DOM → summary + liveClear.
      lastPhase = "stop-chain";
      phase("stop-chain", "start", { ui: await captureRideUi(page, "pre-stop") });
      abortIfLate("stop-chain");
      const remainForStop = Math.max(
        20_000,
        STOP_PROBE_WALL_MS - (Date.now() - started) - 5_000,
      );
      const stopResult = await stopRideAssertSummaryAndLiveClear(page, trailId, uid, {
        phase: (p, e, extra) => {
          markHb();
          lastPhase = p;
          phase(p, e, extra);
        },
        phasePrefix: "probe",
        stepBudgetMs: Math.min(F7_STEP_MS, remainForStop),
      });
      markHb();

      lastPhase = "assert";
      phase("assert", "start");
      abortIfLate("assert");
      const uiAfter = await captureRideUi(page, "post-stop");
      const liveAfter = await liveRideExists(page, trailId, uid);
      const pass =
        stopResult.summaryVisible === true &&
        liveAfter === false &&
        Boolean((uiAfter as RideDomSnap).summaryOpen ?? uiAfter.summaryVisible);
      writeProbe({
        task: "TASK-29B",
        probe: "single-rider-stop-probe",
        sessionId,
        pass,
        atMs: Date.now(),
        elapsedMs: Date.now() - started,
        lastPhase: "assert",
        trailId,
        uidPrefix: uid.slice(0, 6),
        kmBeforeStop: stopResult.kmBeforeStop,
        summaryVisible: stopResult.summaryVisible,
        liveAfter,
        uiAfter,
        claimTwoRider: false,
        note: "Single-rider only; no claim on 2-rider flow. Stronger create-matrix still PENDING until this PASS then separate run.",
      });
      expect(stopResult.summaryVisible, "RideSummarySheet must be visible after Stop").toBe(true);
      expect(liveAfter, "livePublicationRide must clear after Stop").toBe(false);
      phase("assert", "ok", { pass, liveAfter, uiAfter });
      phase("stop-probe", "ok", { elapsedMs: Date.now() - started });
    } catch (err) {
      const uiFail = await captureRideUi(page, "fail").catch((e) => ({
        captureError: e instanceof Error ? e.message : String(e),
      }));
      phase(lastPhase, "fail", {
        error: err instanceof Error ? err.message : String(err),
        ui: uiFail,
      });
      writeProbe({
        task: "TASK-29B",
        probe: "single-rider-stop-probe",
        sessionId,
        pass: false,
        failed: true,
        atMs: Date.now(),
        elapsedMs: Date.now() - started,
        lastPhase,
        error: err instanceof Error ? err.message : String(err),
        trailId: trailId || null,
        uidPrefix: uid ? uid.slice(0, 6) : null,
        ui: uiFail,
        claimTwoRider: false,
        note: "FAIL — diagnose from lastPhase + ui snapshot; no blind retry. Product defect only if summaryOpen:false with adequate session Δ/elapsed.",
      });
      throw err;
    } finally {
      clearInterval(hb);
    }
  });

  test("create → join → companion → A stop (B keeps) → A rejoin → both end", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(CREATE_MATRIX_WALL_MS);
    assertEmulatorHostOnly();
    const started = Date.now();
    const sessionId = `matrix-${started}`;
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(PHASE_JSONL, "", "utf8");
    const phase = createPhaseLogger(sessionId, "create-matrix", { task: "TASK-29D" });
    let lastPhase = "init";
    let lastHeartbeatAt = Date.now();
    const markHb = () => {
      lastHeartbeatAt = Date.now();
    };
    const abortIfLate = (label: string) => {
      if (Date.now() - started > CREATE_MATRIX_WALL_MS) {
        throw new Error(`TASK-29D create-matrix wall exceeded (${CREATE_MATRIX_WALL_MS}ms) — ${label}`);
      }
      if (Date.now() - lastHeartbeatAt > HEARTBEAT_MISS_MS) {
        throw new Error(
          `TASK-29D heartbeat miss >${HEARTBEAT_MISS_MS}ms — lastPhase=${lastPhase} label=${label}`,
        );
      }
    };

    const rows: MatrixRow[] = [];
    let trailId = "";
    let uidA = "";
    let uidB = "";
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const hb = setInterval(() => {
      const age = Date.now() - lastHeartbeatAt;
      phase("heartbeat", "start", {
        detail: `ageMs=${age} lastPhase=${lastPhase} wallMs=${Date.now() - started}`,
        lastPhase,
        ageMs: age,
      });
      if (age > HEARTBEAT_WARN_MS) {
        console.error(`[TASK-29D] HEARTBEAT-WARN ageMs=${age} lastPhase=${lastPhase}`);
      }
      if (age > HEARTBEAT_MISS_MS) {
        console.error(
          `[TASK-29D] HEARTBEAT-MISS ageMs=${age} lastPhase=${lastPhase} — closing pages`,
        );
        void pageA.close({ runBeforeUnload: false }).catch(() => undefined);
        void pageB.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    }, PHASE_HEARTBEAT_MS);

    phase("emulator-guard", "ok", {
      firestore: EMULATOR_HOST,
      auth: AUTH_EMU,
      rtdb: RTDB_EMU,
      functions: FUNCTIONS_EMU,
    });
    markHb();

    try {
    // 1) Public Trail 생성 — Trail 문서 visibility/status/host + listing
    lastPhase = "F1-create";
    phase("F1-create", "start");
    abortIfLate("A create");
    phase("A-boot", "start");
    ({ trailId, uid: uidA } = await bootHost(pageA));
    markHb();
    phase("A-boot", "ok", { trailId, uidAPrefix: uidA.slice(0, 6) });
    const aLiveAfterCreate = await liveRideExists(pageA, trailId, uidA);
    await expect
      .poll(async () => readTrailMeta(trailId), {
        timeout: 20_000,
        message: "trails/{id} should exist after Public Trail create",
      })
      .not.toBeNull();
    const trailMeta = (await readTrailMeta(trailId))!;
    await expect
      .poll(async () => openListingExists(trailId), {
        timeout: 25_000,
        message: "openTrailListings/{id} should exist after create+liveRide",
      })
      .toBe(true);
    const listingAfterCreate = await openListingExists(trailId);
    const f1Pass =
      Boolean(trailId) &&
      aLiveAfterCreate &&
      trailMeta.visibility === "open" &&
      trailMeta.status === "open" &&
      trailMeta.hostUid === uidA &&
      Boolean(trailMeta.publicationId?.trim()) &&
      trailMeta.displayNumber != null &&
      listingAfterCreate;
    rows.push({
      id: "F1-create",
      label: "Public Trail 생성",
      pass: f1Pass,
      evidence: {
        trailId,
        uidAPrefix: uidA.slice(0, 6),
        liveRideA: aLiveAfterCreate,
        visibility: trailMeta.visibility,
        status: trailMeta.status,
        hostUidPrefix: trailMeta.hostUid?.slice(0, 6) ?? null,
        displayNumber: trailMeta.displayNumber,
        publicationIdPrefix: trailMeta.publicationId?.slice(0, 8) ?? null,
        regionLabel: trailMeta.regionLabel,
        openListing: listingAfterCreate,
      },
    });
    expect(trailMeta.visibility, "Trail visibility must be open").toBe("open");
    expect(trailMeta.status, "Trail status must be open").toBe("open");
    expect(trailMeta.hostUid, "Trail hostUid must be creator").toBe(uidA);
    expect(trailMeta.publicationId?.trim(), "Public Trail needs publicationId").toBeTruthy();
    expect(listingAfterCreate, "openTrailListings after create").toBe(true);
    expect(aLiveAfterCreate, "host live-ride doc after create").toBe(true);
    phase("F1-create", "ok", { trailId, openListing: listingAfterCreate });
    markHb();

    // 2) 합류
    lastPhase = "F2-join";
    phase("F2-join", "start");
    abortIfLate("B join");
    phase("B-boot", "start");
    uidB = await joinGuest(pageB, trailId);
    markHb();
    phase("B-boot", "ok", { uidBPrefix: uidB.slice(0, 6) });
    const bLive = await liveRideExists(pageB, trailId, uidB);
    rows.push({
      id: "F2-join",
      label: "동행 참여/합류",
      pass: bLive && new URL(pageB.url()).searchParams.get("trail") === trailId,
      evidence: {
        trailId,
        uidBPrefix: uidB.slice(0, 6),
        liveRideB: bLive,
        urlTrail: new URL(pageB.url()).searchParams.get("trail"),
      },
    });
    expect(bLive, "guest live-ride after join+start").toBe(true);
    phase("F2-join", "ok", { liveRideB: bLive });
    markHb();

    // 3) 동행 peer/data — motion peers≥1 both sides (DB 두 문서만으로 PASS 금지).
    // visible HUD DOM 은 별도 기록; __rtwOtherLiveRiderCount 만으로 visual claim 금지.
    // 지도 위 두 라이더 육안 = Chief/user L (이 E2E 게이트 밖).
    lastPhase = "F3-companion";
    phase("F3-companion", "start");
    abortIfLate("companion");
    const dualLiveDb =
      (await liveRideExists(pageA, trailId, uidA)) && (await liveRideExists(pageA, trailId, uidB));
    expect(dualLiveDb, "dual live-ride is prerequisite but not sufficient for F3").toBe(true);
    markHb();

    let dualA: HudDiag | null = null;
    let dualB: HudDiag | null = null;
    let sigA = await companionSignals(pageA);
    let sigB = await companionSignals(pageB);
    await expect
      .poll(
        async () => {
          markHb();
          dualA = await readDiag(pageA);
          dualB = await readDiag(pageB);
          sigA = await companionSignals(pageA);
          sigB = await companionSignals(pageB);
          const peersOk =
            (dualA.motionPeersAfterPidFilter ?? 0) >= 1 &&
            (dualB.motionPeersAfterPidFilter ?? 0) >= 1;
          return peersOk ? 1 : 0;
        },
        {
          timeout: 60_000,
          message: "F3 requires peersA/B≥1 (internal peer/data); visual HUD is separate evidence",
        },
      )
      .toBe(1);
    markHb();

    const peersA = dualA!.motionPeersAfterPidFilter;
    const peersB = dualB!.motionPeersAfterPidFilter;
    const peerDataOk = dualLiveDb && peersA >= 1 && peersB >= 1;
    const visibleHudDomBoth = sigA.visibleUiOk && sigB.visibleUiOk;
    rows.push({
      id: "F3-companion",
      label: "동행 peer/data (visible UI 별도)",
      pass: peerDataOk,
      evidence: {
        dualLiveDb,
        peerDataOk,
        liveRowsA: dualA?.liveRideRows.length ?? null,
        liveRowsB: dualB?.liveRideRows.length ?? null,
        motionA: dualA?.motionRowsLength ?? null,
        motionB: dualB?.motionRowsLength ?? null,
        peersA,
        peersB,
        coursePeerHudA: dualA?.coursePeerHud?.length ?? null,
        coursePeerHudB: dualB?.coursePeerHud?.length ?? null,
        visibleHudDomA: sigA,
        visibleHudDomB: sigB,
        visibleHudDomBoth,
        visualUiClaimedFromOtherLiveSignalAlone: false,
        mapTwoRidersVisual: "L — Chief/user independent observation; not this E2E gate",
      },
    });
    expect(peersA, "peersA must be ≥1 (actual companion motion)").toBeGreaterThanOrEqual(1);
    expect(peersB, "peersB must be ≥1 (actual companion motion)").toBeGreaterThanOrEqual(1);
    await expect(pageA.getByRole("button", { name: "주행 종료" })).toBeEnabled();
    await expect(pageB.getByRole("button", { name: "주행 종료" })).toBeEnabled();
    phase("F3-companion", "ok", {
      peersA,
      peersB,
      peerDataOk,
      visibleHudDomBoth,
      otherLiveSignalA: sigA.otherLiveSignal,
      otherLiveSignalB: sigB.otherLiveSignal,
    });
    markHb();

    // 4) Stop (A): summary UI + liveRide clear (no summary-close gate) + B keep + listing persist
    lastPhase = "F4-stop";
    phase("F4-stop", "start");
    abortIfLate("A stop / B keep");
    const aStop = await stopRideAssertSummaryAndLiveClear(pageA, trailId, uidA, {
      phase: (p, e, extra) => {
        markHb();
        lastPhase = p;
        phase(p, e, extra);
      },
      phasePrefix: "F4-A",
      stepBudgetMs: F7_STEP_MS,
    });
    markHb();
    await expect(pageB.getByRole("button", { name: "주행 종료" })).toBeEnabled({ timeout: 10_000 });
    const bStillLive = await liveRideExists(pageB, trailId, uidB);
    const bStillRidingUi = await pageB.getByRole("button", { name: "주행 종료" }).isEnabled();
    await expect
      .poll(async () => openListingExists(trailId), {
        timeout: 25_000,
        message: "F4: Trail must remain in openTrailListings while B still rides",
      })
      .toBe(true);
    const listingWhileB = await openListingExists(trailId);
    const aLiveAfterStop = await liveRideExists(pageA, trailId, uidA);
    rows.push({
      id: "F4-stop",
      label: "Stop (A 주행 종료)",
      pass: aStop.summaryVisible && aLiveAfterStop === false && listingWhileB,
      evidence: {
        summaryVisible: aStop.summaryVisible,
        summaryCloseRequired: false,
        kmBeforeStop: aStop.kmBeforeStop,
        aLiveAfterStop,
        bLive: bStillLive,
        openListingWhileB: listingWhileB,
      },
    });
    rows.push({
      id: "F8-other-keeps",
      label: "다른 라이더 주행 유지",
      pass: bStillLive && bStillRidingUi && listingWhileB,
      evidence: {
        bLive: bStillLive,
        bEndEnabled: bStillRidingUi,
        trailId,
        openListingWhileB: listingWhileB,
      },
    });
    expect(aStop.summaryVisible, "Stop must show summary sheet").toBe(true);
    expect(aLiveAfterStop, "A live-ride cleared after Stop").toBe(false);
    expect(bStillLive, "B live-ride must remain after A Stop").toBe(true);
    expect(bStillRidingUi, "B UI still riding after A Stop").toBe(true);
    expect(listingWhileB, "openTrailListings must remain while B rides").toBe(true);
    phase("F4-stop", "ok", {
      aLiveAfterStop,
      listingWhileB,
      summaryVisible: aStop.summaryVisible,
      summaryCloseRequired: false,
    });
    lastPhase = "F8-other-keeps";
    phase("F8-other-keeps", "start");
    phase("F8-other-keeps", "ok", { bStillLive, bStillRidingUi, listingWhileB });
    markHb();

    // 5) 재참여 — clean navigate to same Trail (summary may still be open; do not close-gate)
    lastPhase = "F5-rejoin";
    phase("F5-rejoin", "start");
    abortIfLate("A rejoin");
    await pageA.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`);
    markHb();
    // Same browser context keeps guest auth; gate only if shown.
    const gateRejoin = pageA.getByRole("dialog", { name: "시작" });
    const gateRejoinOpen = await withPageHardCap(pageA, 3_000, "F5 gate-dom", () =>
      pageA.evaluate(() => document.querySelector('[role="dialog"][aria-label="시작"]') != null),
    ).catch(() => false);
    if (gateRejoinOpen) {
      await gateRejoin.getByRole("button", { name: "시작", exact: true }).click();
      await expect(gateRejoin).toBeHidden({ timeout: 30_000 });
    }
    await expect(pageA.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
    await ensureRiding(pageA);
    // Pre-warm A to meaningful km @50 so F7-A Stop does not burn the wall on distance wait.
    phase("F5-A-km-warm", "start");
    await withPageHardCap(pageA, 35_000, "F5 setSpeedKmh(50)", () => setSpeedKmh(pageA, 50));
    markHb();
    const aKmWarm = await ensureMeaningfulRideBeforeStop(pageA, {
      alreadyFast: true,
      timeoutMs: 40_000,
      phase: (p, e, extra) => {
        markHb();
        lastPhase = p;
        phase(p, e, extra);
      },
      phasePrefix: "F5-A",
    });
    phase("F5-A-km-warm", "ok", { aKmWarm, uiA: await captureRideUi(pageA, "F5-warm") });
    markHb();
    await expect
      .poll(async () => liveRideExists(pageA, trailId, uidA), {
        timeout: 45_000,
        message: "A live-ride after rejoin",
      })
      .toBe(true);
    const aRejoined = await liveRideExists(pageA, trailId, uidA);
    const bStillAfterRejoin = await liveRideExists(pageB, trailId, uidB);
    const listingAfterRejoin = await openListingExists(trailId);
    const bKmAtF5 = await readHudKm(pageB).catch(() => NaN);
    rows.push({
      id: "F5-rejoin",
      label: "재참여",
      pass: aRejoined && bStillAfterRejoin && listingAfterRejoin,
      evidence: {
        aLive: aRejoined,
        bLive: bStillAfterRejoin,
        openListing: listingAfterRejoin,
        urlTrailA: new URL(pageA.url()).searchParams.get("trail"),
        rejoinNav: "clean goto /?trail=",
        aKmWarm,
        bKmAtF5: Number.isFinite(bKmAtF5) ? bKmAtF5 : null,
      },
    });
    expect(aRejoined).toBe(true);
    expect(bStillAfterRejoin, "B must still ride during A rejoin").toBe(true);
    phase("F5-rejoin", "ok", {
      aRejoined,
      bStillAfterRejoin,
      listingAfterRejoin,
      aKmWarm,
      bKmAtF5: Number.isFinite(bKmAtF5) ? bKmAtF5 : null,
    });
    markHb();

    // 7) Trail 종료 — 양쪽 Stop (summary+live clear, no close gate) 후 listing 제거
    lastPhase = "F7-end";
    phase("F7-end", "start", {
      uiA: await captureRideUi(pageA, "F7-enter-A"),
      uiB: await captureRideUi(pageB, "F7-enter-B"),
      elapsedMs: Date.now() - started,
    });
    abortIfLate("both end");
    // Keep B moving so ensureMeaningfulRide is cheap; A already warmed in F5.
    phase("F7-B-speed", "start");
    await withPageHardCap(pageB, 40_000, "F7 B setSpeedKmh(50)", () => setSpeedKmh(pageB, 50));
    markHb();
    phase("F7-B-speed", "ok", { uiB: await captureRideUi(pageB, "F7-B-speed") });

    lastPhase = "F7-A-stop";
    const aEnd = await stopRideAssertSummaryAndLiveClear(pageA, trailId, uidA, {
      phase: (p, e, extra) => {
        markHb();
        lastPhase = p;
        phase(p, e, extra);
      },
      phasePrefix: "F7-A",
      alreadyFast: true,
      stepBudgetMs: F7_STEP_MS,
    });
    markHb();
    abortIfLate("after A end");
    phase("F7-A-done", "ok", {
      kmBeforeStop: aEnd.kmBeforeStop,
      listingAfterA: await openListingExists(trailId),
      bStillLive: await liveRideExists(pageB, trailId, uidB),
    });

    lastPhase = "F7-B-stop";
    const bEnd = await stopRideAssertSummaryAndLiveClear(pageB, trailId, uidB, {
      phase: (p, e, extra) => {
        markHb();
        lastPhase = p;
        phase(p, e, extra);
      },
      phasePrefix: "F7-B",
      alreadyFast: true,
      stepBudgetMs: F7_STEP_MS,
    });
    markHb();
    abortIfLate("after B end");
    phase("F7-B-done", "ok", { kmBeforeStop: bEnd.kmBeforeStop });

    lastPhase = "F7-dual-live-clear";
    phase("F7-dual-live-clear", "start");
    let aLiveEvidence: boolean | null = null;
    let bLiveEvidence: boolean | null = null;
    await expect
      .poll(
        async () => {
          markHb();
          const a = await liveRideExists(pageA, trailId, uidA);
          const b = await liveRideExists(pageB, trailId, uidB);
          aLiveEvidence = a;
          bLiveEvidence = b;
          return !a && !b;
        },
        { timeout: 25_000, intervals: [300], message: "both live-rides should clear after dual end" },
      )
      .toBe(true);
    // Capture live-clear evidence HERE — before secondary hub UI (which may close pages).
    aLiveEvidence = false;
    bLiveEvidence = false;
    markHb();
    phase("F7-dual-live-clear", "ok", { aLiveEvidence, bLiveEvidence });

    lastPhase = "F7-listing-gone";
    phase("F7-listing-gone", "start");
    await expect
      .poll(
        async () => {
          markHb();
          return openListingExists(trailId);
        },
        {
          timeout: 35_000,
          intervals: [400],
          message: "F7: openTrailListings/{id} must be removed after last rider Stop",
        },
      )
      .toBe(false);
    const listingAfterEnd = await openListingExists(trailId);
    markHb();
    phase("F7-listing-gone", "ok", { listingAfterEnd });

    // Trailhead 교차 확인 — secondary; listing REST is primary. Must not kill F7 row.
    lastPhase = "F7-hub-check";
    phase("F7-hub-check", "start");
    let listedInHub = false;
    let hubError: string | null = null;
    try {
      markHb();
      await withPageHardCap(pageA, 20_000, "F7 hub goto", () => pageA.goto("/?peerSyncLogMs=200"));
      markHb();
      await expect(pageA.getByRole("button", { name: "Trail 메뉴" })).toBeVisible({ timeout: 12_000 });
      markHb();
      const gate = pageA.getByRole("dialog", { name: "시작" });
      const gateOpen = await withPageHardCap(pageA, 3_000, "F7 gate-dom", () =>
        pageA.evaluate(() => {
          const d = document.querySelector('[role="dialog"][aria-label="시작"]');
          return d != null;
        }),
      ).catch(() => false);
      if (gateOpen) {
        await gate.getByRole("button", { name: "시작", exact: true }).click();
        await expect(gate).toBeHidden({ timeout: 15_000 });
      }
      markHb();
      listedInHub = await withPageHardCap(pageA, 20_000, "trailListedInHub", () =>
        trailListedInHub(pageA, trailId),
      );
    } catch (hubErr) {
      listedInHub = false;
      hubError = hubErr instanceof Error ? hubErr.message : String(hubErr);
    }
    markHb();
    phase("F7-hub-check", "ok", { listedInHub, hubError });

    const f7Pass =
      listingAfterEnd === false &&
      aEnd.summaryVisible &&
      bEnd.summaryVisible &&
      aLiveEvidence === false &&
      bLiveEvidence === false;
    rows.push({
      id: "F7-end",
      label: "Trail 종료 (양쪽 Stop)",
      pass: f7Pass,
      evidence: {
        aLive: aLiveEvidence,
        bLive: bLiveEvidence,
        liveEvidenceCapturedAt: "F7-dual-live-clear",
        summaryVisibleA: aEnd.summaryVisible,
        summaryVisibleB: bEnd.summaryVisible,
        kmBeforeStopA: aEnd.kmBeforeStop,
        kmBeforeStopB: bEnd.kmBeforeStop,
        summaryCloseRequired: false,
        openListingAfterEnd: listingAfterEnd,
        listedInHubAfterEnd: listedInHub,
        hubError,
        hubIsSecondary: true,
      },
    });
    expect(listingAfterEnd, "openTrailListings must be gone after last Stop").toBe(false);
    expect(aEnd.summaryVisible, "A summary after F7 Stop").toBe(true);
    expect(bEnd.summaryVisible, "B summary after F7 Stop").toBe(true);
    expect(aLiveEvidence, "A live must be cleared (captured at dual-live-clear)").toBe(false);
    expect(bLiveEvidence, "B live must be cleared (captured at dual-live-clear)").toBe(false);
    lastPhase = "F7-end";
    phase("F7-end", "ok", { listingAfterEnd, listedInHubAfterEnd: listedInHub, f7Pass });

    const elapsedMin = Math.round(((Date.now() - started) / 60_000) * 10) / 10;
    const allPass = rows.every((r) => r.pass);
    writeMatrixSnapshot({
      task: "TASK-29D",
      sessionId,
      atMs: Date.now(),
      elapsedMin,
      elapsedMs: Date.now() - started,
      lastPhase: "F7-end",
      emulatorHost: EMULATOR_HOST,
      authEmu: AUTH_EMU,
      rtdbEmu: RTDB_EMU,
      functionsEmu: FUNCTIONS_EMU,
      trailId,
      uidAPrefix: uidA.slice(0, 6),
      uidBPrefix: uidB.slice(0, 6),
      allPass,
      rows,
      noteComplete:
        "Stronger matrix vs TASK-25 weak PASS. F6 완주는 별도 --grep F6. Map visual two riders = L separate. F7 hub secondary.",
      supersedesWeakTask25: true,
    });

    expect(allPass, `matrix rows failed: ${rows.filter((r) => !r.pass).map((r) => r.id).join(",")}`).toBe(
      true,
    );
    } catch (err) {
      const uiAFail = await captureRideUi(pageA, "fail-A").catch((e) => ({
        captureError: e instanceof Error ? e.message : String(e),
      }));
      const uiBFail = await captureRideUi(pageB, "fail-B").catch((e) => ({
        captureError: e instanceof Error ? e.message : String(e),
      }));
      phase(lastPhase, "fail", {
        error: err instanceof Error ? err.message : String(err),
        uiA: uiAFail,
        uiB: uiBFail,
      });
      writeMatrixSnapshot({
        task: "TASK-29D",
        sessionId,
        atMs: Date.now(),
        elapsedMin: Math.round(((Date.now() - started) / 60_000) * 10) / 10,
        elapsedMs: Date.now() - started,
        lastPhase,
        failed: true,
        error: err instanceof Error ? err.message : String(err),
        emulatorHost: EMULATOR_HOST,
        authEmu: AUTH_EMU,
        rtdbEmu: RTDB_EMU,
        functionsEmu: FUNCTIONS_EMU,
        trailId: trailId || null,
        uidAPrefix: uidA ? uidA.slice(0, 6) : null,
        uidBPrefix: uidB ? uidB.slice(0, 6) : null,
        uiA: uiAFail,
        uiB: uiBFail,
        rows,
        supersedesWeakTask25: false,
        note: "FAIL — do not treat TASK-25 weak PASS as current stronger evidence; no blind retry",
      });
      throw err;
    } finally {
      clearInterval(hb);
      await ctxA.close().catch(() => undefined);
      await ctxB.close().catch(() => undefined);
    }
  });

  test("F6 public trail finish (short intro ≤0.5km @50km/h)", async ({ page }) => {
    test.setTimeout(F6_WALL_MS);
    assertEmulatorHostOnly();
    const started = Date.now();
    const sessionId = `f6-${started}`;
    const phase = createPhaseLogger(sessionId, "F6-finish");
    let lastPhase = "init";
    const abortIfLate = (label: string) => {
      if (Date.now() - started > F6_WALL_MS) {
        throw new Error(`TASK-25R2/F6 wall exceeded — ${label}`);
      }
    };

    phase("emulator-guard", "ok", {
      firestore: EMULATOR_HOST,
      auth: AUTH_EMU,
      rtdb: RTDB_EMU,
      functions: FUNCTIONS_EMU,
    });

    let trailId = "";
    let uid = "";
    let selectedKm: number | null;
    let riddenKm: number;
    let totalKm: number;
    let trailMeta: TrailMetaFields | null;

    try {
    lastPhase = "F6-boot";
    phase("F6-boot", "start");
    abortIfLate("boot");
    ({ trailId, uid, selectedKm } = await bootHost(page, {
      pick: "shortest",
      maxKm: 0.5,
    }));
    expect(selectedKm, "intro route must be ≤0.5km").not.toBeNull();
    expect(selectedKm!, "intro route must be ≤0.5km").toBeLessThanOrEqual(0.5);
    phase("F6-boot", "ok", { trailId, selectedKm, uidPrefix: uid.slice(0, 6) });

    trailMeta = await readTrailMeta(trailId);
    expect(trailMeta?.visibility).toBe("open");
    expect(trailMeta?.status).toBe("open");
    expect(trailMeta?.hostUid).toBe(uid);
    const liveBefore = await liveRideExists(page, trailId, uid);
    expect(liveBefore).toBe(true);

    lastPhase = "F6-ride-to-finish";
    phase("F6-ride-to-finish", "start");
    abortIfLate("ride-to-finish");
    // 도착 자동 종료 → 결과 시트. 수동 Stop 으로 대체하지 않는다.
    const finishT0 = Date.now();
    let finished = false;
    while (Date.now() - finishT0 < 150_000) {
      const snap = await readRideDomSnap(page, "F6-progress");
      if (snap.summaryOpen || (snap.hudKm != null && snap.hudKm > 0.05)) {
        if (snap.summaryOpen) {
          finished = true;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    const sheetSnap = await waitSummaryVisibleOrFail(page, {
      phase,
      phasePrefix: "F6",
      kmBeforeStop: NaN,
      budgetMs: finished ? 5_000 : 120_000,
    });
    void sheetSnap;

    const pairText = await withPageHardCap(page, 8_000, "F6 pair text", () =>
      page.evaluate(() => {
        // 2026-10-08 — 진행 블록으로 바뀌어 숫자는 data-* 로 읽는다
        const el = document.querySelector('[aria-label="주행 거리 / 경로 전체거리"]');
        return el ? `${el.getAttribute("data-ridden-km")} / ${el.getAttribute("data-total-km")}` : "";
      }),
    );
    expect(pairText).toMatch(/^\d+\.\d{2}\s*\/\s*\d+\.\d{2}$/);
    [riddenKm, totalKm] = pairText.split("/").map((v) => Number(v.trim()));
    expect(riddenKm, `완주인데 주행거리≠총거리: ${pairText}`).toBeCloseTo(totalKm, 2);
    expect(totalKm, `완주 Route ≤0.5km: ${totalKm}`).toBeLessThanOrEqual(0.5);
    phase("F6-ride-to-finish", "ok", { pairText, riddenKm, totalKm });

    lastPhase = "F6-cleanup";
    phase("F6-cleanup", "start");
    // Trail 관계: 완주 직후 live-ride 정리 + listing 제거(단독 라이더)
    await expect
      .poll(async () => liveRideExists(page, trailId, uid), {
        timeout: 25_000,
        message: "live-ride clears after Public Trail finish",
      })
      .toBe(false);
    await expect
      .poll(async () => openListingExists(trailId), {
        timeout: 35_000,
        message: "openTrailListings removed after solo finish",
      })
      .toBe(false);

    const evidence = {
      task: "TASK-25R2-F6",
      sessionId,
      trailId,
      uidPrefix: uid.slice(0, 6),
      selectedKm,
      riddenKm,
      totalKm,
      visibility: trailMeta?.visibility ?? null,
      status: trailMeta?.status ?? null,
      liveAfterFinish: await liveRideExists(page, trailId, uid),
      openListingAfterFinish: await openListingExists(trailId),
      urlTrailAtFinish: new URL(page.url()).searchParams.get("trail"),
      elapsedMin: Math.round(((Date.now() - started) / 60_000) * 10) / 10,
      functionsEmu: FUNCTIONS_EMU,
      lastPhase: "F6-cleanup",
    };
    phase("F6-cleanup", "ok", { liveAfterFinish: evidence.liveAfterFinish, openListing: evidence.openListingAfterFinish });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, "public-trail-functional-f6.json"),
      JSON.stringify({ pass: true, ...evidence }, null, 2),
      "utf8",
    );
    } catch (err) {
      phase(lastPhase, "fail", { error: err instanceof Error ? err.message : String(err) });
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(OUT_DIR, "public-trail-functional-f6.json"),
        JSON.stringify(
          {
            pass: false,
            task: "TASK-25R2-F6",
            sessionId,
            lastPhase,
            error: err instanceof Error ? err.message : String(err),
            trailId: trailId || null,
            elapsedMin: Math.round(((Date.now() - started) / 60_000) * 10) / 10,
            functionsEmu: FUNCTIONS_EMU,
          },
          null,
          2,
        ),
        "utf8",
      );
      throw err;
    }
  });
});

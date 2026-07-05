import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

/**
 * Conquest(정복) 레이어 v2 — 도로 셀 기반(2026-07-03 도로 전환).
 * rides 생성 시 클라이언트 payload(도로 셀 + 궤적)에 Trust Tier 한도를 적용해
 * 「내 도로망」(신규 도로 미터·궤적)을 집계한다.
 * 설계 SoT: document/260703-Conquest-정복-레이어-설계.md §3~§4.
 *
 * Pioneer 는 셀 단위로 부여하지 않는다 — 구간 챌린지(교차로~교차로·IC~JC 완주)로
 * Phase B 에서 설계(§3.4 개정). v1 타일 데이터(z10 청크·pioneerChunks)는 유휴.
 *
 * 데이터:
 *   conquest/{uid}                 → 요약: totalMeters, totalCells, daily{day,usedSec,usedMeters}
 *   conquest/{uid}/chunks/{z12}    → { cells: { "<z20Id>": <dayKey> } }
 *   conquest/{uid}/traces/{rideId} → { path: [[lng,lat]...], newMeters, day } (「내 도로망」 렌더)
 *   rides/{rideId}.conquestResult  → { newMeters, newCells, creditedMeters, tier, day }
 */

const CELL_ZOOM = 20;
const CHUNK_ZOOM = 12;
const PAYLOAD_VERSION = 2;
const MAX_CELLS = 8000;
const CELL_ID_RE = /^20_\d{1,8}_\d{1,8}$/;
const MAX_TRACE_VERTICES = 400;

/* ---- Trust Tier 한도(§3.2~3.3) — 전부 가설 수치, OQ-7 튜닝 대상 ----
 * ⚠️ 개발 완화 적용 중(테스트 편의) — 출시 전 복원: document/출시 전 확인사항.md
 *    T0 속도 상한 50→15km/h · T0 일일 50km→5km */
/** T0(no-sensor): 정복 인정 속도 상한. 출시: 15 / 3.6 */
const T0_SPEED_CAP_MPS = 50 / 3.6;
/** T0: 1일 정복 인정 거리 한도(m). 출시: 5000 */
const T0_DAILY_METERS = 50000;
/** T1(케이던스): 정복 인정 속도 상한 */
const T1_SPEED_CAP_MPS = 30 / 3.6;
/** T1: 일일 전액 인정 구간(초) — 이후 절반, T1_STOP_SEC 에서 정지 */
const T1_FULL_SEC = 2 * 3600;
const T1_STOP_SEC = 4 * 3600;

type PayloadCell = { id: string; m: number };

function chunkIdOfCellId(cellId: string): string {
  const parts = cellId.split("_");
  const shift = CELL_ZOOM - CHUNK_ZOOM;
  return `${CHUNK_ZOOM}_${Number(parts[1]) >> shift}_${Number(parts[2]) >> shift}`;
}

/** KST 기준 일자 키(대상 사용자층·CF 리전과 일치) */
function dayKeyKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function sanitizeCells(raw: unknown): PayloadCell[] {
  if (!Array.isArray(raw)) return [];
  const out: PayloadCell[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_CELLS) break;
    if (!item || typeof item !== "object") continue;
    const id = (item as PayloadCell).id;
    const m = Number((item as PayloadCell).m);
    if (typeof id !== "string" || !CELL_ID_RE.test(id)) continue;
    if (!Number.isFinite(m) || m < 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, m: Math.min(m, 10000) });
  }
  return out;
}

/** 평탄 배열 [lng0,lat0,...] 검증 — Firestore 중첩 배열 금지라 평탄 형식만 취급 */
function sanitizeFlatPath(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length < 4 || raw.length % 2 !== 0) return [];
  const out: number[] = [];
  for (let i = 0; i + 1 < raw.length && out.length < MAX_TRACE_VERTICES * 2; i += 2) {
    const lng = raw[i];
    const lat = raw[i + 1];
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      return [];
    }
    out.push(lng, lat);
  }
  return out;
}

export const conquestOnRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", region: "asia-northeast3" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as Record<string, unknown>;

    const conquest = data.conquest as Record<string, unknown> | null | undefined;
    if (!conquest || typeof conquest !== "object") return;
    if (conquest.v !== PAYLOAD_VERSION || conquest.z !== CELL_ZOOM) return;

    const userId = typeof data.userId === "string" ? data.userId : "";
    const elapsedSec = Number(data.elapsedSec);
    const distanceMeters = Number(data.distanceMeters);
    const cells = sanitizeCells(conquest.cells);
    const path = sanitizeFlatPath(conquest.path);
    if (!userId || cells.length === 0) return;
    if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return;
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return;

    const pedalSecRaw = conquest.pedalSec;
    const pedalSec =
      typeof pedalSecRaw === "number" && Number.isFinite(pedalSecRaw)
        ? Math.max(0, Math.min(Math.round(pedalSecRaw), Math.round(elapsedSec)))
        : null;
    const tier: "t0" | "t1" = pedalSec == null ? "t0" : "t1";

    const db = getFirestore();
    const summaryRef = db.doc(`conquest/${userId}`);
    const chunkIds = [...new Set(cells.map((c) => chunkIdOfCellId(c.id)))];
    const chunkRefs = chunkIds.map((cid) => summaryRef.collection("chunks").doc(cid));

    await db.runTransaction(async (tx) => {
      const [summarySnap, ...chunkSnaps] = await Promise.all([
        tx.get(summaryRef),
        ...chunkRefs.map((r) => tx.get(r)),
      ]);

      const today = dayKeyKst();
      const summary = summarySnap.data() ?? {};
      const dailyPrev =
        summary.daily &&
        typeof summary.daily === "object" &&
        (summary.daily as { day?: string }).day === today
          ? (summary.daily as { day: string; usedSec?: number; usedMeters?: number })
          : { day: today, usedSec: 0, usedMeters: 0 };
      const usedSec = Math.max(0, Number(dailyPrev.usedSec) || 0);
      const usedMeters = Math.max(0, Number(dailyPrev.usedMeters) || 0);

      /* ---- 예산 계산(§3.2~3.3): 정복의 화폐 = 검증된 페달링 ---- */
      let creditMeters: number;
      if (tier === "t0") {
        const remainingDaily = Math.max(0, T0_DAILY_METERS - usedMeters);
        creditMeters = Math.min(distanceMeters, T0_SPEED_CAP_MPS * elapsedSec, remainingDaily);
      } else {
        // 일일 [usedSec, usedSec+pedalSec) 구간: 0~2h 전액, 2~4h 절반, 이후 0
        const start = usedSec;
        const end = usedSec + (pedalSec ?? 0);
        const fullPart = Math.max(0, Math.min(end, T1_FULL_SEC) - Math.min(start, T1_FULL_SEC));
        const halfPart = Math.max(0, Math.min(end, T1_STOP_SEC) - Math.max(start, T1_FULL_SEC));
        const effSec = fullPart + 0.5 * halfPart;
        creditMeters = Math.min(distanceMeters, T1_SPEED_CAP_MPS * effSec);
      }

      /* ---- 소유 현황 로드 ---- */
      const ownedByChunk = new Map<string, Record<string, unknown>>();
      chunkIds.forEach((cid, i) => {
        ownedByChunk.set(cid, (chunkSnaps[i].data()?.cells as Record<string, unknown>) ?? {});
      });

      /* ---- 경로 순서대로 예산 소진까지 인정 ---- */
      let remaining = creditMeters;
      let newCells = 0;
      let newMeters = 0;
      const newCellsByChunk = new Map<string, string[]>();

      for (const cell of cells) {
        if (remaining <= 0) break;
        const consumed = Math.min(cell.m, remaining);
        remaining -= consumed;
        const cid = chunkIdOfCellId(cell.id);
        const owned = ownedByChunk.get(cid) ?? {};
        if (Object.prototype.hasOwnProperty.call(owned, cell.id)) continue;
        owned[cell.id] = today;
        ownedByChunk.set(cid, owned);
        const list = newCellsByChunk.get(cid) ?? [];
        list.push(cell.id);
        newCellsByChunk.set(cid, list);
        newCells += 1;
        newMeters += consumed;
      }

      const consumedTotal = Math.round(creditMeters - remaining);
      newMeters = Math.round(newMeters);

      /* ---- 쓰기 ---- */
      for (const [cid, ids] of newCellsByChunk) {
        const patch: Record<string, string> = {};
        for (const id of ids) patch[id] = today;
        tx.set(summaryRef.collection("chunks").doc(cid), { cells: patch }, { merge: true });
      }

      // 「내 도로망」 궤적 — 신규 도로가 있을 때만(중복 렌더·문서 낭비 방지). path 는 평탄 배열.
      if (newMeters > 0 && path.length >= 4) {
        tx.set(summaryRef.collection("traces").doc(snap.id), {
          path,
          newMeters,
          day: today,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      tx.set(
        summaryRef,
        {
          totalMeters: FieldValue.increment(newMeters),
          totalCells: FieldValue.increment(newCells),
          daily: {
            day: today,
            usedSec: usedSec + (tier === "t1" ? (pedalSec ?? 0) : 0),
            usedMeters: usedMeters + (tier === "t0" ? consumedTotal : 0),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      tx.update(snap.ref, {
        conquestResult: {
          newMeters,
          newCells,
          creditedMeters: consumedTotal,
          tier,
          day: today,
        },
      });
    });
  },
);

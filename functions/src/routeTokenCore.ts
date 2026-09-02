import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

export const ROUTE_TOKEN_LEDGER = "routeTokenLedger";
export const ROUTE_TOKEN_ECONOMY_PATH = "config/routeTokenEconomy";

/** `firestore.rules` · `firestoreCourses.ts` 와 동기 — 재생성 전까지 비어 있음 */
export const BASIC_INTRO_COURSE_IDS = [] as const;

export type RouteTokenReason =
  | "onboarding"
  | "ride_complete"
  | "ride_complete_intro"
  | "route_generate"
  | "directions_refund"
  | "drop_claim"
  | "admin_adjust";

export type RouteTokenEconomy = {
  generateCostBase: number;
  earnPerKm: number;
  /** 로그인(비익명) 사용자 최초 온보딩 지급 */
  onboardingGrant: number;
  /** Guest(익명 인증) 사용자 최초 온보딩 지급 */
  guestOnboardingGrant: number;
  introRideBonus: number;
  minRideDistanceM: number;
  minRideDurationSec: number;
  dailyEarnCap: number;
  guestDailyEarnCap: number;
};

export const DEFAULT_ROUTE_TOKEN_ECONOMY: RouteTokenEconomy = {
  generateCostBase: 1,
  earnPerKm: 0.15,
  onboardingGrant: 15,
  guestOnboardingGrant: 10,
  introRideBonus: 2,
  minRideDistanceM: 1000,
  minRideDurationSec: 180,
  dailyEarnCap: 10,
  guestDailyEarnCap: 5,
};

function numField(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function kstDayKey(date = new Date()): string {
  const kstMs = date.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

export function resolveIsAnonymousForOnboarding(
  userData: Record<string, unknown> | undefined,
  isAnonymousHint?: boolean,
): boolean {
  const field = userData?.isAnonymous;
  if (typeof field === "boolean") return field;
  if (typeof isAnonymousHint === "boolean") return isAnonymousHint;
  return true;
}

export function resolveOnboardingGrantAmount(
  economy: RouteTokenEconomy,
  isAnonymous: boolean,
): number {
  return Math.max(
    0,
    Math.floor(isAnonymous ? economy.guestOnboardingGrant : economy.onboardingGrant),
  );
}

function ledgerDocId(idempotencyKey: string): string {
  return idempotencyKey.replace(/\//g, "_").slice(0, 1500);
}

export async function loadRouteTokenEconomy(): Promise<RouteTokenEconomy> {
  const snap = await getFirestore().doc(ROUTE_TOKEN_ECONOMY_PATH).get();
  if (!snap.exists) return DEFAULT_ROUTE_TOKEN_ECONOMY;
  const d = snap.data() ?? {};
  return {
    generateCostBase: numField(d.generateCostBase, DEFAULT_ROUTE_TOKEN_ECONOMY.generateCostBase),
    earnPerKm: numField(d.earnPerKm, DEFAULT_ROUTE_TOKEN_ECONOMY.earnPerKm),
    onboardingGrant: numField(d.onboardingGrant, DEFAULT_ROUTE_TOKEN_ECONOMY.onboardingGrant),
    guestOnboardingGrant: numField(
      d.guestOnboardingGrant,
      DEFAULT_ROUTE_TOKEN_ECONOMY.guestOnboardingGrant,
    ),
    introRideBonus: numField(d.introRideBonus, DEFAULT_ROUTE_TOKEN_ECONOMY.introRideBonus),
    minRideDistanceM: numField(d.minRideDistanceM, DEFAULT_ROUTE_TOKEN_ECONOMY.minRideDistanceM),
    minRideDurationSec: numField(d.minRideDurationSec, DEFAULT_ROUTE_TOKEN_ECONOMY.minRideDurationSec),
    dailyEarnCap: numField(d.dailyEarnCap, DEFAULT_ROUTE_TOKEN_ECONOMY.dailyEarnCap),
    guestDailyEarnCap: numField(d.guestDailyEarnCap, DEFAULT_ROUTE_TOKEN_ECONOMY.guestDailyEarnCap),
  };
}

type UserTokenState = {
  balance: number;
  onboardingGranted: boolean;
  earnDayKey: string;
  earnedToday: number;
  isAnonymous: boolean;
};

async function readUserTokenState(
  tx: Transaction,
  userRef: DocumentReference,
): Promise<UserTokenState> {
  const snap = await tx.get(userRef);
  const data = snap.data() ?? {};
  return {
    balance: typeof data.routeTokenBalance === "number" ? data.routeTokenBalance : 0,
    onboardingGranted: data.routeTokenOnboardingGranted === true,
    earnDayKey: typeof data.routeTokenEarnDayKey === "string" ? data.routeTokenEarnDayKey : "",
    earnedToday: typeof data.routeTokenEarnedToday === "number" ? data.routeTokenEarnedToday : 0,
    isAnonymous: data.isAnonymous === true,
  };
}

type LedgerWrite = {
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: RouteTokenReason;
  refType: "ride" | "directions" | "drop" | "admin" | null;
  refId: string | null;
  idempotencyKey: string;
};

function writeLedger(tx: Transaction, db: Firestore, entry: LedgerWrite): void {
  const ledgerRef = db.doc(`${ROUTE_TOKEN_LEDGER}/${ledgerDocId(entry.idempotencyKey)}`);
  tx.set(ledgerRef, {
    userId: entry.userId,
    delta: entry.delta,
    balanceAfter: entry.balanceAfter,
    reason: entry.reason,
    refType: entry.refType,
    refId: entry.refId,
    idempotencyKey: entry.idempotencyKey,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function patchUserBalance(
  tx: Transaction,
  userRef: DocumentReference,
  balanceAfter: number,
  extra?: Record<string, unknown>,
): void {
  tx.set(
    userRef,
    {
      routeTokenBalance: balanceAfter,
      routeTokenBalanceUpdatedAt: FieldValue.serverTimestamp(),
      ...extra,
    },
    { merge: true },
  );
}

/**
 * 신규·기존 사용자 온보딩 지급(멱등). 잔액 반환.
 * @param isAnonymousHint Firestore `isAnonymous` 미기록 시 사용. HTTP 실패 시 Guest(true)로 보수적 처리.
 */
export async function ensureRouteTokenOnboarding(
  userId: string,
  isAnonymousHint?: boolean,
): Promise<number> {
  const db = getFirestore();
  const economy = await loadRouteTokenEconomy();
  const userRef = db.doc(`users/${userId}`);
  const idempotencyKey = `onboarding:${userId}`;

  return db.runTransaction(async (tx) => {
    const ledgerRef = db.doc(`${ROUTE_TOKEN_LEDGER}/${ledgerDocId(idempotencyKey)}`);
    const ledgerSnap = await tx.get(ledgerRef);
    const userSnap = await tx.get(userRef);
    const userData = userSnap.data() ?? {};
    const state = await readUserTokenState(tx, userRef);

    if (ledgerSnap.exists) {
      const after = ledgerSnap.data()?.balanceAfter;
      return typeof after === "number" ? after : state.balance;
    }
    if (state.onboardingGranted) {
      return state.balance;
    }

    const isAnonymous = resolveIsAnonymousForOnboarding(userData, isAnonymousHint);
    const grant = resolveOnboardingGrantAmount(economy, isAnonymous);
    if (grant === 0) {
      patchUserBalance(tx, userRef, state.balance, { routeTokenOnboardingGranted: true });
      return state.balance;
    }

    const balanceAfter = state.balance + grant;
    writeLedger(tx, db, {
      userId,
      delta: grant,
      balanceAfter,
      reason: "onboarding",
      refType: null,
      refId: null,
      idempotencyKey,
    });
    patchUserBalance(tx, userRef, balanceAfter, { routeTokenOnboardingGranted: true });
    return balanceAfter;
  });
}

export async function spendRouteGenerateToken(
  userId: string,
  requestId: string,
  costOverride?: number,
): Promise<number> {
  const db = getFirestore();
  const economy = await loadRouteTokenEconomy();
  const cost = Math.max(0, Math.floor(costOverride ?? economy.generateCostBase));
  if (cost === 0) {
    await ensureRouteTokenOnboarding(userId);
    const snap = await db.doc(`users/${userId}`).get();
    const balance = snap.data()?.routeTokenBalance;
    return typeof balance === "number" ? balance : 0;
  }

  const userRef = db.doc(`users/${userId}`);
  const idempotencyKey = `route_generate:${requestId}`;

  return db.runTransaction(async (tx) => {
    const ledgerRef = db.doc(`${ROUTE_TOKEN_LEDGER}/${ledgerDocId(idempotencyKey)}`);
    const ledgerSnap = await tx.get(ledgerRef);
    let state = await readUserTokenState(tx, userRef);

    if (ledgerSnap.exists) {
      const after = ledgerSnap.data()?.balanceAfter;
      return typeof after === "number" ? after : state.balance;
    }

    if (!state.onboardingGranted) {
      // 트랜잭션 밖 온보딩이 이상적이나, 미지급 시 여기서는 잔액만 본다.
    }

    if (state.balance < cost) {
      throw new HttpsError(
        "resource-exhausted",
        "경로 토큰이 부족합니다. 주행을 완료하면 토큰을 받을 수 있습니다.",
      );
    }

    const balanceAfter = state.balance - cost;
    writeLedger(tx, db, {
      userId,
      delta: -cost,
      balanceAfter,
      reason: "route_generate",
      refType: "directions",
      refId: requestId,
      idempotencyKey,
    });
    patchUserBalance(tx, userRef, balanceAfter);
    return balanceAfter;
  });
}

export async function refundRouteGenerateToken(
  userId: string,
  requestId: string,
  amount: number,
): Promise<void> {
  const refund = Math.max(0, Math.floor(amount));
  if (refund === 0) return;

  const db = getFirestore();
  const userRef = db.doc(`users/${userId}`);
  const idempotencyKey = `directions_refund:${requestId}`;

  await db.runTransaction(async (tx) => {
    const ledgerRef = db.doc(`${ROUTE_TOKEN_LEDGER}/${ledgerDocId(idempotencyKey)}`);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) return;

    const state = await readUserTokenState(tx, userRef);
    const balanceAfter = state.balance + refund;
    writeLedger(tx, db, {
      userId,
      delta: refund,
      balanceAfter,
      reason: "directions_refund",
      refType: "directions",
      refId: requestId,
      idempotencyKey,
    });
    patchUserBalance(tx, userRef, balanceAfter);
  });
}

export async function earnRouteTokenForCompletedRide(input: {
  userId: string;
  rideId: string;
  courseId: string | null;
  distanceMeters: number;
  elapsedSec: number;
  status: string;
  isAnonymous: boolean;
}): Promise<number> {
  if (input.status !== "completed") return 0;

  const economy = await loadRouteTokenEconomy();
  if (input.distanceMeters < economy.minRideDistanceM) return 0;
  if (input.elapsedSec < economy.minRideDurationSec) return 0;

  const distanceKm = input.distanceMeters / 1000;
  let earn = Math.floor(distanceKm * economy.earnPerKm);
  const courseId = input.courseId?.trim() ?? "";
  const isIntro =
    courseId.length > 0 &&
    (BASIC_INTRO_COURSE_IDS as readonly string[]).includes(courseId);
  if (isIntro) {
    earn += Math.max(0, Math.floor(economy.introRideBonus));
  }
  if (earn <= 0) return 0;

  const db = getFirestore();
  const userRef = db.doc(`users/${input.userId}`);
  const idempotencyKey = `ride_complete:${input.rideId}`;

  return db.runTransaction(async (tx) => {
    const ledgerRef = db.doc(`${ROUTE_TOKEN_LEDGER}/${ledgerDocId(idempotencyKey)}`);
    const ledgerSnap = await tx.get(ledgerRef);
    const state = await readUserTokenState(tx, userRef);

    if (ledgerSnap.exists) {
      const after = ledgerSnap.data()?.balanceAfter;
      return typeof after === "number" ? after : state.balance;
    }

    const dayKey = kstDayKey();
    let earnedToday = state.earnDayKey === dayKey ? state.earnedToday : 0;
    const cap = input.isAnonymous ? economy.guestDailyEarnCap : economy.dailyEarnCap;
    const room = Math.max(0, cap - earnedToday);
    const applied = Math.min(earn, room);
    if (applied <= 0) {
      return state.balance;
    }

    const balanceAfter = state.balance + applied;
    writeLedger(tx, db, {
      userId: input.userId,
      delta: applied,
      balanceAfter,
      reason: isIntro ? "ride_complete_intro" : "ride_complete",
      refType: "ride",
      refId: input.rideId,
      idempotencyKey,
    });
    patchUserBalance(tx, userRef, balanceAfter, {
      routeTokenEarnDayKey: dayKey,
      routeTokenEarnedToday: earnedToday + applied,
    });
    return balanceAfter;
  });
}

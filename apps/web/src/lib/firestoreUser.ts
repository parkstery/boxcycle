import { FirebaseError } from "firebase/app";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName } from "./authDisplay";
import { getFirebaseApp } from "./firebase";
import {
  isValidNickname,
  isValidNicknameKeyNormalized,
  normalizeNicknameKey,
} from "./nickname";

export type UserTier = "anonymous" | "registered_free" | "registered_paid" | "admin";

export class NicknameTakenError extends Error {
  readonly code = "nickname-taken" as const;
  constructor(message = "이미 사용 중인 닉네임입니다.") {
    super(message);
    this.name = "NicknameTakenError";
  }
}

function formatClaimFirestoreError(stageKo: string, err: unknown): Error {
  const base = err instanceof Error ? err.message : String(err);
  const hint =
    err instanceof FirebaseError && err.code === "permission-denied"
      ? " (Firestore 규칙 거절: 로그인·프로젝트 ID·firebase deploy --only firestore 배포를 확인하세요)"
      : "";
  return new Error(`${stageKo}: ${base}${hint}`);
}

export async function getUserProfileNickname(uid: string): Promise<string | null> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const n = snap.data().nickname;
  return typeof n === "string" ? n.trim() : null;
}

export async function getUserProfileTier(uid: string): Promise<UserTier | null> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const t = snap.data().tier;
  if (
    t === "anonymous" ||
    t === "registered_free" ||
    t === "registered_paid" ||
    t === "admin"
  ) {
    return t;
  }
  return null;
}

type UserProfilePublicLabel = {
  nickname: string | null;
  displayName: string | null;
};

/** 공개 UI용 — 닉네임 → displayName → uid 앞 8자 */
export function formatUserPublicLabel(uid: string, profile: UserProfilePublicLabel | null): string {
  const n = profile?.nickname?.trim();
  if (n) return n;
  const d = profile?.displayName?.trim();
  if (d) return d;
  return `사용자 ${uid.slice(0, 8)}`;
}

/** 여러 uid의 표시 이름(닉네임 우선)을 병렬 조회 */
export async function getUserPublicLabelsByUid(uids: readonly string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(uids.filter((id) => typeof id === "string" && id.length > 0))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;

  const db = getFirestore(getFirebaseApp());
  await Promise.all(
    uniq.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) {
          map.set(uid, formatUserPublicLabel(uid, null));
          return;
        }
        const data = snap.data();
        map.set(
          uid,
          formatUserPublicLabel(uid, {
            nickname: typeof data.nickname === "string" ? data.nickname : null,
            displayName: typeof data.displayName === "string" ? data.displayName : null,
          }),
        );
      } catch {
        map.set(uid, formatUserPublicLabel(uid, null));
      }
    }),
  );
  return map;
}

function buildUserProfileWrite(user: User, nicknameTrimmed: string, keyLower: string) {
  return {
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    isAnonymous: false,
    tier: "registered_free" as const,
    tierUpdatedAt: serverTimestamp(),
    nickname: nicknameTrimmed,
    nicknameKey: keyLower,
    updatedAt: serverTimestamp(),
  };
}

/** Guest tier — 문서 없거나 tier 미설정 시 1회 merge */
export async function ensureAnonymousUserTier(user: User): Promise<void> {
  if (!user.isAnonymous) return;
  const db = getFirestore(getFirebaseApp());
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const tier = snap.data()?.tier;
  if (typeof tier === "string" && tier.length > 0) return;
  await setDoc(
    userRef,
    {
      displayName: user.displayName ?? getPresenceDisplayName(user),
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      isAnonymous: true,
      tier: "anonymous",
      tierUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * `nicknames/{소문자}` 예약(트랜잭션) 후 서버에서 예약을 재확인(getDocFromServer)하고 `users/{uid}` 를 setDoc 한다.
 * (users 규칙의 get(nicknames/…)는 커밋된 문서를 봐야 하므로 예약·프로필을 단계로 나눈다.)
 */
export async function claimNicknameTransaction(user: User, nickname: string): Promise<void> {
  const trimmed = nickname.trim();
  if (!isValidNickname(trimmed)) {
    throw new Error("닉네임 형식이 올바르지 않습니다.");
  }
  const key = normalizeNicknameKey(trimmed);
  if (!isValidNicknameKeyNormalized(key)) {
    throw new Error("닉네임 형식이 올바르지 않습니다.");
  }

  const db = getFirestore(getFirebaseApp());
  const nickRef = doc(db, "nicknames", key);
  const userRef = doc(db, "users", user.uid);

  let claimedNewInTxn = false;
  try {
    claimedNewInTxn = await runTransaction(db, async (transaction) => {
      const nickSnap = await transaction.get(nickRef);
      if (nickSnap.exists()) {
        const owner = nickSnap.data()?.ownerUid;
        if (owner !== user.uid) {
          throw new NicknameTakenError();
        }
        return false;
      }
      transaction.set(nickRef, {
        ownerUid: user.uid,
      });
      return true;
    });
  } catch (e) {
    if (e instanceof NicknameTakenError) throw e;
    throw formatClaimFirestoreError("[예약]", e);
  }

  let nickVerified = false;
  try {
    const nickSnap = await getDocFromServer(nickRef);
    nickVerified = nickSnap.exists() && nickSnap.data()?.ownerUid === user.uid;
  } catch (e) {
    throw formatClaimFirestoreError("[예약 확인]", e);
  }
  if (!nickVerified) {
    if (claimedNewInTxn) {
      await deleteDoc(nickRef).catch(() => {});
    }
    throw new Error(
      "[예약 확인] 서버에 닉네임 예약이 보이지 않습니다. Firebase 프로젝트 ID·규칙 배포를 확인해 주세요.",
    );
  }

  try {
    await setDoc(userRef, buildUserProfileWrite(user, trimmed, key), { merge: true });
  } catch (e) {
    if (claimedNewInTxn) {
      await deleteDoc(nickRef).catch(() => {});
    }
    if (e instanceof NicknameTakenError) throw e;
    throw formatClaimFirestoreError("[프로필]", e);
  }
}

export async function syncUserProfileToFirestore(
  user: User,
  options?: { nickname?: string },
): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  const nickname = options?.nickname;
  const key =
    nickname != null && nickname !== "" ? normalizeNicknameKey(nickname) : null;
  await setDoc(
    doc(db, "users", user.uid),
    {
      displayName: user.displayName ?? (user.isAnonymous ? getPresenceDisplayName(user) : null),
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      isAnonymous: user.isAnonymous,
      ...(nickname != null && nickname !== ""
        ? { nickname: nickname.trim(), nicknameKey: key }
        : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

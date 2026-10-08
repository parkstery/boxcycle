import { FirebaseError } from "firebase/app";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName } from "../authDisplay";
import { getFirebaseFirestore } from "../../firebase/app";
import { noteVisibilityOneShot } from "../../debug/visibilityReadMeters";
import {
  isValidNickname,
  isValidNicknameKeyNormalized,
  normalizeNicknameKey,
} from "../nickname";
import { nicknameOrNull, riderDisplayName } from "../riderName";

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
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const n = snap.data().nickname;
  return typeof n === "string" ? n.trim() : null;
}

export async function getUserProfileTier(uid: string): Promise<UserTier | null> {
  const db = getFirebaseFirestore();
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

/**
 * 공개 UI용 — 닉네임 → (닉네임 규칙을 통과한) displayName → 「라이더-xxxx」.
 * displayName 에는 가입 직전 Google 실명이 남아 있을 수 있어 그대로 쓰지 않는다(riderName).
 */
export function formatUserPublicLabel(uid: string, profile: UserProfilePublicLabel | null): string {
  return riderDisplayName({
    uid,
    isGuest: false,
    nickname: nicknameOrNull(profile?.nickname) ?? profile?.displayName,
  });
}

/** 여러 uid의 표시 이름(닉네임 우선)을 병렬 조회 */
export async function getUserPublicLabelsByUid(uids: readonly string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(uids.filter((id) => typeof id === "string" && id.length > 0))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;

  noteVisibilityOneShot("catalogLabels", uniq.length);
  const db = getFirebaseFirestore();
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
    // 닉네임을 쓴다 — 이 시점 user.displayName 은 Google 실명이고, users/{uid} 는 로그인한 누구나 읽는다
    displayName: nicknameTrimmed,
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
  const db = getFirebaseFirestore();
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

  const db = getFirebaseFirestore();
  const nickRef = doc(db, "nicknames", key);
  const userRef = doc(db, "users", user.uid);

  let claimedNewInTxn: boolean;
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

  let nickVerified: boolean;
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
    /*
     * 재로그인(이미 이 닉네임으로 가입) — 이름만 맞춘다. 가입용 쓰기(buildUserProfileWrite)는 tier·
     * tierUpdatedAt 을 다시 쓰는데, 규칙은 닉네임이 바뀔 때만 tier 변경을 허용하므로 **회원이 다시
     * 로그인할 때마다 PERMISSION_DENIED** 였다(2026-10-09 에뮬레이터 재현). 로그인 동기화가 「오류」로
     * 끝나 닉네임 확인·이름 맞추기가 돌지 않았다. 유료 회원을 무료로 되돌릴 위험도 함께 없앤다.
     */
    const current = (await getDocFromServer(userRef)).data();
    const alreadyMine = current?.nickname === trimmed && current?.nicknameKey === key;
    await setDoc(
      userRef,
      alreadyMine
        ? { displayName: trimmed, updatedAt: serverTimestamp() }
        : buildUserProfileWrite(user, trimmed, key),
      { merge: true },
    );
  } catch (e) {
    if (claimedNewInTxn) {
      await deleteDoc(nickRef).catch(() => {});
    }
    if (e instanceof NicknameTakenError) throw e;
    throw formatClaimFirestoreError("[프로필]", e);
  }
}

/**
 * 가입 후 닉네임 변경(프로필 수정). 가입용 `claimNicknameTransaction` 은 tier 를 registered_free 로
 * 덮어써 유료 사용자를 강등시키므로 쓰지 않는다 — 여기서는 nickname·nicknameKey·displayName 만 바꾼다.
 * 순서: 새 이름 예약 → 서버 재확인 → users 갱신 → 옛 예약 해제(실패해도 새 이름은 유지).
 */
export async function changeNicknameTransaction(user: User, nickname: string): Promise<void> {
  if (user.isAnonymous) throw new Error("게스트는 닉네임을 바꿀 수 없습니다.");
  const trimmed = nickname.trim();
  if (!isValidNickname(trimmed)) {
    throw new Error("닉네임 형식이 올바르지 않습니다.");
  }
  const key = normalizeNicknameKey(trimmed);
  if (!isValidNicknameKeyNormalized(key)) {
    throw new Error("닉네임 형식이 올바르지 않습니다.");
  }

  const db = getFirebaseFirestore();
  const nickRef = doc(db, "nicknames", key);
  const userRef = doc(db, "users", user.uid);

  const userSnap = await getDocFromServer(userRef).catch((e: unknown) => {
    throw formatClaimFirestoreError("[프로필 읽기]", e);
  });
  const oldKeyRaw = userSnap.exists() ? userSnap.data()?.nicknameKey : null;
  const oldKey = typeof oldKeyRaw === "string" && oldKeyRaw.length > 0 ? oldKeyRaw : null;

  let claimedNewInTxn: boolean;
  try {
    claimedNewInTxn = await runTransaction(db, async (transaction) => {
      const nickSnap = await transaction.get(nickRef);
      if (nickSnap.exists()) {
        if (nickSnap.data()?.ownerUid !== user.uid) throw new NicknameTakenError();
        return false;
      }
      transaction.set(nickRef, { ownerUid: user.uid });
      return true;
    });
  } catch (e) {
    if (e instanceof NicknameTakenError) throw e;
    throw formatClaimFirestoreError("[예약]", e);
  }

  try {
    const nickSnap = await getDocFromServer(nickRef);
    if (!(nickSnap.exists() && nickSnap.data()?.ownerUid === user.uid)) {
      throw new Error("[예약 확인] 서버에 닉네임 예약이 보이지 않습니다.");
    }
    await setDoc(
      userRef,
      { nickname: trimmed, nicknameKey: key, displayName: trimmed, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    if (claimedNewInTxn) await deleteDoc(nickRef).catch(() => {});
    throw formatClaimFirestoreError("[프로필]", e);
  }

  if (oldKey && oldKey !== key) {
    // 옛 이름을 놓아 준다. 실패하면 예약만 남을 뿐 새 이름은 정상이다.
    await deleteDoc(doc(db, "nicknames", oldKey)).catch(() => {});
  }
}

export async function syncUserProfileToFirestore(
  user: User,
  options?: { nickname?: string },
): Promise<void> {
  const db = getFirebaseFirestore();
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

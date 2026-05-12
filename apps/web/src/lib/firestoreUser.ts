import {
  deleteDoc,
  doc,
  getDoc,
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

export class NicknameTakenError extends Error {
  readonly code = "nickname-taken" as const;
  constructor(message = "이미 사용 중인 닉네임입니다.") {
    super(message);
    this.name = "NicknameTakenError";
  }
}

export async function getUserProfileNickname(uid: string): Promise<string | null> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const n = snap.data().nickname;
  return typeof n === "string" ? n.trim() : null;
}

function buildUserProfileWrite(user: User, nicknameTrimmed: string, keyLower: string) {
  return {
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    isAnonymous: user.isAnonymous,
    nickname: nicknameTrimmed,
    nicknameKey: keyLower,
    updatedAt: serverTimestamp(),
  };
}

/**
 * `nicknames/{소문자}` 예약 후 `users/{uid}` 프로필을 반영한다.
 * (한 트랜잭션에 묶으면 users 규칙의 get(nicknames/…)가 아직 커밋되지 않은 예약을
 * 못 보고 permission-denied 가 나는 경우가 있어, 예약 커밋 뒤 setDoc 으로 나눈다.)
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

  const claimedNewInTxn = await runTransaction(db, async (transaction) => {
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

  try {
    await setDoc(userRef, buildUserProfileWrite(user, trimmed, key), { merge: true });
  } catch (err) {
    if (claimedNewInTxn) {
      await deleteDoc(nickRef).catch(() => {});
    }
    throw err;
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

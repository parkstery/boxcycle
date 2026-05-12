import {
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
 * `nicknames/{소문자}` 예약 + `users/{uid}` 프로필을 한 트랜잭션으로 반영한다.
 * 이미 같은 uid 가 예약한 경우(재시도·수리)는 사용자 문서만 갱신한다.
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

  await runTransaction(db, async (transaction) => {
    const nickSnap = await transaction.get(nickRef);
    if (nickSnap.exists()) {
      const owner = nickSnap.data()?.ownerUid;
      if (owner !== user.uid) {
        throw new NicknameTakenError();
      }
    } else {
      // nicknames 규칙은 필드 키만 검사(hasOnly). serverTimestamp()는 규칙 평가 시
      // request.resource 키 집합과 맞지 않아 permission-denied 가 나는 경우가 있어 ownerUid 만 저장한다.
      transaction.set(nickRef, {
        ownerUid: user.uid,
      });
    }
    transaction.set(userRef, buildUserProfileWrite(user, trimmed, key), { merge: true });
  });
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

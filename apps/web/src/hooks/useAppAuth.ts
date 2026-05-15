import type { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  reload,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { startTransition, useCallback, useEffect, useState } from "react";
import { POST_SIGNOUT_MAP_SESSION_KEY, readPostSignoutMapSessionFlag } from "../lib/appSessionKeys";
import { isBenignAuthPopupCancel } from "../lib/firebaseAuthPopup";
import { getFirebaseAuth } from "../lib/firebase";
import {
  claimNicknameTransaction,
  getUserProfileNickname,
  NicknameTakenError,
} from "../lib/firestoreUser";
import { isValidNickname } from "../lib/nickname";

export type FsSyncState =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "awaiting_nickname" }
  | { state: "ok" }
  | { state: "error"; message: string };

/**
 * Firebase Auth, Firestore 프로필 닉네임 동기(fsSync), 로그인 시트·게스트/Google 핸들러.
 * 로그아웃 전 로비/주행 정리는 호출 측에서 한 뒤 `completeFirebaseSignOutKeepMap`만 호출한다.
 */
export function useAppAuth(configured: boolean) {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fsSync, setFsSync] = useState<FsSyncState>({ state: "idle" });
  const [authInitialized, setAuthInitialized] = useState(false);
  const [postSignoutMapSession, setPostSignoutMapSession] = useState(readPostSignoutMapSessionFlag);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [authPickCardHidden, setAuthPickCardHidden] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    try {
      sessionStorage.removeItem(POST_SIGNOUT_MAP_SESSION_KEY);
    } catch {
      /* noop */
    }
    setPostSignoutMapSession(false);
    setAuthSheetOpen(false);
  }, [user]);

  useEffect(() => {
    if (!configured) {
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      startTransition(() => setAuthInitialized(true));
      setUser(nextUser);
    });
    return () => unsub();
  }, [configured]);

  useEffect(() => {
    if (!configured || !user) {
      startTransition(() => setFsSync({ state: "idle" }));
      return;
    }
    if (user.isAnonymous) {
      startTransition(() => setFsSync({ state: "ok" }));
      return;
    }
    let cancelled = false;
    startTransition(() => setFsSync({ state: "syncing" }));
    void (async () => {
      try {
        const stored = await getUserProfileNickname(user.uid);
        if (cancelled) return;
        if (stored == null || !isValidNickname(stored)) {
          startTransition(() => setFsSync({ state: "awaiting_nickname" }));
          return;
        }
        await claimNicknameTransaction(user, stored);
        if (cancelled) return;
        startTransition(() => setFsSync({ state: "ok" }));
      } catch (e: unknown) {
        if (e instanceof NicknameTakenError) {
          if (!cancelled) startTransition(() => setFsSync({ state: "awaiting_nickname" }));
          if (!cancelled) setError(`${e.message} 다른 계정이 먼저 사용 중입니다. 닉네임을 바꿔 주세요.`);
        } else if (
          typeof e === "object" &&
          e !== null &&
          (e as { code?: string }).code === "aborted"
        ) {
          if (!cancelled) startTransition(() => setFsSync({ state: "awaiting_nickname" }));
          if (!cancelled) {
            setError("다른 분이 먼저 같은 닉네임을 선택했습니다. 닉네임을 바꿔 주세요.");
          }
        } else {
          const message = e instanceof Error ? e.message : String(e);
          if (!cancelled) startTransition(() => setFsSync({ state: "error", message }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, user]);

  const openSignedOutAuthSheet = useCallback(() => {
    setBusy(false);
    setAuthSheetOpen(true);
  }, []);

  const handleGuestStart = useCallback(async () => {
    if (!postSignoutMapSession) {
      setAuthSheetOpen(false);
    }
    setAuthPickCardHidden(true);
    setError(null);
    setBusy(true);
    try {
      await signInAnonymously(getFirebaseAuth());
    } catch (e: unknown) {
      setAuthPickCardHidden(false);
      if (postSignoutMapSession) setAuthSheetOpen(true);
      const message = e instanceof Error ? e.message : String(e);
      setError(`게스트(익명) 로그인 실패: ${message}`);
    } finally {
      setBusy(false);
    }
  }, [postSignoutMapSession]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!postSignoutMapSession) {
      setAuthSheetOpen(false);
    }
    setAuthPickCardHidden(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const current = auth.currentUser;
      if (!current) {
        await signInWithPopup(auth, provider);
        return;
      }
      if (current.isAnonymous) {
        try {
          await linkWithPopup(current, provider);
        } catch (inner: unknown) {
          const ie = inner as { code?: string };
          if (
            ie.code === "auth/credential-already-in-use" ||
            ie.code === "auth/account-exists-with-different-credential"
          ) {
            const cred = GoogleAuthProvider.credentialFromError(inner as FirebaseError);
            if (cred) {
              await signInWithCredential(auth, cred);
            } else {
              await signInWithPopup(auth, provider);
            }
          } else {
            throw inner;
          }
        }
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: unknown) {
      if (isBenignAuthPopupCancel(e)) {
        setAuthPickCardHidden(false);
        if (postSignoutMapSession) setAuthSheetOpen(true);
        return;
      }
      setAuthPickCardHidden(false);
      if (postSignoutMapSession) setAuthSheetOpen(true);
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/account-exists-with-different-credential") {
        setError(
          "이 Google 계정은 다른 로그인 방식과 연결되어 있습니다. 해당 방식으로 로그인하거나 Firebase 콘솔에서 계정을 확인해 주세요.",
        );
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [postSignoutMapSession]);

  const handleCompleteNickname = useCallback(
    async (nickname: string) => {
      if (!user || user.isAnonymous) return;
      if (!isValidNickname(nickname)) return;
      setError(null);
      setBusy(true);
      try {
        await claimNicknameTransaction(user, nickname);
        await updateProfile(user, { displayName: nickname });
        await reload(user);
        startTransition(() => setFsSync({ state: "ok" }));
      } catch (e: unknown) {
        if (e instanceof NicknameTakenError) {
          setError(e.message);
        } else if (
          typeof e === "object" &&
          e !== null &&
          (e as { code?: string }).code === "aborted"
        ) {
          setError("다른 분이 먼저 같은 닉네임을 선택했습니다. 다른 닉네임으로 다시 시도해 주세요.");
        } else {
          const message = e instanceof Error ? e.message : String(e);
          setError(`닉네임 저장 실패: ${message}`);
        }
      } finally {
        setBusy(false);
      }
    },
    [user],
  );

  /** 세션 플래그 + `signOut`만(실패 시 플래그 롤백). 로비 정리 등은 호출 전에 끝낸다. */
  const completeFirebaseSignOutKeepMap = useCallback(async () => {
    setAuthSheetOpen(false);
    try {
      sessionStorage.setItem(POST_SIGNOUT_MAP_SESSION_KEY, "1");
    } catch {
      /* noop */
    }
    setPostSignoutMapSession(true);
    try {
      await signOut(getFirebaseAuth());
    } catch (signOutErr) {
      try {
        sessionStorage.removeItem(POST_SIGNOUT_MAP_SESSION_KEY);
      } catch {
        /* noop */
      }
      setPostSignoutMapSession(false);
      throw signOutErr;
    }
  }, []);

  return {
    user,
    busy,
    error,
    fsSync,
    authInitialized,
    postSignoutMapSession,
    authSheetOpen,
    setAuthSheetOpen,
    authPickCardHidden,
    setAuthPickCardHidden,
    openSignedOutAuthSheet,
    handleGuestStart,
    handleGoogleSignIn,
    handleCompleteNickname,
    completeFirebaseSignOutKeepMap,
    setError,
    setBusy,
  };
}

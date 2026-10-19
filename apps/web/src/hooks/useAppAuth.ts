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
import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  clearAppUseEnded,
  clearUserSignedOutSessionFlag,
  prepareStartScreen,
  readAppUseEnded,
  readUserSignedOutSessionFlag,
  setAppUseEnded,
  setGuestEntryAccepted,
  setUserSignedOutSessionFlag,
} from "../lib/storage/appSessionKeys";
import { isBenignAuthPopupCancel } from "../lib/identity/firebaseAuthPopup";
import { ensureAuthPersistence, getFirebaseAuth } from "../lib/firebase/app";
import {
  INITIAL_AUTH_EXPOSURE,
  reduceAuthExposure,
  verifyRestoredAuthUser,
  type AuthExpiryKind,
  type AuthExposure,
} from "../lib/identity/authRestore";
import { clearUidLocalCache } from "../lib/identity/uidLocalCache";
import { decideGuestStart } from "../lib/identity/guestResume";
import { postGuestActivity } from "../lib/identity/repo/guestLifecycleApi";
import {
  clearLastVerifiedGuestUid,
  readLastVerifiedGuestUid,
  rememberVerifiedGuestUid,
} from "../lib/identity/lastVerifiedGuest";
import { postGuestLink } from "../lib/identity/repo/guestLifecycleApi";
import { runGuestGoogleLink } from "../lib/identity/guestGoogleLink";
import {
  claimNicknameTransaction,
  ensureAnonymousUserTier,
  changeNicknameTransaction,
  getUserProfileNickname,
  NicknameTakenError,
} from "../lib/identity/repo/firestoreUser";
import { isValidNickname } from "../lib/identity/nickname";

export type FsSyncState =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "awaiting_nickname" }
  | { state: "ok" }
  | { state: "error"; message: string };

/**
 * Firebase Auth, Firestore 프로필 닉네임 동기(fsSync), 명시적 Guest 시작·Google·이용 종료.
 * 이용 종료는 `endAppUse`다. Firebase 세션은 남고 앱 사용자만 가려진다.
 * `completeFirebaseSignOut`은 계정 전환·탈퇴처럼 세션을 끊을 때만 쓴다.
 * Google 인증이 서버 확인까지 성공하면 종료 표시를 지우고 그 사용자를 연다. 취소·실패·차단·네트워크는 표시를 유지한다.
 */
export function useAppAuth(configured: boolean) {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fsSync, setFsSync] = useState<FsSyncState>({ state: "idle" });
  /** 게스트→Google 연결 완료 횟수 — 닉네임 확인을 다시 돌리는 신호(아래 effect) */
  const [authLinkRev, setAuthLinkRev] = useState(0);
  /** displayName 은 User 객체를 제자리에서 바꾸므로 화면 갱신용으로 올린다 */
  const [, setProfileRev] = useState(0);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authSigningIn, setAuthSigningIn] = useState(false);
  const [userSignedOut, setUserSignedOut] = useState(readUserSignedOutSessionFlag);
  const [appUseEnded, setAppUseEndedState] = useState(readAppUseEnded);
  const [authExposure, setAuthExposure] = useState<AuthExposure>(INITIAL_AUTH_EXPOSURE);
  const anonymousFlightRef = useRef<Promise<void> | null>(null);
  const verifyGenRef = useRef(0);
  const persistenceSettledRef = useRef(false);
  const inflightUidRef = useRef<string | null>(null);
  const explicitSignOutRef = useRef(false);
  const exposureRef = useRef(authExposure);
  const expirySignOutRef = useRef<AuthExpiryKind | null>(null);
  const applyVerifiedUserRef = useRef<(nextUser: User, gen: number) => Promise<void>>(async () => {});

  const commitExposure = (event: Parameters<typeof reduceAuthExposure>[1]) => {
    const next = reduceAuthExposure(exposureRef.current, event);
    exposureRef.current = next;
    setAuthExposure(next);
    return next;
  };

  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (user) {
      setUserSignedOut(false);
    }
  }

  useLayoutEffect(() => {
    if (!user) return;
    clearUserSignedOutSessionFlag();
  }, [user]);

  const needsSignedOutUi =
    configured && authInitialized && !user && readUserSignedOutSessionFlag();
  const [prevNeedsSignedOutUi, setPrevNeedsSignedOutUi] = useState(needsSignedOutUi);
  if (needsSignedOutUi !== prevNeedsSignedOutUi) {
    setPrevNeedsSignedOutUi(needsSignedOutUi);
    if (needsSignedOutUi) {
      setUserSignedOut(true);
    }
  }

  useEffect(() => {
    if (!configured) {
      return;
    }
    const auth = getFirebaseAuth();
    let unsub = () => {};
    let cancelled = false;
    persistenceSettledRef.current = false;
    const finishInflight = (uid: string) => {
      if (inflightUidRef.current === uid) inflightUidRef.current = null;
    };
    const applyVerifiedUser = async (nextUser: User, gen: number) => {
      const result = await verifyRestoredAuthUser(nextUser);
      if (cancelled || verifyGenRef.current !== gen) return;
      finishInflight(nextUser.uid);
      if (result.kind === "ready") {
        if (nextUser.isAnonymous) rememberVerifiedGuestUid(nextUser.uid);
        else clearLastVerifiedGuestUid();
        commitExposure({ type: "verified", uid: nextUser.uid });
        startTransition(() => {
          setUser(readAppUseEnded() ? null : nextUser);
          setAuthInitialized(true);
        });
        return;
      }
      if (result.kind === "expired") {
        const expiryKind: AuthExpiryKind = nextUser.isAnonymous ? "guest-expired" : "account-unavailable";
        if (result.clearCache && nextUser.isAnonymous) clearUidLocalCache(nextUser.uid);
        prepareStartScreen(expiryKind);
        expirySignOutRef.current = expiryKind;
        commitExposure({ type: "expired", uid: nextUser.uid, kind: expiryKind });
        try {
          await signOut(auth);
        } catch {
          expirySignOutRef.current = null;
        }
        if (cancelled || (verifyGenRef.current !== gen && expirySignOutRef.current == null)) return;
        startTransition(() => {
          setUser(null);
          setAuthInitialized(true);
        });
        return;
      }
      commitExposure({ type: "offline", uid: nextUser.uid });
      startTransition(() => {
        setUser(null);
        setAuthInitialized(true);
      });
    };
    applyVerifiedUserRef.current = applyVerifiedUser;
    void (async () => {
      try {
        await ensureAuthPersistence();
      } catch {
        /* 지속성 확정 실패는 빈 세션으로 보지 않는다 */
      }
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, (nextUser) => {
        if (!nextUser) {
          if (inflightUidRef.current && !explicitSignOutRef.current) {
            return;
          }
          verifyGenRef.current += 1;
          inflightUidRef.current = null;
          if (!persistenceSettledRef.current) {
            commitExposure({ type: "early-null" });
            return;
          }
          const expiryKind = expirySignOutRef.current;
          expirySignOutRef.current = null;
          explicitSignOutRef.current = false;
          if (expiryKind) commitExposure({ type: "expiry-sign-out", kind: expiryKind });
          else commitExposure({ type: "cleared" });
          startTransition(() => {
            setAuthInitialized(true);
            setUser(null);
          });
          return;
        }
        if (inflightUidRef.current === nextUser.uid) return;
        const gen = ++verifyGenRef.current;
        inflightUidRef.current = nextUser.uid;
        explicitSignOutRef.current = false;
        commitExposure({ type: "candidate", uid: nextUser.uid });
        startTransition(() => {
          setAuthInitialized(false);
          setUser(null);
        });
        void applyVerifiedUser(nextUser, gen);
      });
      let restoreWaitFailed = false;
      try {
        await auth.authStateReady();
      } catch {
        restoreWaitFailed = true;
      }
      if (cancelled) return;
      persistenceSettledRef.current = true;
      if (!auth.currentUser && exposureRef.current.phase === "booting") {
        const signedOut = readUserSignedOutSessionFlag();
        const lastGuest = readLastVerifiedGuestUid();
        if (restoreWaitFailed) {
          commitExposure({ type: "restore-wait-failed" });
        } else if (!signedOut && lastGuest) {
          prepareStartScreen("guest-expired");
          commitExposure({ type: "guest-restore-unconfirmed" });
        } else {
          commitExposure({ type: "persistence-empty" });
        }
        startTransition(() => {
          setAuthInitialized(true);
          setUser(null);
        });
      }
    })();
    return () => {
      cancelled = true;
      verifyGenRef.current += 1;
      inflightUidRef.current = null;
      unsub();
    };
  }, [configured]);

  useEffect(() => {
    // authLinkRev: 게스트→Google 연결은 같은 User 객체를 제자리에서 바꿔 onAuthStateChanged 가 울리지 않는다.
    // 이 값(의존 배열)이 없으면 연결 직후 닉네임 확인이 돌지 않아 닉네임 없는 회원이 생긴다(2026-10-09).
    if (!configured || !user) {
      startTransition(() => setFsSync({ state: "idle" }));
      return;
    }
    if (user.isAnonymous) {
      let cancelled = false;
      void (async () => {
        try {
          await ensureAnonymousUserTier(user);
        } catch {
          /* tier 미설정이어도 게스트 주행은 허용 — Rules·CF 재시도 */
        }
        if (!cancelled) startTransition(() => setFsSync({ state: "ok" }));
      })();
      return () => {
        cancelled = true;
      };
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
        // 화면·presence 이름은 Auth displayName 을 읽는다(riderName). 예전 계정·게스트 연결 계정은
        // 여기에 Google 실명이 남아 있을 수 있다 — 저장된 닉네임으로 맞춘다(2026-10-09).
        if (user.displayName !== stored) {
          await updateProfile(user, { displayName: stored }).catch(() => {});
          if (cancelled) return;
          setProfileRev((n) => n + 1);
        }
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
  }, [configured, user, authLinkRev]);

  const beginAuthenticatedSession = useCallback(async () => {
    setGuestEntryAccepted();
    clearUserSignedOutSessionFlag();
    setUserSignedOut(false);
    setError(null);
    setBusy(true);
    setAuthSigningIn(true);
    const flight = anonymousFlightRef.current ?? (async () => {
      const auth = getFirebaseAuth();
      const current = auth.currentUser;
      let verifyKind: "ready" | "expired" | "offline" | "none" = "none";
      let code: string | null = null;
      let activity: "ok" | "stop" | "retry" | "none" = "none";
      if (current?.isAnonymous) {
        const result = await verifyRestoredAuthUser(current);
        verifyKind = result.kind;
        if (result.kind !== "ready") code = result.code;
        if (result.kind === "ready") {
          try {
            activity = await postGuestActivity(current);
          } catch {
            activity = "retry";
          }
        }
      }
      const decision = decideGuestStart({
        hasAnonymousSession: Boolean(current?.isAnonymous),
        hasGoogleSession: Boolean(current && !current.isAnonymous),
        verifyKind,
        code,
        activity,
      });
      if (decision === "reuse" && current) {
        clearAppUseEnded();
        setAppUseEndedState(false);
        rememberVerifiedGuestUid(current.uid);
        setUser(current);
        return;
      }
      if (decision === "hold-blocked") {
        setError("계정 정리가 끝난 뒤에 다시 시도해 주세요.");
        return;
      }
      if (decision === "hold-offline") {
        setError("연결을 확인하지 못했습니다.");
        return;
      }
      if (decision === "switch-from-google") {
        explicitSignOutRef.current = true;
        await signOut(auth);
        explicitSignOutRef.current = false;
      }
      if (decision === "create" && current?.isAnonymous && code === "auth/user-not-found") {
        clearUidLocalCache(current.uid);
        clearLastVerifiedGuestUid();
        explicitSignOutRef.current = true;
        try {
          await signOut(auth);
        } catch {
          /* 이미 없는 계정 */
        }
        explicitSignOutRef.current = false;
      }
      clearAppUseEnded();
      setAppUseEndedState(false);
      await signInAnonymously(auth);
    })();
    anonymousFlightRef.current = flight;
    try {
      await flight;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`익명 로그인 실패: ${message}`);
      throw e;
    } finally {
      if (anonymousFlightRef.current === flight) anonymousFlightRef.current = null;
      setBusy(false);
      setAuthSigningIn(false);
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setGuestEntryAccepted();
    clearUserSignedOutSessionFlag();
    setUserSignedOut(false);
    setError(null);
    setBusy(true);
    /** 팝업이 이미 끝난 뒤의 서버 확인. 성공만 종료 표시를 지운다. 연결 실패는 표시와 숨김을 유지한다. */
    const revealVerifiedGoogleUser = async (): Promise<boolean> => {
      const signedIn = getFirebaseAuth().currentUser;
      if (!signedIn || signedIn.isAnonymous) return false;
      const result = await verifyRestoredAuthUser(signedIn);
      if (result.kind !== "ready") {
        setError(
          result.kind === "offline"
            ? "연결을 확인하지 못했습니다."
            : "이 계정은 더 이상 사용할 수 없습니다.",
        );
        return false;
      }
      clearAppUseEnded();
      setAppUseEndedState(false);
      clearLastVerifiedGuestUid();
      setUser(signedIn);
      return true;
    };
    try {
      const auth = getFirebaseAuth();
      const currentSession = auth.currentUser;
      if (currentSession && !currentSession.isAnonymous) {
        await revealVerifiedGoogleUser();
        return;
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const current = auth.currentUser;
      if (!current) {
        await signInWithPopup(auth, provider);
        await revealVerifiedGoogleUser();
        return;
      }
      if (current.isAnonymous) {
        const outcome = await runGuestGoogleLink({
          beginLease: () => postGuestLink(current, "begin"),
          openLinkPopup: () => linkWithPopup(current, provider).then(() => undefined),
          completeLease: async (token) => {
            await postGuestLink(current, "complete", token);
          },
          cancelLease: async (token) => {
            await postGuestLink(current, "cancel", token);
          },
          signIntoExistingAccount: async (inner) => {
            const cred = GoogleAuthProvider.credentialFromError(inner as FirebaseError);
            if (cred) await signInWithCredential(auth, cred);
            else await signInWithPopup(auth, provider);
          },
          isExistingAccountError: (inner) => {
            const code = (inner as { code?: string }).code;
            return code === "auth/credential-already-in-use" || code === "auth/account-exists-with-different-credential";
          },
          isPopupCancel: isBenignAuthPopupCancel,
        });
        if (outcome === "blocked" || outcome === "blocked-linked") {
          setError("정리 중인 게스트는 Google에 연결할 수 없습니다.");
          if (outcome === "blocked-linked") setAuthLinkRev((n) => n + 1);
          return;
        }
        if (outcome === "cancelled") return;
        const revealed = await revealVerifiedGoogleUser();
        if (outcome === "linked" && revealed) setAuthLinkRev((n) => n + 1);
      } else {
        await signInWithPopup(auth, provider);
        await revealVerifiedGoogleUser();
      }
    } catch (e: unknown) {
      if (isBenignAuthPopupCancel(e)) {
        return;
      }
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/account-exists-with-different-credential") {
        setError(
          "이 Google 계정은 다른 로그인 방식과 연결되어 있습니다. 해당 방식으로 로그인하거나 Firebase 콘솔에서 계정을 확인해 주세요.",
        );
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  }, []);

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

  /** 주행 시작 직전 마지막 확인 — 닉네임 없는 회원에게 닉네임 카드를 띄운다(memberNeedsNickname) */
  const requestNicknameEntry = useCallback(() => {
    startTransition(() => setFsSync({ state: "awaiting_nickname" }));
  }, []);


  /**
   * 프로필 수정 — 닉네임 변경. 실패는 throw(시트가 바로 아래에 보여 준다).
   * NicknameTakenError 는 그대로 전달.
   */
  const handleChangeNickname = useCallback(
    async (nickname: string) => {
      if (!user || user.isAnonymous) throw new Error("게스트는 닉네임을 바꿀 수 없습니다.");
      await changeNicknameTransaction(user, nickname);
      await updateProfile(user, { displayName: nickname.trim() });
      await reload(user);
      setProfileRev((n) => n + 1);
    },
    [user],
  );

  /** 이용 종료. Firebase 세션과 브라우저 지속성은 남기고 앱 사용자만 가린다. */
  const endAppUse = useCallback(() => {
    setAppUseEnded();
    setAppUseEndedState(true);
    clearUserSignedOutSessionFlag();
    setUserSignedOut(false);
    setUser(null);
  }, []);

  /** 계정 전환·탈퇴처럼 세션 자체가 필요 없을 때만. 기본 메뉴는 `endAppUse`. */
  const completeFirebaseSignOut = useCallback(async () => {
    explicitSignOutRef.current = true;
    setUserSignedOutSessionFlag();
    setUserSignedOut(true);
    try {
      await signOut(getFirebaseAuth());
    } catch (signOutErr) {
      explicitSignOutRef.current = false;
      clearUserSignedOutSessionFlag();
      setUserSignedOut(false);
      throw signOutErr;
    }
  }, []);

  const retryAuthRestore = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) return;
    const gen = ++verifyGenRef.current;
    inflightUidRef.current = current.uid;
    explicitSignOutRef.current = false;
    commitExposure({ type: "candidate", uid: current.uid });
    setAuthInitialized(false);
    setUser(null);
    await applyVerifiedUserRef.current(current, gen);
  }, []);

  return {
    user,
    busy,
    error,
    fsSync,
    authInitialized,
    authSigningIn,
    userSignedOut,
    appUseEnded,
    authRestore: authExposure.phase,
    authOffline: authExposure.phase === "offline",
    authExpiryKind: authExposure.expiryKind,
    beginAuthenticatedSession,
    endAppUse,
    handleGoogleSignIn,
    retryAuthRestore,
    requestNicknameEntry,
    handleCompleteNickname,
    handleChangeNickname,
    completeFirebaseSignOut,
    setError,
    setBusy,
  };
}

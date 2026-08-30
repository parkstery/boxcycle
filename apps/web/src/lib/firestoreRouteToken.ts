import type { User } from "firebase/auth";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";
import { resolveFunctionsHttpUrl } from "./functionsEmulatorUrl";
import { setSubscribedRouteTokenBalance } from "./routeTokenSpendBridge";

export function subscribeRouteTokenBalance(
  userId: string,
  onValue: (balance: number | null) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  const unsub = onSnapshot(
    doc(db, "users", userId),
    (snap) => {
      if (!snap.exists()) {
        setSubscribedRouteTokenBalance(null);
        onValue(null);
        return;
      }
      const n = snap.data().routeTokenBalance;
      const balance =
        typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      setSubscribedRouteTokenBalance(balance);
      onValue(balance);
    },
    () => {
      setSubscribedRouteTokenBalance(null);
      onValue(null);
    },
  );
  return () => {
    unsub();
    setSubscribedRouteTokenBalance(null);
  };
}

export async function ensureRouteTokenOnboardingClient(user: User): Promise<number | null> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!projectId) return null;

  const emulatorUrl = resolveFunctionsHttpUrl("ensureRouteTokenOnboardingHttp");
  const url =
    emulatorUrl ?? `https://${region}-${projectId}.cloudfunctions.net/ensureRouteTokenOnboardingHttp`;
  const idToken = await user.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: {} }),
  });
  let json: { result?: { routeTokenBalance?: unknown }; error?: { message?: string } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return null;
  }
  if (json.error || !res.ok) return null;
  const bal = json.result?.routeTokenBalance;
  return typeof bal === "number" && Number.isFinite(bal) ? Math.max(0, Math.floor(bal)) : null;
}

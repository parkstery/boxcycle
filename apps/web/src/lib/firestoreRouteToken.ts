import type { User } from "firebase/auth";
import { doc, getFirestore, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getFirebaseApp } from "./firebase";

export function subscribeRouteTokenBalance(
  userId: string,
  onValue: (balance: number | null) => void,
): Unsubscribe {
  const db = getFirestore(getFirebaseApp());
  return onSnapshot(
    doc(db, "users", userId),
    (snap) => {
      if (!snap.exists()) {
        onValue(null);
        return;
      }
      const n = snap.data().routeTokenBalance;
      onValue(typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    },
    () => onValue(null),
  );
}

export async function ensureRouteTokenOnboardingClient(user: User): Promise<number | null> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!projectId) return null;

  const url = `https://${region}-${projectId}.cloudfunctions.net/ensureRouteTokenOnboardingHttp`;
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

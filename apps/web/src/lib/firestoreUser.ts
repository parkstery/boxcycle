import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName } from "./authDisplay";
import { getFirebaseApp } from "./firebase";

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await setDoc(
    doc(db, "users", user.uid),
    {
      displayName: user.displayName ?? (user.isAnonymous ? getPresenceDisplayName(user) : null),
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      isAnonymous: user.isAnonymous,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

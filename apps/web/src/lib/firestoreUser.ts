import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseApp } from "./firebase";

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await setDoc(
    doc(db, "users", user.uid),
    {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

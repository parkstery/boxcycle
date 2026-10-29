import { documentId, query, where, type CollectionReference, type DocumentData } from "firebase/firestore";

/** Every live-ride consumer hides self. Exclude it on the server, before document delivery.
 * Keep a continuous query for every other rider: RTDB failure must not require a cold listen.
 * One inequality on __name__ requires no composite index or additional range field.
 */
export function livePublicationRidesQuery(
  collection: CollectionReference<DocumentData>,
  excludeUid?: string | null,
) {
  return excludeUid ? query(collection, where(documentId(), "!=", excludeUid)) : collection;
}

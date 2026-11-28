import { limitToLast, onChildAdded, onChildChanged, onValue, orderByChild, query, ref, serverTimestamp, set, startAt } from "firebase/database";
import type { Database } from "firebase/database";
import { getFirebaseDatabase } from "../../firebase/app";

/** kind 없음 = 엄지척(구버전 호환). reply=true 는 받은 👍에 대한 응답(👍/👋)이며 다시 응답을 부르지 않는다. */
export type ThumbEvent = { eventId: string; senderUid: string; targetUid: string; senderName: string; side: "left" | "right"; createdAt: number; expiresAt: number; kind?: "thumb" | "hi"; reply?: boolean };
/** side: 상대가 보이는 쪽(실제 추월 방향). 없으면 시각 정책 기본값(추월자는 왼쪽으로 지나감). */
export type ThumbSendOptions = { kind?: "thumb" | "hi"; reply?: boolean; side?: "left" | "right" };
function readServerOffset(db: Database): Promise<number> {
  return new Promise((resolve, reject) => {
    onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => resolve(Number(snapshot.val()) || 0), reject, { onlyOnce: true });
  });
}
export async function sendThumbsUp(trailId: string, senderUid: string, targetUid: string, senderName: string, db: Database = getFirebaseDatabase(), options: ThumbSendOptions = {}): Promise<ThumbEvent> {
  const offset = await readServerOffset(db);
  const now = Date.now() + offset;
  // 휴대폰의 LAN HTTP 테스트에서도 안전한 난수 ID를 생성한다.
  const eventId = typeof crypto.randomUUID === "function" ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  // 추월 시각 정책에서 더 빠른 상대는 왼쪽으로 지나간다: 추월당한 사람은 왼쪽으로 👍,
  // 응답하는 추월자는 오른쪽(뒤에 남은 상대 쪽)으로 동작한다.
  const reply = options.reply === true;
  const kind = options.kind ?? "thumb";
  const event: ThumbEvent = { eventId, senderUid, targetUid, senderName: senderName.slice(0, 40), side: options.side ?? (reply ? "right" : "left"), createdAt: now, expiresAt: now + 8000,
    ...(kind === "hi" ? { kind } : {}), ...(reply ? { reply } : {}) };
  await set(ref(db, `trails/${trailId}/thumbsUp/${targetUid}/${senderUid}`), { ...event, createdAt: serverTimestamp() });
  return event;
}
export function subscribeThumbsUp(trailId: string, targetUid: string, onEvent: (event: ThumbEvent) => void, onError: (error: Error) => void, db: Database = getFirebaseDatabase()): () => void {
  const seen = new Set<string>();
  let active = true;
  let unsubscribe: (() => void) | null = null;
  void readServerOffset(db).then((offset) => {
    if (!active) return;
    const events = query(ref(db, `trails/${trailId}/thumbsUp/${targetUid}`), orderByChild("createdAt"), startAt(Date.now() + offset - 8000), limitToLast(20));
    const consume = (raw: unknown) => {
      if (!active) return;
      const event = raw as ThumbEvent;
      if (!event || typeof event.eventId !== "string" || seen.has(event.eventId) || event.targetUid !== targetUid || typeof event.expiresAt !== "number" || event.expiresAt <= Date.now() + offset) return;
      seen.add(event.eventId);
      if (seen.size > 200) seen.delete(seen.values().next().value!);
      onEvent(event);
    };
    const reportError = (error: Error) => { if (active) onError(error); };
    const removeAdd = onChildAdded(events, (event) => consume(event.val()), reportError);
    const removeChange = onChildChanged(events, (event) => consume(event.val()), reportError);
    unsubscribe = () => { removeAdd(); removeChange(); };
  }).catch((error: Error) => { if (active) onError(error); });
  return () => { active = false; unsubscribe?.(); };
}

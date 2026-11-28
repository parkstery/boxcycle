import { useCallback, useEffect, useRef, useState } from "react";
import { NearbyThumbDetector, type ThumbCandidate } from "../../lib/ride/nearbyThumbs";
import { sendThumbsUp, subscribeThumbsUp } from "../../lib/ride/repo/rtdbThumbsUp";
import { clearThumbGestures, lateralSideOfPeer, playThumbGesture, subscribeOvertakeFrames } from "../../lib/riderPrototype/overtakeThumbsRuntime";
import "./OvertakeThumbsUp.css";

type ReplyPrompt = { id: string; label: string; expiresAtMs: number; senderSide: "left" | "right" };
type ReplyKind = "thumb" | "hi";
const REPLY_SHOW_MS = 8000;
const replyEmoji = (kind: ReplyKind) => kind === "hi" ? "👋" : "👍";

/**
 * 11-28 Chief 흐름: 추월당하는(느린) 쪽에 「OO님에게 👍」, 받은 추월자에게 [👍][👋] 응답 버튼.
 * 응답(reply)은 다시 응답 버튼을 부르지 않는다.
 */

export function OvertakeThumbsUp({ trailId, userId, displayName, active }: {
  trailId: string; userId: string | null; displayName: string | null | undefined; active: boolean;
}) {
  const [candidate, setCandidate] = useState<ThumbCandidate | null>(null);
  const [replyPrompt, setReplyPrompt] = useState<ReplyPrompt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const names = useRef(new Map<string, string>());
  const generation = useRef(0);
  const retireSession = useCallback(() => { generation.current++; clearThumbGestures(); }, []);
  useEffect(() => {
    const epoch = ++generation.current;
    if (!active || !userId || !trailId) return;
    const detector = new NearbyThumbDetector();
    const stopFrames = subscribeOvertakeFrames((frame) => {
      names.current = new Map(frame.peers.map((peer) => [peer.id, peer.label]));
      const next = detector.update(frame.peers.map((peer) => ({ id: peer.id, label: peer.label,
        gapM: peer.distanceM - frame.selfDistanceM, relativeSpeedMps: peer.speedMps - frame.selfSpeedMps,
        headingDeltaDeg: ((peer.headingDeg - frame.selfHeadingDeg + 540) % 360) - 180, fresh: peer.fresh,
      })), frame.nowMs);
      // 가까이 있는 동안 유지하고, 멀어지거나 최대 시간이 지나면 숨긴다. 같은 값이면 다시 그리지 않는다.
      setCandidate((current) => {
        const kept = current && current.expiresAtMs > Date.now() && detector.isStillNear(current.id, frame.nowMs) ? current : null;
        return kept ?? next ?? null;
      });
    });
    const stopEvents = subscribeThumbsUp(trailId, userId, (event) => {
      if (generation.current !== epoch) return;
      const senderName = names.current.get(event.senderUid) || event.senderName || "동행 라이더";
      const kind: ReplyKind = event.kind === "hi" ? "hi" : "thumb";
      playThumbGesture(event.senderUid, { id: event.eventId, side: event.side, kind, startedAtMs: performance.now() });
      if (event.reply) {
        setNotice(`${senderName}님이 ${replyEmoji(kind)}로 답했어요`);
        return;
      }
      setNotice(null);
      setReplyPrompt({ id: event.senderUid, label: senderName.slice(0, 40), expiresAtMs: Date.now() + REPLY_SHOW_MS, senderSide: event.side });
    }, () => { if (generation.current === epoch) setNotice("엄지척 연결을 확인해 주세요"); });
    return () => {
      retireSession(); stopFrames(); stopEvents();
      names.current.clear(); setCandidate(null); setReplyPrompt(null); setNotice(null);
    };
  }, [active, userId, trailId, retireSession]);
  useEffect(() => {
    if (!candidate) return;
    const timer = setTimeout(() => setCandidate(null), Math.max(0, candidate.expiresAtMs - Date.now()));
    return () => clearTimeout(timer);
  }, [candidate]);
  useEffect(() => {
    if (!replyPrompt) return;
    const timer = setTimeout(() => setReplyPrompt(null), Math.max(0, replyPrompt.expiresAtMs - Date.now()));
    return () => clearTimeout(timer);
  }, [replyPrompt]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!active || !userId) return null;
  const send = async () => {
    if (!candidate || sending || candidate.expiresAtMs <= Date.now()) return;
    const selected = candidate;
    const epoch = generation.current;
    setSending(true);
    try {
      // 추월자가 지나가는 쪽으로 👍. 옆 간격을 모르면 시각 정책(빠른 쪽이 왼쪽)을 따른다.
      const side = lateralSideOfPeer(selected.id) ?? "left";
      const event = await sendThumbsUp(trailId, userId, selected.id, displayName?.trim() || "라이더", undefined, { side });
      if (generation.current !== epoch) return;
      playThumbGesture("live-self", { id: event.eventId, side: event.side, kind: "thumb", startedAtMs: performance.now() });
      setCandidate(null);
      setNotice(`${selected.label}님에게 👍를 보냈어요`);
    } catch { if (generation.current === epoch) setNotice("엄지척을 보내지 못했어요. 다시 눌러 주세요"); }
    finally { setSending(false); }
  };
  const reply = async (kind: ReplyKind) => {
    if (!replyPrompt || sending || replyPrompt.expiresAtMs <= Date.now()) return;
    const selected = replyPrompt;
    const epoch = generation.current;
    setSending(true);
    try {
      // 나에게 👍한 라이더가 보이는 쪽으로 응답. 모르면 상대가 나를 향한 방향의 반대쪽.
      const side = lateralSideOfPeer(selected.id) ?? (selected.senderSide === "left" ? "right" : "left");
      const event = await sendThumbsUp(trailId, userId, selected.id, displayName?.trim() || "라이더", undefined, { kind, reply: true, side });
      if (generation.current !== epoch) return;
      playThumbGesture("live-self", { id: event.eventId, side: event.side, kind, startedAtMs: performance.now() });
      setReplyPrompt(null);
      setNotice(`${selected.label}님에게 ${replyEmoji(kind)}로 답했어요`);
    } catch { if (generation.current === epoch) setNotice("답하지 못했어요. 다시 눌러 주세요"); }
    finally { setSending(false); }
  };
  return <div className="overtake-thumbs-up">
    {replyPrompt && <div className="overtake-thumbs-up__reply" role="group" aria-label={`${replyPrompt.label}님의 엄지척에 답하기`}>
      <span className="overtake-thumbs-up__reply-text">{`${replyPrompt.label}님이 👍를 보냈어요`}</span>
      <span className="overtake-thumbs-up__reply-actions">
        <button type="button" className="overtake-thumbs-up__button" disabled={sending} onClick={() => void reply("thumb")} aria-label="엄지척으로 답하기">👍</button>
        <button type="button" className="overtake-thumbs-up__button" disabled={sending} onClick={() => void reply("hi")} aria-label="손 인사로 답하기">👋</button>
      </span>
    </div>}
    {candidate && <button type="button" className="overtake-thumbs-up__button" disabled={sending} onClick={() => void send()} aria-label={`${candidate.label}님에게 엄지척 보내기`}>
      {sending ? "보내는 중…" : `${candidate.label}님에게 👍`}
    </button>}
    {notice && <div role="status" className="overtake-thumbs-up__notice">{notice}</div>}
  </div>;
}

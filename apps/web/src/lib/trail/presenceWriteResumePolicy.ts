/**
 * Trail presence write resume throttle — pure.
 * Fresh heartbeat-window resume delays the next upsert; stale / first / new session → immediate.
 */

export type PresenceWriteResumeDecision =
  | { action: "immediate" }
  | { action: "schedule"; delayMs: number };

export type PresenceWriteResumeInput = {
  lastSuccessAtMs: number | null;
  nowMs: number;
  heartbeatIntervalMs: number;
};

export function decidePresenceWriteResume(
  input: PresenceWriteResumeInput,
): PresenceWriteResumeDecision {
  if (input.lastSuccessAtMs == null) return { action: "immediate" };
  const interval = input.heartbeatIntervalMs;
  if (!Number.isFinite(interval) || interval <= 0) return { action: "immediate" };
  const age = input.nowMs - input.lastSuccessAtMs;
  if (!Number.isFinite(age) || age < 0 || age >= interval) return { action: "immediate" };
  return { action: "schedule", delayMs: interval - age };
}

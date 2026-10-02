/**
 * Activity World visibility-resume poll policy (pure).
 * Fresh last success → schedule remaining interval; stale / force / never → immediate.
 */

export type ActivityWorldResumeDecision =
  | { action: "immediate" }
  | { action: "schedule"; delayMs: number };

export type ActivityWorldResumeInput = {
  lastSuccessAtMs: number | null;
  nowMs: number;
  freshnessIntervalMs: number;
  force?: boolean;
};

export function decideActivityWorldResume(input: ActivityWorldResumeInput): ActivityWorldResumeDecision {
  if (input.force) return { action: "immediate" };
  if (input.lastSuccessAtMs == null) return { action: "immediate" };
  const interval = input.freshnessIntervalMs;
  if (!Number.isFinite(interval) || interval <= 0) return { action: "immediate" };
  const age = input.nowMs - input.lastSuccessAtMs;
  if (!Number.isFinite(age) || age < 0 || age >= interval) return { action: "immediate" };
  return { action: "schedule", delayMs: interval - age };
}

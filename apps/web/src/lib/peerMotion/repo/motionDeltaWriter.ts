/** Same snapshots/cadence, smaller request bodies. Only acknowledged idle state is a delta base. */
export function createMotionDeltaWriter<T extends object>(ports: {
  set: (key: string, value: T) => Promise<void>;
  update: (key: string, value: Record<string, unknown>) => Promise<void>;
}) {
  type State = { confirmed: T | null; active: number; issued: number; acknowledged: number };
  const states = new Map<string, State>();

  function patchFrom(previous: T, next: T): Record<string, unknown> {
    const before = previous as Record<string, unknown>;
    const after = next as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (before[key] !== after[key]) patch[key] = after[key] ?? null;
    }
    return patch;
  }

  async function write(key: string, input: T): Promise<void> {
    const value = { ...input };
    let state = states.get(key);
    if (!state) {
      state = { confirmed: null, active: 0, issued: 0, acknowledged: 0 };
      states.set(key, state);
    }
    const ticket = ++state.issued;
    // A second in-flight write is complete: an earlier failure or phase change
    // must not leave metadata inherited from the wrong submitted snapshot.
    const base = state.active === 0 ? state.confirmed : null;
    const patch = base ? patchFrom(base, value) : null;
    const useDelta = patch != null && JSON.stringify(patch).length < JSON.stringify(value).length;
    state.active += 1;
    try {
      try {
        if (useDelta) await ports.update(key, patch!);
        else await ports.set(key, value);
      } catch (error) {
        // A server-side removal can invalidate an otherwise acknowledged base.
        // Retry complete state once, only if no newer write/session supersedes it.
        // Newer overlapping writes are already full snapshots; never rewind them.
        if (!useDelta || states.get(key) !== state || ticket !== state.issued) throw error;
        await ports.set(key, value);
      }
      if (states.get(key) === state && ticket >= state.acknowledged) {
        state.confirmed = value;
        state.acknowledged = ticket;
      }
    } catch (error) {
      if (states.get(key) === state && ticket >= state.acknowledged) state.confirmed = null;
      throw error;
    } finally {
      state.active -= 1;
    }
  }

  return {
    write,
    invalidate(key?: string): void {
      if (key == null) states.clear();
      else states.delete(key);
    },
  };
}

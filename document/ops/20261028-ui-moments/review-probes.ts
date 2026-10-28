import assert from 'node:assert/strict';
import { emptyRideMomentMemory, resolveRideMoments } from '../../../apps/web/src/lib/ride/rideMoments.ts';
import { playRideMomentSound } from '../../../apps/web/src/lib/ride/rideMomentSound.ts';

const phase = (kind: string, remainingSec = 10) => ({ phase: kind, step: 0, label: kind, remainingSec, repeat: 1, totalRepeats: 5, round: 1, totalRounds: 1, nextLabel: '다음 · 운동 1분' });
const memory = () => ({ ...emptyRideMomentMemory(), started: true, intervalStarted: true, lastStatus: 'running', lastElapsedMs: 9000, lastPhase: 'warmup' });
const input = (extra = {}) => ({ status: 'running', elapsedMs: 10000, routeMeters: 5000, traveledMeters: 100, waypointMeters: [], interval: phase('warmup'), newRoadKm: null, ended: null, ...extra });
const results: { name: string; pass: boolean; reason?: string }[] = [];
function probe(name: string, fn: () => void) { try { fn(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, reason: String(error) }); } }

probe('running→idle+end payload delivers finish', () => {
  const r = resolveRideMoments(memory() as never, input({ status: 'idle', ended: { reason: 'finish', sessionKm: 5 } }) as never);
  assert.equal(r.event?.kind, 'finish');
});
probe('new ride after a completed ride starts and can celebrate again', () => {
  const end = resolveRideMoments(memory() as never, input({ status: 'idle', ended: { reason: 'finish', sessionKm: 5 } }) as never);
  const idle = resolveRideMoments(end.memory, input({ status: 'idle', elapsedMs: 0, traveledMeters: 0 }) as never);
  const start = resolveRideMoments(idle.memory, input({ status: 'running', elapsedMs: 0, traveledMeters: 0, interval: null }) as never);
  assert.equal(start.event?.kind, 'start');
});
probe('old ended payload surviving multiple running ticks cannot end the new ride', () => {
  const ended = { reason: 'finish', sessionKm: 5 };
  const end = resolveRideMoments(memory() as never, input({ status: 'idle', ended }) as never);
  const start = resolveRideMoments(end.memory, input({ elapsedMs: 0, traveledMeters: 0, interval: null, ended }) as never);
  assert.equal(start.event?.kind, 'start');
  const tick = resolveRideMoments(start.memory, input({ elapsedMs: 500, traveledMeters: 2, interval: null, ended }) as never);
  assert.equal(tick.event, null);
  assert.equal(tick.memory.ended, false);
});
probe('pause/resume does not repeat same three-second warning', () => {
  const a = resolveRideMoments(memory() as never, input({ interval: phase('warmup', 3) }) as never);
  assert.equal(a.event?.kind, 'intervalWarn');
  const b = resolveRideMoments(a.memory, input({ status: 'paused', interval: phase('warmup', 3) }) as never);
  const c = resolveRideMoments(b.memory, input({ interval: phase('warmup', 3) }) as never);
  assert.notEqual(c.event?.kind, 'intervalWarn');
});
probe('skipped completion is consumed instead of delayed one tick', () => {
  const a = resolveRideMoments(memory() as never, input({ elapsedMs: 100000, interval: phase('complete', 0) }) as never);
  assert.equal(a.event, null);
  const b = resolveRideMoments(a.memory, input({ elapsedMs: 100500, interval: phase('complete', 0) }) as never);
  assert.notEqual(b.event?.kind, 'intervalComplete');
});
probe('restarted interval may complete again in the same ride', () => {
  const prior = { ...memory(), intervalCompleted: true, lastPhase: 'complete' };
  const a = resolveRideMoments(prior as never, input({ interval: phase('warmup') }) as never);
  const b = resolveRideMoments(a.memory, input({ elapsedMs: 10500, interval: phase('complete', 0) }) as never);
  assert.equal(b.event?.kind, 'intervalComplete');
});
probe('zero-warmup start does not say begin with preparation', () => {
  const a = resolveRideMoments(emptyRideMomentMemory(), input({ elapsedMs: 0, interval: phase('work', 60) }) as never);
  assert.ok(a.event);
  assert.equal(a.event.coach.includes('준비부터'), false);
});
probe('AudioContext constructor failure is silent', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { AudioContext: class { constructor() { throw new Error('device unavailable'); } } }, configurable: true });
  try { assert.doesNotThrow(() => playRideMomentSound('start')); }
  finally { if (before) Object.defineProperty(globalThis, 'window', before); else Reflect.deleteProperty(globalThis, 'window'); }
});
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.every(r => r.pass) ? 0 : 1;

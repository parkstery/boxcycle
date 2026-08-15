// RTW Channel — 영속 pending queue
//
// watcher(감지)와 channel 서버(전달)는 서로 다른 프로세스다. 둘을 잇는 것은 이 디렉터리다.
// 파일로 남기므로 어느 쪽이 죽어도 이벤트를 잃지 않고, 재시작하면 미처리분을 다시 발견한다.
//
//   <runtimeDir>/channel/pending/<eventId>.json   전달 대기 또는 ACK 대기
//   <runtimeDir>/channel/done/<eventId>.json      ACK + 판정 완료
//
// 모든 쓰기는 임시 파일 → rename 으로 원자적이다. 대상 저장소에는 아무것도 쓰지 않는다.

import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export function channelPaths(runtimeDir) {
  const root = path.join(runtimeDir, 'channel');
  return {
    root,
    pendingDir: path.join(root, 'pending'),
    doneDir: path.join(root, 'done'),
    serversDir: path.join(root, 'servers'),
  };
}

async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function readJsonDir(dir) {
  const names = await readdir(dir).catch(() => []);
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const raw = await readFile(path.join(dir, name), 'utf8').catch(() => null);
    if (raw === null) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // 깨진 파일은 무시한다 — 전달을 막지 않는다.
    }
  }
  return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function listPending(runtimeDir) {
  return await readJsonDir(channelPaths(runtimeDir).pendingDir);
}

export async function listDone(runtimeDir) {
  return await readJsonDir(channelPaths(runtimeDir).doneDir);
}

export async function findEvent(runtimeDir, eventId) {
  const { pendingDir, doneDir } = channelPaths(runtimeDir);
  for (const [dir, state] of [[pendingDir, 'pending'], [doneDir, 'done']]) {
    const raw = await readFile(path.join(dir, `${eventId}.json`), 'utf8').catch(() => null);
    if (raw === null) continue;
    try {
      return { state, event: JSON.parse(raw) };
    } catch {
      return null;
    }
  }
  return null;
}

// ACK 는 「받았다」일 뿐 「끝냈다」가 아니다. 세션이 감리 도중 끊기면(API 단절 등)
// 이벤트는 ACK된 채 verdict 없이 영원히 남는다. 그래서 ACK 에도 lease 를 건다.
export const DEFAULT_ACK_LEASE_MS = 20 * 60_000;   // ACK 후 이 시간 안에 verdict 가 없으면 중단으로 본다
export const DEFAULT_ACK_WAIT_MS = 3 * 60_000;     // 전달했는데 ACK 조차 없을 때 재전달까지 기다리는 시간
export const DEFAULT_MAX_ATTEMPTS = 3;             // 이만큼 시도하고도 안 되면 사람을 부른다

/**
 * 이벤트가 지금 무엇을 기다리는 상태인가.
 *
 * 실측 근거: 세션 감리는 2~5분에 끝난다(2분24초·3분2초). ACK 후 20분이 지나도록
 * verdict 가 없으면 정상 지연이 아니라 중단이다.
 */
export function classifyEvent(event, {
  now = Date.now(),
  ackLeaseMs = DEFAULT_ACK_LEASE_MS,
  ackWaitMs = DEFAULT_ACK_WAIT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
} = {}) {
  if (event.verdict) return { action: 'done', reason: '판정 완료' };
  if (event.escalated) return { action: 'escalated', reason: `${event.attempts ?? 0}회 시도 후 중단 — Chief 확인 필요` };

  const attempts = event.attempts ?? event.deliveries ?? 0;
  const ackedAt = event.ackedAt ? Date.parse(event.ackedAt) : null;
  const deliveredAt = event.lastDeliveredAt ? Date.parse(event.lastDeliveredAt) : null;

  if (ackedAt !== null) {
    const sinceAck = now - ackedAt;
    if (sinceAck <= ackLeaseMs) {
      return { action: 'in-progress', reason: `감리 중(ACK 후 ${Math.round(sinceAck / 60_000)}분)` };
    }
    if (attempts >= maxAttempts) {
      return { action: 'escalate', reason: `ACK 후 ${Math.round(sinceAck / 60_000)}분째 판정 없음 — ${attempts}회 시도 소진` };
    }
    return { action: 'deliver', reason: `ACK 후 ${Math.round(sinceAck / 60_000)}분째 판정 없음 — 중단으로 보고 재전달` };
  }

  if (deliveredAt === null) return { action: 'deliver', reason: '첫 전달' };
  const sinceDelivery = now - deliveredAt;
  if (sinceDelivery <= ackWaitMs) {
    return { action: 'wait-ack', reason: `ACK 대기(${Math.round(sinceDelivery / 1_000)}초)` };
  }
  if (attempts >= maxAttempts) {
    return { action: 'escalate', reason: `ACK 없이 ${attempts}회 전달 — 세션이 이벤트를 받지 못하고 있다` };
  }
  return { action: 'deliver', reason: `ACK 없이 ${Math.round(sinceDelivery / 60_000)}분 경과 — 재전달` };
}

/**
 * 이벤트 파일을 「내가 읽은 그 내용일 때만」 갱신한다(CAS).
 *
 * 서버가 둘 이상이면 같은 이벤트를 동시에 재전달하려 들 수 있다. rename 으로 원자적으로
 * 집어 든 뒤 내용이 그대로일 때만 쓰므로, 경합에서 한쪽만 이긴다.
 */
export async function casUpdateEvent(runtimeDir, eventId, expectedRaw, patch, tag = String(process.pid)) {
  const { pendingDir } = channelPaths(runtimeDir);
  const filePath = path.join(pendingDir, `${eventId}.json`);
  const asidePath = `${filePath}.${tag}.cas`;
  try {
    await rename(filePath, asidePath);
  } catch (error) {
    if (error.code === 'ENOENT') return { ok: false, reason: '이벤트가 이미 없다(종결됐거나 다른 쪽이 가져갔다)' };
    throw error;
  }
  const raw = await readFile(asidePath, 'utf8').catch(() => null);
  if (raw !== expectedRaw) {
    // 내가 본 그 이벤트가 아니다. 원위치시키고 물러난다.
    await rename(asidePath, filePath).catch(async () => { await unlink(asidePath).catch(() => {}); });
    return { ok: false, reason: '다른 쪽이 먼저 갱신했다' };
  }
  const updated = { ...JSON.parse(raw), ...patch };
  await atomicWriteJson(filePath, updated);
  await unlink(asidePath).catch(() => {});
  return { ok: true, event: updated };
}

/** 재전달을 선점한다. ACK 는 지워 새 ACK 를 요구하고, 시도 횟수를 올린다. */
export async function claimDelivery(runtimeDir, event, { serverId, at = new Date().toISOString() }) {
  const { pendingDir } = channelPaths(runtimeDir);
  const raw = await readFile(path.join(pendingDir, `${event.eventId}.json`), 'utf8').catch(() => null);
  if (raw === null) return { ok: false, reason: '이벤트가 이미 없다' };
  const attempts = (event.attempts ?? event.deliveries ?? 0) + 1;
  return await casUpdateEvent(runtimeDir, event.eventId, raw, {
    attempts,
    ackedAt: null,                 // 이전 ACK 는 무효다 — 그 세션은 끝내지 못했다
    previousAckedAt: event.ackedAt ?? null,
    deliveryOwner: serverId,
    claimedAt: at,
  });
}

/** 시도를 소진했다. 조용히 버리지 않고 사람을 부를 수 있게 표시한다. */
export async function escalateEvent(runtimeDir, event, reason, at = new Date().toISOString()) {
  const { pendingDir } = channelPaths(runtimeDir);
  const raw = await readFile(path.join(pendingDir, `${event.eventId}.json`), 'utf8').catch(() => null);
  if (raw === null) return { ok: false, reason: '이벤트가 이미 없다' };
  return await casUpdateEvent(runtimeDir, event.eventId, raw, { escalated: true, escalatedAt: at, escalationReason: reason });
}

/**
 * 채널 서버 heartbeat.
 *
 * 이벤트가 어디로도 가지 않는 가장 흔한 원인은 「서버가 안 떠 있다」와 「두 세션이 동시에 떠 있다」다.
 * Claude Code 는 채널 알림을 확인해 주지 않으므로(문서 명시), 이걸 밖에서 볼 수 있게 파일로 남긴다.
 */
export async function writeHeartbeat(runtimeDir, info) {
  const { serversDir } = channelPaths(runtimeDir);
  await atomicWriteJson(path.join(serversDir, `${process.pid}.json`), {
    pid: process.pid,
    ppid: process.ppid,
    ...info,
    lastSeenAt: new Date().toISOString(),
  });
}

export async function clearHeartbeat(runtimeDir) {
  const { serversDir } = channelPaths(runtimeDir);
  await unlink(path.join(serversDir, `${process.pid}.json`)).catch(() => {});
}

/** staleMs 안에 살아 있음을 알린 서버만 돌려준다. */
export async function listLiveServers(runtimeDir, { staleMs = 15_000, now = Date.now() } = {}) {
  const servers = await readJsonDir(channelPaths(runtimeDir).serversDir);
  return servers.filter((server) => {
    const seen = Date.parse(server.lastSeenAt ?? '');
    return Number.isFinite(seen) && now - seen <= staleMs;
  });
}

/**
 * 완료 이벤트를 큐에 넣는다.
 *
 * 같은 triggerKey(HEAD·INSTRUCTION·REPORT 조합)는 이미 pending 이든 done 이든 다시 넣지 않는다.
 * 이것이 「하나의 완료가 여러 번 감리되지 않는다」의 1차 방어다.
 */
export async function enqueueEvent(runtimeDir, event) {
  if (!event?.eventId || !event?.triggerKey) {
    throw new Error('eventId·triggerKey 는 필수입니다.');
  }
  const { pendingDir } = channelPaths(runtimeDir);
  for (const existing of [...await listPending(runtimeDir), ...await listDone(runtimeDir)]) {
    if (existing.triggerKey === event.triggerKey) {
      return { enqueued: false, reason: `동일 triggerKey 이벤트가 이미 있습니다(${existing.eventId}, ${existing.verdict ?? '판정 전'})`, event: existing };
    }
  }
  const record = { schemaVersion: 1, deliveries: 0, ackedAt: null, verdict: null, ...event };
  await atomicWriteJson(path.join(pendingDir, `${event.eventId}.json`), record);
  return { enqueued: true, event: record };
}

/** 세션으로 밀어 넣은 횟수를 기록한다. 전달은 확인되지 않는다 — ACK 만이 확인이다. */
export async function markDelivered(runtimeDir, eventId, at = new Date().toISOString()) {
  const found = await findEvent(runtimeDir, eventId);
  if (!found || found.state !== 'pending') return null;
  const updated = { ...found.event, deliveries: (found.event.deliveries ?? 0) + 1, lastDeliveredAt: at };
  await atomicWriteJson(path.join(channelPaths(runtimeDir).pendingDir, `${eventId}.json`), updated);
  return updated;
}

/** Claude Sync 가 이벤트를 받았음을 스스로 알린다. 여기서부터 「도달」이 증명된다. */
export async function ackEvent(runtimeDir, eventId, { note = null, at = new Date().toISOString() } = {}) {
  const found = await findEvent(runtimeDir, eventId);
  if (!found) return { ok: false, reason: `모르는 event_id: ${eventId}` };
  if (found.state === 'done') return { ok: false, reason: `이미 종결된 이벤트입니다: ${eventId}` };
  const updated = { ...found.event, ackedAt: found.event.ackedAt ?? at, ackNote: note ?? found.event.ackNote ?? null };
  await atomicWriteJson(path.join(channelPaths(runtimeDir).pendingDir, `${eventId}.json`), updated);
  return { ok: true, event: updated };
}

/** 판정을 저장하고 이벤트를 종결한다(pending → done). */
export async function recordVerdict(runtimeDir, eventId, { verdict, summary = null, at = new Date().toISOString() }) {
  const allowed = ['BLOCK', 'WARNING', 'PASS'];
  const normalized = String(verdict ?? '').toUpperCase();
  if (!allowed.includes(normalized)) {
    return { ok: false, reason: `판정은 ${allowed.join(' | ')} 중 하나여야 합니다(받은 값: ${verdict}).` };
  }
  const found = await findEvent(runtimeDir, eventId);
  if (!found) return { ok: false, reason: `모르는 event_id: ${eventId}` };
  if (found.state === 'done') return { ok: false, reason: `이미 종결된 이벤트입니다: ${eventId}` };
  if (!found.event.ackedAt) return { ok: false, reason: 'ACK 없이 판정을 저장할 수 없습니다. 먼저 rtw_ack 를 호출하세요.' };

  const { pendingDir, doneDir } = channelPaths(runtimeDir);
  const done = { ...found.event, verdict: normalized, verdictSummary: summary, verdictAt: at };
  await atomicWriteJson(path.join(doneDir, `${eventId}.json`), done);
  await unlink(path.join(pendingDir, `${eventId}.json`)).catch(() => {});
  return { ok: true, event: done };
}

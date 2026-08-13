import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildInitializeResult, pumpOnce, renderChannelEvent, handleToolCall } from './channel-server.mjs';
import { ackEvent, channelPaths, enqueueEvent, findEvent, listDone, listLiveServers, listPending, recordVerdict } from './channel-queue.mjs';
import { describeRouting, runAuditOnce } from './audit.mjs';

const EVENT = {
  eventId: 'sync-relay-2026-08-13T00-00-00.000Z-abcdef123456',
  createdAt: '2026-08-13T00:00:00.000Z',
  relay: 'sync-relay',
  target: 'C:/20.HDev/boxcycle',
  instructionId: 'S9 (시험)',
  triggerKey: 'a'.repeat(64),
  head: 'cc64279a89ce9ed58b03a16dca16fe33a53cdb37',
  branch: 'fix/multiplayer-position-sync',
  dirty: true,
  instructionHash: 'b'.repeat(64),
  reportHash: 'c'.repeat(64),
};

async function queueDir() {
  return await mkdtemp(path.join(os.tmpdir(), 'rtw-ch-'));
}

test('채널 능력과 도구가 선언된다', () => {
  const init = buildInitializeResult();
  assert.deepEqual(init.capabilities.experimental['claude/channel'], {});
  assert.deepEqual(init.capabilities.tools, {});
  assert.equal(init.serverInfo.name, 'rtw');
  assert.match(init.instructions, /rtw_ack/);
  assert.match(init.instructions, /rtw_verdict/);
  assert.match(init.instructions, /Chief 의 추가 지시를 기다리지 말고/);
});

test('이벤트 meta 키는 식별자만 쓴다(하이픈은 조용히 버려진다)', () => {
  const { content, meta } = renderChannelEvent(EVENT);
  for (const key of Object.keys(meta)) {
    assert.match(key, /^[A-Za-z0-9_]+$/, `meta 키에 하이픈·특수문자가 있으면 안 된다: ${key}`);
  }
  assert.equal(meta.event_id, EVENT.eventId);
  assert.equal(meta.head, EVENT.head);
  assert.equal(meta.trigger_key, EVENT.triggerKey.slice(0, 12));
  assert.match(content, /rtw_ack\(event_id="sync-relay-2026/);
  assert.match(content, /워킹트리 dirty/);
});

test('같은 triggerKey 는 두 번 큐에 들어가지 않는다', async () => {
  const dir = await queueDir();
  const first = await enqueueEvent(dir, EVENT);
  assert.equal(first.enqueued, true);

  const again = await enqueueEvent(dir, { ...EVENT, eventId: 'sync-relay-다른-id' });
  assert.equal(again.enqueued, false);
  assert.match(again.reason, /동일 triggerKey/);
  assert.equal((await listPending(dir)).length, 1);
});

test('ACK 없이는 판정을 저장할 수 없다', async () => {
  const dir = await queueDir();
  await enqueueEvent(dir, EVENT);

  const tooEarly = await recordVerdict(dir, EVENT.eventId, { verdict: 'PASS' });
  assert.equal(tooEarly.ok, false);
  assert.match(tooEarly.reason, /ACK 없이/);

  assert.equal((await ackEvent(dir, EVENT.eventId)).ok, true);
  const saved = await recordVerdict(dir, EVENT.eventId, { verdict: 'warning', summary: '요약' });
  assert.equal(saved.ok, true);
  assert.equal(saved.event.verdict, 'WARNING');

  assert.equal((await listPending(dir)).length, 0);
  assert.equal((await listDone(dir)).length, 1);
  assert.equal((await findEvent(dir, EVENT.eventId)).state, 'done');
});

test('알 수 없는 event_id·판정값은 거부된다', async () => {
  const dir = await queueDir();
  await enqueueEvent(dir, EVENT);
  await ackEvent(dir, EVENT.eventId);

  assert.equal((await ackEvent(dir, '없는-id')).ok, false);
  assert.match((await recordVerdict(dir, EVENT.eventId, { verdict: '좋음' })).reason, /BLOCK \| WARNING \| PASS/);
  assert.match((await recordVerdict(dir, '없는-id', { verdict: 'PASS' })).reason, /모르는 event_id/);
});

test('종결된 이벤트는 다시 ACK·판정되지 않는다', async () => {
  const dir = await queueDir();
  await enqueueEvent(dir, EVENT);
  await ackEvent(dir, EVENT.eventId);
  await recordVerdict(dir, EVENT.eventId, { verdict: 'PASS' });

  assert.match((await ackEvent(dir, EVENT.eventId)).reason, /이미 종결/);
  assert.match((await recordVerdict(dir, EVENT.eventId, { verdict: 'BLOCK' })).reason, /이미 종결/);
});

test('미ACK 이벤트만 전달하고, 같은 프로세스는 중복 전달하지 않는다', async () => {
  const dir = await queueDir();
  await enqueueEvent(dir, EVENT);
  const sent = new Set();
  const emitted = [];
  const emit = async (message) => { emitted.push(message); };

  assert.equal(await pumpOnce(dir, sent, emit), 1);
  assert.equal(emitted[0].method, 'notifications/claude/channel');
  assert.equal(await pumpOnce(dir, sent, emit), 0, '같은 프로세스가 다시 밀면 안 된다');

  // 전달 횟수는 기록된다.
  assert.equal((await listPending(dir))[0].deliveries, 1);

  // ACK 된 이벤트는 새 프로세스(빈 sent)에서도 전달 대상이 아니다.
  await ackEvent(dir, EVENT.eventId);
  assert.equal(await pumpOnce(dir, new Set(), emit), 0);
});

test('재시작 뒤에도 미ACK 이벤트는 다시 발견된다 (catch-up)', async () => {
  const dir = await queueDir();
  await enqueueEvent(dir, EVENT);
  const emitted = [];
  const emit = async (message) => { emitted.push(message); };

  await pumpOnce(dir, new Set(), emit);          // 1차 프로세스
  await pumpOnce(dir, new Set(), emit);          // 재시작 = sent 가 비어 있다
  assert.equal(emitted.length, 2, '미ACK 이면 재시작 후 다시 밀어야 한다');
  assert.equal((await listPending(dir))[0].deliveries, 2);
});

test('도구 호출은 큐 상태를 바꾸고 실패를 isError 로 알린다', async () => {
  const dir = await queueDir();
  await enqueueEvent(dir, EVENT);

  const early = await handleToolCall(dir, 'rtw_verdict', { event_id: EVENT.eventId, verdict: 'PASS' });
  assert.equal(early.isError, true);
  assert.match(early.content[0].text, /ACK 없이/);

  assert.equal((await handleToolCall(dir, 'rtw_ack', { event_id: EVENT.eventId })).isError, false);
  const ok = await handleToolCall(dir, 'rtw_verdict', { event_id: EVENT.eventId, verdict: 'BLOCK', summary: 's' });
  assert.match(ok.content[0].text, /판정 저장·종결됨/);
  assert.equal((await listDone(dir))[0].verdict, 'BLOCK');

  const unknown = await handleToolCall(dir, 'rtw_없는도구', {});
  assert.equal(unknown.isError, true);
});

test('감리 경로 표시가 실제 동작과 일치한다', () => {
  assert.match(describeRouting({ emitChannel: true }), /RTW Channel/);
  // --emit-channel 이면 세션 인자가 섞여 있어도 채널이 우선이다(둘은 CLI 에서 배타).
  assert.match(describeRouting({ emitChannel: true, syncSession: '8041b959-6fca-45b0-bdf9-1a3aa869bfb8' }), /RTW Channel/);
  assert.match(describeRouting({ syncSession: '8041b959-6fca-45b0-bdf9-1a3aa869bfb8' }), /8041b959.*resume/);
  assert.equal(describeRouting({}), 'headless 신규 호출');
});

test('채널 서버 heartbeat 로 0개·중복을 구분한다', async () => {
  const dir = await queueDir();
  const { serversDir } = channelPaths(dir);
  await mkdir(serversDir, { recursive: true });
  const now = Date.now();
  const write = async (pid, secondsAgo) => writeFile(
    path.join(serversDir, `${pid}.json`),
    JSON.stringify({ pid, ppid: pid + 1, cwd: 'C:/20.HDev/boxcycle', lastSeenAt: new Date(now - secondsAgo * 1000).toISOString() }),
    'utf8',
  );

  assert.equal((await listLiveServers(dir, { now })).length, 0, '아무도 없으면 0');

  await write(111, 2);
  assert.equal((await listLiveServers(dir, { now })).length, 1);

  await write(222, 3);
  assert.equal((await listLiveServers(dir, { now })).length, 2, '두 세션이 붙으면 중복으로 드러나야 한다');

  await write(333, 600); // 죽은 서버가 남긴 오래된 heartbeat
  assert.equal((await listLiveServers(dir, { now })).length, 2, 'stale 은 세지 않는다');
});

test('watcher 의 --emit-channel 은 감리를 돌리지 않고 큐에만 넣는다', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'rtw-emit-'));
  const target = path.join(base, 'target');
  const runtimeDir = path.join(base, 'runtime');
  const relayDir = path.join(target, 'document', 'ops', 'sync-relay');
  await mkdir(relayDir, { recursive: true });
  await writeFile(path.join(relayDir, 'INSTRUCTION.md'), '- **지시번호**: S9\n- **상태**: 보고완료\n', 'utf8');
  await writeFile(path.join(relayDir, 'REPORT.md'), '# 보고\n완료\n', 'utf8');

  let audits = 0;
  const options = {
    target,
    relay: 'sync-relay',
    runtimeDir,
    settleMs: 0,
    emitChannel: true,
    verifyTarget: async () => {},
    snapshot: async () => ({ head: 'h'.repeat(40), branch: 'b', status: '', recentLog: '', dirty: false }),
    fingerprint: async () => ({ digest: 'd'.repeat(64), head: 'h'.repeat(40), statusHash: 's', diffHash: 'f', untrackedHash: 'u', untrackedCount: 0 }),
    invokeAudit: async () => { audits += 1; return { result: {} }; },
  };

  const first = await runAuditOnce(options);
  assert.equal(first.status, 'queued');
  assert.equal(audits, 0, '채널 모드에서는 별도 감리 프로세스를 띄우지 않는다');

  const pending = await listPending(runtimeDir);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].instructionId, 'S9');
  assert.equal(pending[0].head, 'h'.repeat(40));

  // 같은 완료를 다시 봐도 큐가 늘지 않는다.
  const second = await runAuditOnce(options);
  assert.equal(second.status, 'queued-skip');
  assert.equal((await listPending(runtimeDir)).length, 1);
});

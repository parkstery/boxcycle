#!/usr/bin/env node

// RTW Channel — 실행 중인 Claude Sync 감리 세션에 완료 이벤트를 밀어 넣는 MCP 채널 서버
//
// Claude Code 가 이 파일을 stdio 하위 프로세스로 띄운다. 우리는 `claude/channel` 능력을
// 선언하고 `notifications/claude/channel` 을 emit 한다 → 열려 있는 Sync 화면에
// <channel source="rtw" …> 로 도착하고, Chief 가 아무것도 입력하지 않아도 감리가 시작된다.
//
// 별도 프로세스로 감리를 돌리는 것이 아니다(그것이 --resume 의 한계였다).
// 여기서는 이벤트만 전달하고, 감리는 그 세션 자신이 수행한다.
//
// 로컬 전용: 네트워크 포트를 열지 않는다. 입력은 같은 머신의 파일 큐뿐이다.
// 대상(Sync) 저장소에는 아무것도 쓰지 않는다.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { ackEvent, channelPaths, clearHeartbeat, listPending, markDelivered, recordVerdict, writeHeartbeat } from './channel-queue.mjs';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_NAME = 'rtw';
const DEFAULT_RUNTIME_DIR = path.resolve(fileURLToPath(new URL('../..', import.meta.url)), '.orchestrator');
const POLL_MS = Number(process.env.RTW_CHANNEL_POLL_MS ?? 3_000);

const INSTRUCTIONS = `RTW 오케스트레이터 채널이다. 개발 REPORT 가 보고완료로 확정되면 <channel source="rtw" event_id="…"> 이벤트가 도착한다.

이벤트를 받으면 Chief 의 추가 지시를 기다리지 말고 즉시 다음을 수행하라.
1. mcp__rtw__rtw_ack 를 event_id 로 호출해 접수를 알린다.
2. 평소 감리 규율대로 INSTRUCTION·REPORT·Git·저장 증거를 대조해 감리한다. 읽기 전용이다 — 파일 수정·커밋·테스트 재실행을 하지 마라.
3. 감리를 마치면 mcp__rtw__rtw_verdict 를 event_id·verdict(BLOCK|WARNING|PASS)·summary 로 호출해 판정을 저장한다.

event_id 는 이벤트 태그의 속성 그대로 쓴다. 판정을 Sync 지시서에 자동 반영하지 마라.`;

const TOOLS = [
  {
    name: 'rtw_ack',
    description: 'RTW 채널 이벤트 접수를 알린다. 감리를 시작하기 전에 먼저 호출한다.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: '<channel> 태그의 event_id 속성' },
        note: { type: 'string', description: '선택 — 접수 시점 메모' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'rtw_verdict',
    description: 'RTW 채널 이벤트의 감리 판정을 저장하고 종결한다. rtw_ack 이후에만 쓸 수 있다.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: '<channel> 태그의 event_id 속성' },
        verdict: { type: 'string', enum: ['BLOCK', 'WARNING', 'PASS'], description: '최종 판정' },
        summary: { type: 'string', description: '판정 사유 요약' },
      },
      required: ['event_id', 'verdict'],
    },
  },
];

export function buildInitializeResult() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      // 이 키가 채널로 만든다 — Claude Code 가 알림 수신기를 등록한다.
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    serverInfo: { name: SERVER_NAME, version: '0.1.0' },
    instructions: INSTRUCTIONS,
  };
}

/** 이벤트 하나를 <channel> 본문·속성으로 만든다. meta 키는 식별자만 허용된다(밑줄 O, 하이픈 X). */
export function renderChannelEvent(event) {
  const content = `개발 REPORT 보고완료 — ${event.instructionId}

- relay: ${event.relay}
- 기준 커밋: ${event.head} (${event.branch})${event.dirty ? ' · 워킹트리 dirty — HEAD 기준으로 감리하고 미커밋분은 미검증으로 다뤄라' : ''}
- INSTRUCTION sha256: ${event.instructionHash}
- REPORT sha256: ${event.reportHash}
- 대상: ${event.target}

네 감리 차례다. 먼저 rtw_ack(event_id="${event.eventId}") 를 호출하고, 감리를 마치면 rtw_verdict 로 판정을 저장하라.`;
  return {
    content,
    meta: {
      event_id: String(event.eventId),
      relay: String(event.relay),
      head: String(event.head),
      trigger_key: String(event.triggerKey).slice(0, 12),
      instruction_id: String(event.instructionId),
    },
  };
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function log(line) {
  // stdout 은 프로토콜 전용이다. 진단은 stderr 로만 낸다.
  process.stderr.write(`[rtw-channel] ${line}\n`);
}

function toolResult(payload, isError = false) {
  return { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }], isError };
}

export async function handleToolCall(runtimeDir, name, args = {}) {
  if (name === 'rtw_ack') {
    const result = await ackEvent(runtimeDir, args.event_id, { note: args.note ?? null });
    if (!result.ok) return toolResult(`ACK 실패: ${result.reason}`, true);
    return toolResult(`ACK 기록됨: ${args.event_id}`);
  }
  if (name === 'rtw_verdict') {
    const result = await recordVerdict(runtimeDir, args.event_id, { verdict: args.verdict, summary: args.summary ?? null });
    if (!result.ok) return toolResult(`판정 저장 실패: ${result.reason}`, true);
    return toolResult(`판정 저장·종결됨: ${args.event_id} = ${result.event.verdict}`);
  }
  return toolResult(`알 수 없는 도구: ${name}`, true);
}

/**
 * 아직 ACK 되지 않은 이벤트를 세션으로 민다.
 *
 * 재시작·crash 이후에도 pending 이 파일로 남아 있으므로 여기서 다시 발견된다(catch-up).
 * 이미 이 프로세스가 민 이벤트는 다시 밀지 않는다 — 같은 요청을 두 번 세션에 넣지 않기 위해서다.
 */
export async function pumpOnce(runtimeDir, sent, emit) {
  const pending = await listPending(runtimeDir);
  let pushed = 0;
  for (const event of pending) {
    if (event.ackedAt) continue;
    if (sent.has(event.eventId)) continue;
    const { content, meta } = renderChannelEvent(event);
    await emit({ method: 'notifications/claude/channel', params: { content, meta } });
    sent.add(event.eventId);
    await markDelivered(runtimeDir, event.eventId);
    pushed += 1;
    log(`이벤트 전달: ${event.eventId} (${event.instructionId})`);
  }
  return pushed;
}

async function main() {
  const runtimeDirArg = process.argv.indexOf('--runtime-dir');
  const runtimeDir = runtimeDirArg > -1 ? path.resolve(process.argv[runtimeDirArg + 1]) : DEFAULT_RUNTIME_DIR;
  const { pendingDir, doneDir } = channelPaths(runtimeDir);
  await readdir(pendingDir).catch(() => []);
  log(`시작 — runtime ${runtimeDir}`);
  log(`pending ${pendingDir}`);
  log(`done    ${doneDir}`);

  const sent = new Set();
  let initialized = false;
  const beat = () => writeHeartbeat(runtimeDir, { cwd: process.cwd(), initialized }).catch(() => {});
  await beat();

  const emit = async (message) => writeMessage({ jsonrpc: '2.0', ...message });

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      log(`파싱 불가한 입력 무시: ${text.slice(0, 120)}`);
      return;
    }
    const { id, method, params } = message;
    try {
      if (method === 'initialize') {
        writeMessage({ jsonrpc: '2.0', id, result: buildInitializeResult() });
        return;
      }
      if (method === 'notifications/initialized') {
        initialized = true;
        // 세션이 준비된 직후 미처리분을 먼저 흘려보낸다.
        await pumpOnce(runtimeDir, sent, emit);
        return;
      }
      if (method === 'tools/list') {
        writeMessage({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
        return;
      }
      if (method === 'tools/call') {
        const result = await handleToolCall(runtimeDir, params?.name, params?.arguments ?? {});
        writeMessage({ jsonrpc: '2.0', id, result });
        return;
      }
      if (method === 'ping') {
        writeMessage({ jsonrpc: '2.0', id, result: {} });
        return;
      }
      if (id !== undefined) {
        writeMessage({ jsonrpc: '2.0', id, error: { code: -32601, message: `지원하지 않는 메서드: ${method}` } });
      }
    } catch (error) {
      log(`처리 오류(${method}): ${error.message}`);
      if (id !== undefined) {
        writeMessage({ jsonrpc: '2.0', id, error: { code: -32603, message: error.message } });
      }
    }
  });

  // 파일 큐 폴링 — watcher 가 언제 이벤트를 넣든 발견한다.
  const timer = setInterval(() => {
    beat();
    if (!initialized) return;
    pumpOnce(runtimeDir, sent, emit).catch((error) => log(`전달 실패: ${error.message}`));
  }, POLL_MS);
  timer.unref?.();

  rl.on('close', async () => {
    clearInterval(timer);
    await clearHeartbeat(runtimeDir);
    log('stdin 종료 — 서버를 닫는다.');
    process.exit(0);
  });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    log(`치명적 오류: ${error.message}`);
    process.exitCode = 1;
  });
}

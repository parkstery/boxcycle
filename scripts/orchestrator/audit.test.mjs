import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  acquireLock,
  assertUnchanged,
  awaitClaudeChild,
  computeTriggerKey,
  removeLockIfSame,
  evaluateLock,
  isProcessAlive,
  parseCli,
  parseInstruction,
  runAuditOnce,
  targetFingerprint,
  validateAuditResult,
} from './audit.mjs';

const PASS_RESULT = {
  verdict: 'PASS',
  summary: '지시와 구현 보고가 일치한다.',
  findings: [],
  next: ['다음 승인 단계로 진행한다.'],
  requiresChiefDecision: false,
};

const GIT = {
  head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  branch: 'fix/multiplayer-position-sync',
  status: '',
  recentLog: 'aaaaaaa docs(sync): 보고',
  dirty: false,
};

/** 대상 저장소·런타임 루트를 각각 임시 디렉터리로 만든다(런타임은 대상 밖). */
async function fixture(status = '보고완료') {
  const base = await mkdtemp(path.join(os.tmpdir(), 'rtw-orch-'));
  const target = path.join(base, 'target');
  const runtimeDir = path.join(base, 'runtime');
  const relayDir = path.join(target, 'document', 'ops', 'sync-relay');
  await mkdir(relayDir, { recursive: true });
  await writeFile(path.join(relayDir, 'INSTRUCTION.md'), `# 지시\n\n- **지시번호**: S3A\n- **상태**: ${status}\n`, 'utf8');
  await writeFile(path.join(relayDir, 'REPORT.md'), '# 보고\n\n완료\n', 'utf8');
  return { base, target, runtimeDir, relayDir };
}

/** 대상 저장소 안의 모든 파일 경로와 크기를 스냅샷한다. */
async function snapshotTree(root) {
  const entries = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else entries.push(`${path.relative(root, full)}:${(await readFile(full)).length}`);
    }
  };
  await walk(root);
  return entries.sort();
}

const FINGERPRINT = {
  digest: 'f'.repeat(64),
  head: GIT.head,
  statusHash: 's'.repeat(64),
  diffHash: 'd'.repeat(64),
  untrackedHash: 'u'.repeat(64),
  untrackedCount: 0,
};

function baseOptions(fx, overrides = {}) {
  return {
    target: fx.target,
    relay: 'sync-relay',
    runtimeDir: fx.runtimeDir,
    snapshot: async () => GIT,
    fingerprint: async () => FINGERPRINT,
    verifyTarget: async () => {},
    ...overrides,
  };
}

/** 실제 git 저장소 fixture — 지문 함수는 fake 로 대체하지 않고 그대로 시험한다. */
async function gitFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rtw-orch-git-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  git('init', '--quiet');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  await writeFile(path.join(root, '추적됨.md'), '처음\n', 'utf8');
  git('add', '.');
  git('commit', '--quiet', '-m', 'init');
  return { root, git };
}

test('보고완료 상태를 엄격히 식별한다', () => {
  assert.deepEqual(parseInstruction('- **지시번호**: S3A\n- **상태**: 보고완료\n'), {
    status: '보고완료',
    instructionId: 'S3A',
    reportComplete: true,
  });
  assert.equal(parseInstruction('- **상태**: 배포\n').reportComplete, false);
  assert.equal(parseInstruction('- **발신**: Claude · **일시**: 2026-08-11 · **상태**: 보고완료\n').reportComplete, true);
});

test('--target 없이는 실행을 거부한다 (cwd 폴백 금지)', async () => {
  await assert.rejects(() => runAuditOnce({ relay: 'sync-relay' }), /--target/);
  assert.throws(() => parseCli(['once']), /--target/);
});

test('--no-shadow 는 미구현으로 막힌다', async () => {
  const fx = await fixture();
  await assert.rejects(() => runAuditOnce(baseOptions(fx, { shadow: false })), /구현되지 않았습니다/);
  assert.throws(() => parseCli(['once', '--target', fx.target, '--no-shadow']), /구현되지 않았습니다/);
});

test('런타임 디렉터리를 대상 저장소 안에 둘 수 없다', async () => {
  const fx = await fixture();
  await assert.rejects(
    () => runAuditOnce(baseOptions(fx, { runtimeDir: path.join(fx.target, '.orchestrator') })),
    /대상 저장소 안에 둘 수 없습니다/,
  );
});

test('보고완료 전에는 Claude를 호출하지 않는다', async () => {
  const fx = await fixture('배포');
  let calls = 0;
  const result = await runAuditOnce(baseOptions(fx, { invokeAudit: async () => { calls += 1; return PASS_RESULT; } }));
  assert.equal(result.status, 'waiting');
  assert.equal(calls, 0);
});

test('shadow 감리는 대상 저장소에 아무것도 쓰지 않는다', async () => {
  const fx = await fixture();
  const before = await snapshotTree(fx.target);
  const result = await runAuditOnce(baseOptions(fx, { invokeAudit: async () => ({ result: PASS_RESULT }) }));
  const after = await snapshotTree(fx.target);

  assert.equal(result.status, 'audited');
  assert.deepEqual(after, before);
  const inbox = await readFile(result.inboxPath, 'utf8');
  assert.match(inbox, /\*\*VERDICT\*\*: PASS/);
  assert.match(inbox, /대상 저장소에는 아무것도 쓰지 않았다/);
  const runs = await readdir(path.join(fx.runtimeDir, 'runs'));
  assert.equal(runs.length, 1);
});

test('같은 커밋·지시서·보고서 조합은 다시 감리하지 않는다', async () => {
  const fx = await fixture();
  let calls = 0;
  const options = baseOptions(fx, { invokeAudit: async () => { calls += 1; return { result: PASS_RESULT }; } });
  const first = await runAuditOnce(options);
  const second = await runAuditOnce(options);

  assert.equal(first.status, 'audited');
  assert.equal(second.status, 'skipped');
  assert.equal(calls, 1);
});

test('HEAD가 바뀌면 같은 지시서·보고서라도 다시 감리한다', async () => {
  const fx = await fixture();
  let calls = 0;
  const invokeAudit = async () => { calls += 1; return { result: PASS_RESULT }; };
  await runAuditOnce(baseOptions(fx, { invokeAudit }));
  const moved = { ...GIT, head: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' };
  const result = await runAuditOnce(baseOptions(fx, { invokeAudit, snapshot: async () => moved }));

  assert.equal(result.status, 'audited');
  assert.equal(calls, 2);
  assert.notEqual(
    computeTriggerKey({ head: GIT.head, instructionHash: 'x', reportHash: 'y' }),
    computeTriggerKey({ head: moved.head, instructionHash: 'x', reportHash: 'y' }),
  );
});

test('REPORT 내용이 바뀌면 다시 감리한다', async () => {
  const fx = await fixture();
  let calls = 0;
  const invokeAudit = async () => { calls += 1; return { result: PASS_RESULT }; };
  await runAuditOnce(baseOptions(fx, { invokeAudit }));
  await writeFile(path.join(fx.relayDir, 'REPORT.md'), '# 보고\n\n수정 완료\n', 'utf8');
  const result = await runAuditOnce(baseOptions(fx, { invokeAudit }));

  assert.equal(result.status, 'audited');
  assert.equal(calls, 2);
});

test('Claude 호출 실패는 실패로 남고 대상은 그대로다', async () => {
  const fx = await fixture();
  const before = await snapshotTree(fx.target);
  await assert.rejects(
    () => runAuditOnce(baseOptions(fx, { invokeAudit: async () => { throw new Error('Claude 종료 코드 1'); } })),
    /Claude 종료 코드 1/,
  );
  assert.deepEqual(await snapshotTree(fx.target), before);

  const state = JSON.parse(await readFile(path.join(fx.runtimeDir, 'state', 'sync-relay.json'), 'utf8'));
  assert.equal(state.status, 'failed');
  assert.match(state.error, /Claude 종료 코드 1/);
  const inbox = await readdir(path.join(fx.runtimeDir, 'inbox'));
  assert.equal(inbox.filter((name) => name.endsWith('-FAILED.md')).length, 1);
});

test('지문은 같은 트리에서 안정적이고 추적 파일 수정을 잡아낸다', async () => {
  const { root } = await gitFixture();
  const first = await targetFingerprint(root);
  assert.equal((await targetFingerprint(root)).digest, first.digest);

  await writeFile(path.join(root, '추적됨.md'), '바뀜\n', 'utf8');
  const modified = await targetFingerprint(root);
  assert.notEqual(modified.digest, first.digest);
  assert.notEqual(modified.diffHash, first.diffHash);
  assert.throws(() => assertUnchanged(first, modified), /shadow 계약 위반/);
});

test('지문은 이미 dirty 한 파일의 추가 변경과 한글 미추적 파일도 잡아낸다', async () => {
  const { root } = await gitFixture();
  await writeFile(path.join(root, '추적됨.md'), '1차 수정\n', 'utf8');
  const dirty = await targetFingerprint(root);

  // status 문자열은 " M 추적됨.md" 로 동일하지만 내용이 달라졌다.
  await writeFile(path.join(root, '추적됨.md'), '2차 수정\n', 'utf8');
  const dirtier = await targetFingerprint(root);
  assert.equal(dirtier.statusHash, dirty.statusHash);
  assert.notEqual(dirtier.digest, dirty.digest);

  await writeFile(path.join(root, '새-보고서.md'), '보고\n', 'utf8');
  const withUntracked = await targetFingerprint(root);
  assert.equal(withUntracked.untrackedCount, 1);
  assert.notEqual(withUntracked.digest, dirtier.digest);

  // 미추적 파일의 내용만 바뀌어도(경로 목록은 그대로) 잡힌다.
  await writeFile(path.join(root, '새-보고서.md'), '보고 수정\n', 'utf8');
  const editedUntracked = await targetFingerprint(root);
  assert.equal(editedUntracked.untrackedCount, 1);
  assert.notEqual(editedUntracked.untrackedHash, withUntracked.untrackedHash);
  assert.notEqual(editedUntracked.digest, withUntracked.digest);
});

test('감리 중 대상이 바뀌면 성공으로 기록하지 않는다', async () => {
  const fx = await fixture();
  let call = 0;
  await assert.rejects(
    () => runAuditOnce(baseOptions(fx, {
      // 감리 전/후 지문을 다르게 돌려준다 = actor 가 대상에 쓴 상황.
      fingerprint: async () => {
        call += 1;
        return call === 1 ? FINGERPRINT : { ...FINGERPRINT, digest: '0'.repeat(64), diffHash: '1'.repeat(64) };
      },
      invokeAudit: async () => ({ result: PASS_RESULT }),
    })),
    /shadow 계약 위반/,
  );

  const state = JSON.parse(await readFile(path.join(fx.runtimeDir, 'state', 'sync-relay.json'), 'utf8'));
  assert.equal(state.status, 'failed');
  assert.equal(await readdir(path.join(fx.runtimeDir, 'runs')).then((names) => names.length).catch(() => 0), 0);
});

test('BLOCK finding과 판정이 어긋나면 결과를 거부한다', async () => {
  const fx = await fixture();
  const bad = {
    verdict: 'PASS',
    summary: '모순',
    findings: [{ severity: 'BLOCK', title: 'x', detail: 'y', evidencePaths: [] }],
    next: [],
    requiresChiefDecision: false,
  };
  await assert.rejects(
    () => runAuditOnce(baseOptions(fx, { invokeAudit: async () => ({ result: bad }) })),
    /일치하지 않습니다/,
  );
});

// ── O-1R: 실행 시간 상한 ────────────────────────────────────────────────

test('상한을 넘긴 자식 프로세스는 종료되고 실패로 거부된다', async () => {
  // 스스로는 끝나지 않는 실제 자식 프로세스. 상한이 없으면 이 시험은 영원히 끝나지 않는다.
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const startedAt = Date.now();
  await assert.rejects(() => awaitClaudeChild(child, 700), (error) => {
    assert.match(error.message, /실행 시간 상한 초과/);
    assert.match(error.message, /한도 0\.0분/); // 상한값이 문구에 드러난다
    return true;
  });
  assert.ok(Date.now() - startedAt < 15_000, '상한 뒤 즉시 끝나야 한다');
  assert.equal(child.killed || child.exitCode !== null || child.signalCode !== null, true, '자식이 종료돼야 한다');
});

test('상한 안에 끝난 자식은 정상 판정으로 돌아온다', async () => {
  const payload = JSON.stringify({ structured_output: PASS_RESULT }).replaceAll('"', '\\"');
  const child = spawn(process.execPath, ['-e', `process.stdout.write("${payload}")`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const response = await awaitClaudeChild(child, 30_000);
  assert.equal(response.result.verdict, 'PASS');
});

test('--claude-timeout-ms 파싱과 하한을 강제한다', () => {
  const parsed = parseCli(['once', '--target', 'C:/tmp/x', '--claude-timeout-ms', '120000']);
  assert.equal(parsed.claudeTimeoutMs, 120_000);
  assert.throws(() => parseCli(['once', '--target', 'C:/tmp/x', '--claude-timeout-ms', '59999']), /60000 이상/);
  assert.throws(() => parseCli(['once', '--target', 'C:/tmp/x', '--claude-timeout-ms', 'abc']), /60000 이상/);
  // 기본값은 45분이다.
  assert.equal(parseCli(['once', '--target', 'C:/tmp/x']).claudeTimeoutMs, 45 * 60_000);
});

// ── O-1R: stale lock 회수 ───────────────────────────────────────────────

test('lock 회수 판정 — 죽은 소유자·lease 만료·깨진 파일만 회수한다', () => {
  const now = Date.parse('2026-08-13T00:10:00.000Z');
  const leaseMs = 46 * 60_000;
  const lock = (pid, startedAt) => JSON.stringify({ pid, startedAt });

  // 살아 있고 lease 이내 → 절대 회수 금지 (중복 감리 방지의 핵심)
  const busy = evaluateLock(lock(4242, '2026-08-13T00:05:00.000Z'), { now, leaseMs, alive: () => true });
  assert.equal(busy.reclaim, false);
  assert.match(busy.reason, /실행 중\(pid 4242/);

  // 소유자 종료 → 회수
  const dead = evaluateLock(lock(4242, '2026-08-13T00:09:59.000Z'), { now, leaseMs, alive: () => false });
  assert.equal(dead.reclaim, true);
  assert.match(dead.reason, /소유자 종료\(pid 4242\)/);

  // 살아 있어도 lease 만료 → 회수 (PID 재사용 대비)
  const expired = evaluateLock(lock(4242, '2026-08-12T22:00:00.000Z'), { now, leaseMs, alive: () => true });
  assert.equal(expired.reclaim, true);
  assert.match(expired.reason, /lease 만료/);

  // 깨진 파일·필드 누락 → 회수
  assert.equal(evaluateLock('깨진 내용', { now, leaseMs, alive: () => true }).reclaim, true);
  assert.equal(evaluateLock('{"pid":"x"}', { now, leaseMs, alive: () => true }).reclaim, true);
});

test('isProcessAlive — 자기 자신은 살아 있고 없는 pid 는 죽었다', () => {
  assert.equal(isProcessAlive(process.pid), true);
  assert.equal(isProcessAlive(-1), false);
  assert.equal(isProcessAlive(undefined), false);
  // EPERM 은 「살아 있으나 권한 없음」이므로 살아 있는 것으로 본다.
  assert.equal(isProcessAlive(4242, () => { const e = new Error('perm'); e.code = 'EPERM'; throw e; }), true);
  assert.equal(isProcessAlive(4242, () => { const e = new Error('gone'); e.code = 'ESRCH'; throw e; }), false);
});

test('죽은 소유자의 lock 은 회수되고 감리가 진행된다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, JSON.stringify({ pid: 999_999, startedAt: new Date().toISOString() }), 'utf8');

  const result = await runAuditOnce(baseOptions(fx, {
    alive: () => false,
    invokeAudit: async () => ({ result: PASS_RESULT }),
  }));

  assert.equal(result.status, 'audited');
  assert.equal(existsSync(lockPath), false, '완료 후 lock 이 남으면 안 된다');
});

test('살아 있는 소유자의 lock 은 회수하지 않고 busy 로 남는다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  const held = JSON.stringify({ pid: 4242, startedAt: new Date().toISOString() });
  await writeFile(lockPath, held, 'utf8');

  let calls = 0;
  const result = await runAuditOnce(baseOptions(fx, {
    alive: () => true,
    invokeAudit: async () => { calls += 1; return { result: PASS_RESULT }; },
  }));

  assert.equal(result.status, 'busy');
  assert.match(result.reason, /실행 중\(pid 4242/);
  assert.equal(calls, 0, '진행 중인 감리와 동시에 두 번 돌면 안 된다');
  assert.equal(await readFile(lockPath, 'utf8'), held, '남의 lock 을 덮어쓰면 안 된다');
});

test('lease 를 넘긴 lock 은 소유자가 살아 있어도 회수된다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  const ancient = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
  await writeFile(lockPath, JSON.stringify({ pid: 4242, startedAt: ancient }), 'utf8');

  const result = await runAuditOnce(baseOptions(fx, {
    alive: () => true,
    invokeAudit: async () => ({ result: PASS_RESULT }),
  }));

  assert.equal(result.status, 'audited');
  assert.equal(existsSync(lockPath), false);
});

test('깨진 lock 파일은 회수된다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, '{{{ 깨진 JSON', 'utf8');

  const result = await runAuditOnce(baseOptions(fx, { invokeAudit: async () => ({ result: PASS_RESULT }) }));
  assert.equal(result.status, 'audited');
  assert.equal(existsSync(lockPath), false);
});

test('감리가 실패해도 lock 은 남지 않는다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await assert.rejects(
    () => runAuditOnce(baseOptions(fx, { invokeAudit: async () => { throw new Error('Claude 종료 코드 1'); } })),
    /Claude 종료 코드 1/,
  );
  assert.equal(existsSync(lockPath), false, '실패 경로에서도 lock 을 놓아야 한다');
});

// ── O-1R BLOCK 1: lock 소유권 ───────────────────────────────────────────

/** lock 파일에서 소유권 토큰을 꺼낸다. */
async function lockToken(lockPath) {
  return JSON.parse(await readFile(lockPath, 'utf8')).token;
}

const acquireLockForTest = (lockPath) => acquireLock(lockPath, { leaseMs: 60_000 });

test('회수 판정과 삭제 사이에 새 lock 이 생기면 그것을 지우지 않는다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  // 죽은 소유자의 lock — 회수 대상으로 판정된다.
  await writeFile(lockPath, JSON.stringify({ pid: 999_999, startedAt: new Date().toISOString(), token: 'stale' }), 'utf8');

  // 판정 직후·삭제 직전에 다른 watcher 가 lock 을 놓고 새로 잡은 상황을 끼워 넣는다.
  const newOwner = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), token: '새-소유자' });
  let calls = 0;
  const result = await runAuditOnce(baseOptions(fx, {
    alive: (pid) => pid === process.pid,
    onBeforeReclaim: async () => { await writeFile(lockPath, newOwner, 'utf8'); },
    invokeAudit: async () => { calls += 1; return { result: PASS_RESULT }; },
  }));

  assert.equal(result.status, 'busy');
  assert.match(result.reason, /회수 취소 — 다른 소유자의 lock/);
  assert.equal(calls, 0, '새 소유자와 동시에 감리하면 안 된다');
  assert.equal(await readFile(lockPath, 'utf8'), newOwner, '새 소유자의 lock 이 살아 있어야 한다');
});

test('이전 소유자의 늦은 release 는 새 소유자의 lock 을 지우지 않는다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });

  // 1) 정상 취득 — release 를 손에 쥔다.
  const first = await acquireLockForTest(lockPath);
  assert.ok(first.release);
  const firstToken = await lockToken(lockPath);

  // 2) 그 사이 새 소유자가 자리를 차지했다(이전 소유자는 아직 모른다).
  const newOwner = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), token: '새-소유자' });
  await writeFile(lockPath, newOwner, 'utf8');

  // 3) 이제야 도착한 이전 소유자의 release.
  const outcome = await first.release();
  assert.equal(outcome.released, false);
  assert.match(outcome.reason, /다른 소유자의 lock/);
  assert.equal(await readFile(lockPath, 'utf8'), newOwner, '남의 lock 을 지우면 안 된다');
  assert.notEqual(firstToken, '새-소유자');
});

test('내 lock 은 내 release 로 지워진다 (토큰 일치)', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  const held = await acquireLockForTest(lockPath);
  const outcome = await held.release();
  assert.equal(outcome.released, true);
  assert.equal(existsSync(lockPath), false);
});

test('removeLockIfSame — 내용이 다르면 지우지 않고 원위치시킨다', async () => {
  const fx = await fixture();
  const lockPath = path.join(fx.runtimeDir, 'locks', 'sync-relay.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, '남의-lock', 'utf8');

  const mismatch = await removeLockIfSame(lockPath, '내가-본-lock', 'test');
  assert.equal(mismatch.removed, false);
  assert.equal(await readFile(lockPath, 'utf8'), '남의-lock', '원위치돼야 한다');

  const match = await removeLockIfSame(lockPath, '남의-lock', 'test');
  assert.equal(match.removed, true);
  assert.equal(existsSync(lockPath), false);

  const gone = await removeLockIfSame(lockPath, '무엇이든', 'test');
  assert.equal(gone.removed, false);
  assert.match(gone.reason, /이미 없음/);
});

test('두 실행이 동시에 같은 trigger 를 감리하지 않는다', async () => {
  const fx = await fixture();
  let concurrent = 0;
  let maxConcurrent = 0;
  let calls = 0;
  const options = baseOptions(fx, {
    invokeAudit: async () => {
      calls += 1;
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 60));
      concurrent -= 1;
      return { result: PASS_RESULT };
    },
  });

  const [a, b] = await Promise.all([runAuditOnce(options), runAuditOnce(options)]);
  const statuses = [a.status, b.status].sort();

  assert.equal(maxConcurrent, 1, '동시에 두 감리가 돌면 안 된다');
  assert.equal(calls, 1);
  assert.deepEqual(statuses, ['audited', 'busy']);
});

// ── O-1R BLOCK 2: close 가 오지 않아도 종결 ─────────────────────────────

/** kill 신호를 무시하고 close 를 끝내 보내지 않는 자식 프로세스 흉내. */
function unresponsiveChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr.setEncoding = () => {};
  child.signals = [];
  child.kill = (signal) => { child.signals.push(signal); return true; };
  return child;
}

test('close 가 오지 않아도 상한+유예가 지나면 반드시 실패로 끝난다', async () => {
  const child = unresponsiveChild();
  const startedAt = Date.now();
  await assert.rejects(
    () => awaitClaudeChild(child, 100, { killGraceMs: 100, forceSettleMs: 100 }),
    (error) => {
      assert.match(error.message, /실행 시간 상한 초과/);
      assert.match(error.message, /응답하지 않아 대기를 포기/);
      return true;
    },
  );
  assert.ok(Date.now() - startedAt < 5_000, '매달리지 않고 끝나야 한다');
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL'], '두 신호를 순서대로 보냈어야 한다');
});

test('포기 후 뒤늦게 close 가 와도 결과가 뒤집히지 않는다', async () => {
  const child = unresponsiveChild();
  await assert.rejects(() => awaitClaudeChild(child, 60, { killGraceMs: 60, forceSettleMs: 60 }), /상한 초과/);
  // 이미 실패로 끝난 뒤 도착한 close — 성공으로 뒤집히면 안 된다(재-settle 금지).
  child.emit('close', 0);
  await new Promise((resolve) => setTimeout(resolve, 30));
});

test('상한 초과는 state=failed 와 FAILED.md 를 남긴다', async () => {
  const fx = await fixture();
  await assert.rejects(
    () => runAuditOnce(baseOptions(fx, {
      // 실제 상한 로직을 그대로 태운다 — 응답 없는 자식.
      invokeAudit: () => awaitClaudeChild(unresponsiveChild(), 60, { killGraceMs: 60, forceSettleMs: 60 }),
    })),
    /실행 시간 상한 초과/,
  );

  const state = JSON.parse(await readFile(path.join(fx.runtimeDir, 'state', 'sync-relay.json'), 'utf8'));
  assert.equal(state.status, 'failed');
  assert.match(state.error, /실행 시간 상한 초과/);

  const inbox = await readdir(path.join(fx.runtimeDir, 'inbox'));
  const failed = inbox.filter((name) => name.endsWith('-FAILED.md'));
  assert.equal(failed.length, 1);
  assert.match(await readFile(path.join(fx.runtimeDir, 'inbox', failed[0]), 'utf8'), /상한 초과/);

  // 부분 결과를 성공으로 채택하지 않았다.
  assert.equal(existsSync(path.join(fx.runtimeDir, 'runs')), false);
  assert.equal(existsSync(path.join(fx.runtimeDir, 'locks', 'sync-relay.lock')), false, 'lock 을 놓아야 한다');
});

test('사유 없는 WARNING·BLOCK 판정을 거부한다', async () => {
  const withoutReason = (verdict) => ({
    verdict,
    summary: '경고를 요약 산문에만 적었다.',
    findings: [],
    next: [],
    requiresChiefDecision: false,
  });
  assert.throws(() => validateAuditResult(withoutReason('WARNING')), /사유 없는 판정 금지/);
  assert.throws(() => validateAuditResult(withoutReason('BLOCK')), /사유 없는 판정 금지/);

  // BLOCK 인데 WARNING finding 만 있는 경우도 막는다.
  assert.throws(() => validateAuditResult({
    ...withoutReason('BLOCK'),
    findings: [{ severity: 'WARNING', title: 'x', detail: 'y', evidencePaths: [] }],
  }), /BLOCK finding 이 없습니다/);

  // PASS 인데 finding 을 남기는 경우도 막는다.
  assert.throws(() => validateAuditResult({
    ...withoutReason('PASS'),
    findings: [{ severity: 'WARNING', title: 'x', detail: 'y', evidencePaths: [] }],
  }), /PASS 판정에는/);

  assert.equal(validateAuditResult(PASS_RESULT).verdict, 'PASS');
});

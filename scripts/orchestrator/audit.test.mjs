import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertUnchanged,
  computeTriggerKey,
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

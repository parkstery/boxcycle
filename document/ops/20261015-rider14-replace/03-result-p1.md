# 결과 P1 — rider14 자산 스테이징 (바이트 복사)

| 항목 | 내용 |
|---|---|
| 일자 | 2026-10-15 (KST) |
| 담당 | Developer — OpenCode Muse Spark |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` (브랜치 `rider14-replace`) |
| 원본 | `C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20261015_01-s6-poly-drawcall-reduction` (읽기 전용, 미변경) |
| candidateId | `20261015-212136-df8de090` |

## 만든 파일

- `apps/web/scripts/rider-preserve/stage-rider14.mjs` (신규, Node 내장 모듈만: crypto/fs/path/url)

## 실행 명령과 exit code

| # | 명령 (작업 디렉터리 `apps/web`) | exit |
|---|---|---:|
| 1 | `node scripts/rider-preserve/stage-rider14.mjs --source "<R>"` | 0 |
| 2 | ① 같은 `--id 20261015-212136-df8de090` 로 두 번째 실행 (덮어쓰기 거부 시험) | 1 (`target exists, refusing to overwrite`) |
| 3 | ② `--source "C:\does-not-exist-rider14"` (없는 경로 시험) | 1 (`source read failed: ENOENT ... rider_s6_LOD0_meshopt.glb`) |
| 4 | `node --test scripts/rider-preserve/preserved-layer-contract.test.mjs` | 0 (5 pass / 0 fail) |
| 5 | `npx eslint scripts/rider-preserve/stage-rider14.mjs` | 0 (출력 없음) |

① 표준출력: `candidateId: 20261015-212136-df8de090` + 세 해시 각 한 줄 (아래 표와 동일).

## 해시 표

### 원본 3파일 (실행 전 = 실행 후, 불변)

| 파일 | SHA-256 | 크기 |
|---|---|---:|
| `R\out\rider_s6_LOD0_meshopt.glb` | `df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d` | 245,120 B |
| `R\source\guide-weights.json` | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` | 230,034 B |
| `R\source\roadcyclist_s6_wheelfix_merged.glb` | `aeefb4d246b815a2391cbf80c0778bfb80cc8f66fa09f7385684bba8d2c8bc70` | 1,980,872 B (Get-Item 실측 아님, 참고) |

### 복사본 (`candidates/20261015-212136-df8de090/`)

| 파일 | SHA-256 | 크기 |
|---|---|---:|
| `rider.glb` | `df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d` (원본과 동일) | 245,120 B |
| `guide-weights.json` | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` (원본과 동일) | 230,034 B |
| `candidate.json` | `9ed9ab5c9324035e5b242249e5a41b923c0b92e2a5f6b5232109bd792f3b79cd` | 1,008 B |

`candidate.json` 핵심: `schemaVersion 2`, `nickname/modelProfile "rider14"`, `stage APP_CUSTOM_LAYER_CANDIDATE`, `status APP_CANDIDATE_UNDER_REVIEW`, `stagedAtKst 2026-10-15T21:21:36+09:00`, `geometryEquivalentTo 20260921-041426-cd81398e`, `compression EXT_meshopt_compression+KHR_mesh_quantization`. 2칸 들여쓰기 + 끝 줄바꿈 확인.

### s5 폴더 (실행 전 = 실행 후, 불변)

| 파일 | SHA-256 | 크기 |
|---|---|---:|
| `candidates/20260921-041426-cd81398e/rider.glb` | `1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb` | 1,752,892 B |
| `candidates/20260921-041426-cd81398e/guide-weights.json` | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` | 230,034 B |
| `candidates/20260921-041426-cd81398e/candidate.json` | `ec527e2be69a4fc4da65bad7da253e133944e68458187194730f39ef0eeffef2` | 956 B |

## 실패 경로 시험 결과

- ① 동일 `--id` 재실행: `Error: target exists, refusing to overwrite: ...\candidates\20261015-212136-df8de090`, exit 1. 기존 폴더 내용 변경 없음.
- ② 존재하지 않는 `--source`: `Error: source read failed: ENOENT ...`, exit 1. `git status --short` 에 새 흔적 없음 (아래 출력이 ①·② 전후 동일하게 P1 산출물 + P0 벤치 파일만 표시).

## `git -C C:\20.HDev\boxcycle-rider14 status --short` 출력

```text
?? apps/web/public/rider/preserved/candidates/20261015-212136-df8de090/
?? apps/web/scripts/rider-preserve/rider-perf-bench.html
?? apps/web/scripts/rider-preserve/rider-perf-bench.run.mjs
?? apps/web/scripts/rider-preserve/rider-perf-bench.ts
?? apps/web/scripts/rider-preserve/stage-rider14.mjs
```

- `rider-perf-bench.*` 3건은 P0 에이전트 작업물로 손대지 않았음.
- commit·push·`npm install`·앱 코드 수정 없음. `src/**`·`config.ts`·기존 시험 미변경.

## 이상 사항

- 없음. 게이트 G1 충족: 복사본 GLB SHA = `df8de090…`, 가이드 = `136895c8…`, 업스트림 `aeefb4d2…` 불변, GLB 245,120 B, 계약 테스트 5/5 통과, ESLint 통과.
- 참고: 셸에서 `Get-FileHash` cmdlet을 쓸 수 없어 해시 계산은 전부 `node:crypto`로 수행함. PowerShell 인코딩 깨짐으로 보이는 오류 문구가 있었으나 결과와 무관.

# RESULT-22 — 검수 재작업 및 사용자 테스트 준비

담당: Cursor CLI · 지시: [21-task-review-rework-and-user-run.md](21-task-review-rework-and-user-run.md) · 시각: 2026-10-05  
상태: **REWORK_DONE_PENDING_REVIEW** · commit/push/배포 **없음**  
이전: [20 결과](20-result-common-display-implementation.md) **보존** (덮어쓰지 않음)

## 판정

| 항목 | 결과 |
|------|------|
| 1. harness = enqueue local self · peer-only drop · raw metrics | **수정·PASS** |
| 2. 중앙 frame renderTime · D0↔600 leave · MapView raw 덮어쓰기 | **수정·PASS** (soloLeave jump 0.11m) |
| 3. serverTimeline pause snap · wire 양자 self · axis reset | **수정** |
| 4. offset/jump/fs/legacy/stall/pause 특수 시나리오 | **실행·보고** (공통표시 주장 분리) |
| 5. 실제 app `tsc -b` · lint · RULES 성격 명시 | **PASS** |
| READY_FOR_REVIEW (제품 경로 게이트) | **후보** — Supervisor 검수. 브라우저 실주행은 사용자 안내로 위임 |

원시 JSON: [common-display-product-metrics.json](common-display-product-metrics.json)

## 1. 항목별 변경

### (1) harness / 제품 enqueue 일치

- `common-display-product-harness.mjs`: self 표본을 **pending 도착이 아니라 enqueue 직후** `pushSelfDisplaySample` (fanout과 동일).
- stall/oneWayStall: peer delivery만 drop, self는 계속.
- peer 거리는 `debugSnapshot` 0.1m 반올림 대신 `Registry.getRawDisplayDistM`.
- accel/pass 속도 = 거리 도함수 `truthSpeedAt`.
- 제품: `motionWireQuantize.ts` + self buffer에 wire 양자(0.1m/0.01mps) 적용.

### (2) 중앙 frame renderTime · leave · camera

- `ensureFrameDisplayRenderTimeMs`: self sample과 peer `step`이 **같은 frame renderTime** 소비(±8ms 재사용).
- serverTimeline peer는 `lockedRenderTimeMs`로 별도 entity catch-up 금지.
- `sampleLiveLngLat`: delay=0이어도 시계 전진 → D600→0 catch-up 유지; catch-up 중 버퍼 보간.
- MapView self-location: `sampleLiveLngLat` 있을 때 React `liveForMap`(raw HUD)로 `setLngLat` 덮어쓰기 안 함.
- companion flag: publication 전환·unmount에서 reset 유지; leave 시 `setCompanionDisplayActive(false)` 재확인(harness soloLeave).

### (3) pause / 양자 / 축 전환

- serverTimeline: paused/completed **newest 즉시 snap 제거** → timeline 보간·hold(0). legacy pause snap 계약 보존.
- ingest: serverTimeline↔legacy 전환 시 버퍼 비우고 rebase.
- clock discontinuity(≥5s): self buffer + common clock reset + `rebaseServerTimelineEntities` (PublicationSharedPresence 구독).

### (4) 특수 시나리오 (ε0/0 AFTER)

| 시나리오 | opposite | 주장 |
|----------|----------|------|
| pauseResume | 0 | pause를 server축 보간으로 처리한 제품 경로 재현 |
| stall | 0 | **정상 신뢰 주장 금지** (peer drop·외삽 한계) |
| oneWayStall | **0.398** | **FAIL이 아니라 한계 보고** — 한 방향만 끊기면 창 간 불일치 남음 |
| offsetNotReady | 0 | 공통표시 비주장(레거시/즉시) |
| fsOnly / legacyNoTsrv | 0 | 레거시 경로 — 공통표시 비주장 |
| clockJump | 0 (jumpM≈3.45 during rebase) | uncertain+rebase — 혼용 금지; 점프 구간 일치 주장 금지 |
| soloLeave | leave jump **0.11m** | D600→0 catch-up PASS |

### (5) typecheck / lint / RULES

| 명령 | exit | 비고 |
|------|------|------|
| `npx tsc -b` (`apps/web`, references 실제 검사) | **0** | 루트 `tsc -p` files[] 함정 회피 |
| eslint (변경 peerMotion·hook·Presence) | **0** | MapView 기존 hooks warning만(이번 diff 원인 아님) |
| `npm run test:rtdb-rules` | **0** 13/13 | **regex/필드 계약** — emulator rules eval 아님 |
| `npm run test:peer-spacing` | **0** | |
| `npm run test:peer-common-display` | **0** ~5.1s | |

**Rules 운영 주의:** 현행 배포 Rules에 `$other:false`가 없으면 optional `tSrv`가 클라이언트 encode만으로도 쓰일 수 있다. 「배포 전 반드시 거부」를 **단정하지 않음**. 로컬 계약 시험은 `database.rules.json` 텍스트·encode 필드 정합. 배포는 이번 지시 범위 밖.

## 2. BEFORE/AFTER (ε0/0, 제품 경로)

| 시나리오 | BEFORE opposite | AFTER opposite / excl |
|----------|-----------------|------------------------|
| gap1 | **1.0** | **0 / 0** |
| gap15, pass, accel, asym, pauseResume | (재실행) | **0 / 0** |

publish 횟수: 시나리오당 동일 주기(200ms). tSrv encode 증분: 기존과 동일 계열(~21B/encode, JSON 실측 필드).

## 3. 한계

1. oneWayStall·stall·clockJump 중 불일치는 **한계 보고** — 위치 오류 해결로 쓰지 않음.
2. 브라우저 2창 실주행은 사용자 절차로 위임(아래). 에이전트 브라우저 관측 미실행(지시19 상한·권한).
3. 현재 checkout은 focus-read 등 **타 작업 파일과 섞인 작업 트리** — 전용 clean worktree가 아님.
4. Rules/Hosting 배포 없음.
5. S3 static fixture known-fail 미반복.

## 4. 사용자 실행 안내 (검증된 경로)

> **주의:** 아래는 **현재 작업 checkout**이다. 다른 untracked/수정(focus-read 등)이 섞여 있다. 깨끗한 전용 worktree라고 부르지 않는다. 전용 checkout이 필요하면 Supervisor에게 `git worktree add` 제안을 요청.

| 항목 | 값 |
|------|-----|
| 절대 path | `C:\20.HDev\boxcycle` |
| 브랜치 | `fix/peer-spacing-jitter` |
| 앱 루트 | `C:\20.HDev\boxcycle\apps\web` |
| 환경 파일 | `.env` · `.env.local` · `.env.emulator` **존재 확인**(비밀 미출력) |
| 기본 URL | `http://127.0.0.1:5000/` (`npm run dev`) |
| 에뮬레이터 URL | `http://127.0.0.1:5002/` (`npm run dev:emulator`) |

### PowerShell

```powershell
cd C:\20.HDev\boxcycle\apps\web
# 선택 A — 운영 Firebase 연동 로컬 Vite
npm run dev
# 선택 B — 에뮬레이터 모드(포트 5002)
npm run dev:emulator
```

회귀(에이전트가 이미 돌림; 재확인 시):

```powershell
cd C:\20.HDev\boxcycle\apps\web
npx tsc -b
npm run test:rtdb-rules
npm run test:peer-spacing
npm run test:peer-common-display
```

### 두 창 같은 Trail (각 구간 10~15초)

1. **두 창 모두** 위 로컬 URL만 연다(프로덕션/다른 포트 혼용 금지). 하드 리로드(Ctrl+Shift+R)로 캐시 제거.
2. 동일 Trail 입장 → 동행 표시 확인(상대 라이더 보임).
3. **등속** 10~15초: 창 간 앞뒤 순서가 뒤집히지 않는지.
4. **속도 변화** 10~15초: 가속/감속 후에도 순서·간격이 한쪽으로만 튀지 않는지.
5. **정지/resume** 각 10~15초: 상대 정지 시 자기만 600ms 과거로 남고 peer가 newest로 순간 점프하지 않는지.
6. 기대: **맵 self·peer·카메라 ≈ 공통 600ms 과거**, **HUD 속도/거리 즉시**, **solo(상대 없음) 지연 0**.
7. 새 코드 확인: 두 창 주소가 같은 origin/포트이고, 한쪽만 옛 빌드(프로덕션)가 아닌지. DEV면 콘솔에 peer sync 로그가 같은 세션에서 보이는지로 교차 확인.

네트워크/배포 권한 없이 local Vite(+필요 시 emulator)로 충분. commit/push/deploy 하지 말 것.

## 5. Git

commit / push / merge / 배포: **하지 않음** (지시).

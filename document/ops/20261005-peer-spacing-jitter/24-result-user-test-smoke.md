# RESULT-24 — 사용자 테스트 진입 smoke

담당: Cursor CLI · 지시: [23-task-user-test-smoke.md](23-task-user-test-smoke.md) · 시각: 2026-10-05  
상태: **USER_TEST_SMOKE_DONE** · 제품 코드 변경 / commit / push / deploy **없음**  
이전: [22 재작업 결과](22-result-common-display-rework.md) **보존**

## 판정

| 항목 | 결과 |
|------|------|
| Vite HTTP + entry/module 컴파일 smoke | **PASS** (`127.0.0.1:5010`) |
| 사용자 안내 명령(루트 `npm run dev` + host/port/strictPort) | **작동 확인** |
| 브라우저 실주행 | **미실행** (지시) |
| 운영 완료 / 배포 승인 | **아님** |
| 정상 동행 개선 | 사용자 **사전 테스트 후보** (22 유지) |

## 1. 테스트 가능 경로

| 항목 | 값 |
|------|-----|
| path | `C:\20.HDev\boxcycle` (기존 checkout) |
| 브랜치 | `fix/peer-spacing-jitter` |
| 성격 | **전용 clean worktree 아님** — focus-read 등 타 작업 수정·untracked와 **혼재** |
| 환경 파일 | `apps/web/.env` · `.env.local` · `.env.emulator` 존재 확인(비밀 미출력) |

## 2. 확인된 command / URL / HTTP·compile

cwd: `C:\20.HDev\boxcycle`

```powershell
npm run dev -- --host 127.0.0.1 --port 5010 --strictPort
```

| 점검 | 결과 |
|------|------|
| 서버 ready | Vite v8.0.11 · ~373ms · `http://127.0.0.1:5010/` |
| `GET /` | **HTTP 200** · entry `/src/main.tsx` · `/@vite/client` |
| `GET /src/main.tsx` | **200** · `text/javascript` (transform 성공) |
| `GET /src/App.tsx` | **200** · `text/javascript` · ~326KB |
| `GET /@vite/client` | **200** |
| Vite 로그 컴파일 오류 | smoke 구간 **없음** |
| 종료 | 프로세스 clean stop · 포트 5010 해제 |

포트 충돌 없음(5010 사용). 충돌 시 기존 프로세스 종료하지 말고 `--port`만 바꿔 재시도.

### 모드·Firebase

| 선택 | 명령(루트) | URL(이번 smoke 기준) | 데이터 |
|------|------------|----------------------|--------|
| **A (권장 사용자 사전 테스트)** | 위 `npm run dev -- --host 127.0.0.1 --port 5010 --strictPort` | `http://127.0.0.1:5010/` | **운영 Firebase** (`VITE_USE_EMULATOR` 미설정 · projectId `boxcycle-dc2df`). 로컬 URL이어도 **production 데이터**를 쓴다. |
| B 에뮬레이터 | `npm run dev:emulator` (기본 포트 보통 5002; 충돌 시 명시 port) | 해당 포트 | emulator 모드(`.env.emulator`의 `VITE_USE_EMULATOR=1`). **emulator 프로세스 기동 명령 없이 emulator만 안내하지 말 것** — Auth/Firestore/RTDB emulator가 떠 있어야 함. |

이번 smoke는 **선택 A만** 실행. emulator 스택은 기동하지 않음.

## 3. 사용자 절차 (검증된 진입)

1. 위 선택 A로 서버 기동 → `http://127.0.0.1:5010/` 만 사용(프로덕션 호스팅·다른 포트와 혼용 금지).
2. **서로 다른 브라우저 프로필 두 개**(또는 Chrome + Edge 등 독립 프로필). 같은 인증/세션을 공유하는 창만 쓰면 uid가 같아 동행 검증이 깨진다.
3. 각 프로필에서 게스트/별도 계정으로 로그인 → **동일 Trail** 입장 → 동행 표시 확인.
4. 관측(각 10~15초): 등속 · 속도 변화 · 정지/resume. 기대는 22 §4와 동일(맵 self·peer·카메라 ≈ 공통 600ms 과거, HUD 즉시, solo 지연 0).
5. commit / push / deploy 하지 말 것.

## 4. 남은 결함 · 미실행 (PASS로 이름 바꾸지 않음)

| 항목 | 상태 |
|------|------|
| oneWayStall **39.8%** | 남은 한계(22) — PASS 아님 |
| clockJump ≈ **3.45m** (rebase 구간) | 남은 한계(22) — PASS 아님 |
| 정상 후보 test gate | **순서만** 검사 — 상대 간격 오차·peer 점프 수치 게이트 **아님** |
| queue / coalescing 실비행 | **미실행** (이 단계·수정 없는 전체 반복 금지) |
| route 전환 | **미실행** |
| ±30s 기기 skew | **미실행** |
| 브라우저 2창 실주행 관측 | **미실행** (사용자 위임) |
| Rules/Hosting 배포 | **없음** |

수정 없는 harness/전체 시나리오 재실행은 지시대로 **하지 않음**.

## 5. Git

제품 코드·문서 외 ops 결과만 추가. commit / push / merge / 배포: **하지 않음**.

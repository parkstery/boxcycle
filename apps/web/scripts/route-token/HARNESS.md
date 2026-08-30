# route-token 하네스 — Route Token 정상 호출 경로 검증 (ROUTE-TOKEN-1 / 1R)

`apps/web/scripts/route-token/` 은 **일반 Route 생성 시 Route Token 차감·멱등·provider 실패 환불**을
운영 Firebase 없이 증명하는 하네스다. 자동 Route(`feat/distance-based-auto-route`)와 **분리**된 검증 기반이다.

## 검증 계약 (1단계)

| 순서 | 요청 | 기대 | balance | `route_generate -1` 누적 | provider 누적 |
|---:|---|---|---:|---:|---:|
| 0 | Guest 온보딩 | 성공 | 3 | 0 | 0 |
| 1~3 | 일반 Route | 성공 | 2→1→0 | 1→2→3 | 1→2→3 |
| 4 | 일반 Route | `RESOURCE_EXHAUSTED` | 0 | 3 | 3 (호출 없음) |

추가:

- 온보딩 재시도: balance 3, onboarding ledger 1건
- 동일 `requestId` 재시도: 추가 차감 없음
- provider 의도 실패: 순 balance 변화 0, 동일 `requestId` 재시도 시 추가 차감 없음

## 격리 경로 (1R)

```text
route-token-contract.mjs
  → Auth Emulator (9099)
  → Firestore Emulator (8080)
  → Functions Emulator (5001) — entry: lib/index.harness.js (runner 가 일시 패치)
      getMapboxDirections / ensureRouteTokenOnboardingHttp
      → harnessFakeMapbox (아래 3조건 AND 일 때만)
```

### Harness 활성화 (fail-closed, 3조건 AND)

```text
FUNCTIONS_EMULATOR === "true"
AND projectId === "demo-rtw-route-token"
AND RTW_ROUTE_TOKEN_HARNESS === "1"
```

판정 순수 함수: `functions/src/harnessActive.ts` → `resolveHarnessActive(env)`

### 운영 배포 표면

- `functions/src/index.ts` / `lib/index.js` — **`routeTokenHarnessControl` 없음**
- `functions/src/index.harness.ts` / `lib/index.harness.js` — Emulator runner 전용 (+control)
- 운영 유사 discovery 에서 control 미발견: `production-surface.test.mjs`

### Secret Manager·Directions 외부 접근

- runner 가 `functions/.secret.local` placeholder 를 **임시 생성**(기존 파일 있으면 즉시 실패) → `finally` 삭제
- 금지 로그 패턴: `secretmanager.googleapis.com`, `Trying to access secret`, `MAPBOX_ACCESS_TOKEN@latest`
- 브라우저 `/directions/v5/` 직접 호출 0건 (지도 타일 pk. 는 허용)

## 포트

| 서비스 | 포트 |
|---|---:|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| UI smoke Vite (`RTW_DEV_PORT`) | 5010 |

## 실행

저장소 루트에서 (또는 `apps/web`):

```powershell
npm -w boxcycle-web run test:route-token
```

내부 동작 (`run-route-token-harness.mjs`):

1. `functions` build
2. 단위 시험: `harness-active`, `isolation-guards`, `production-surface`
3. `functions/.secret.local` placeholder + `package.json` main → `lib/index.harness.js` (finally 복구)
4. `firebase emulators:exec` + `route-token-contract.mjs`
5. UI smoke Playwright (`ROUTE_TOKEN_UI_LIVE=1`, `--mode harness`, `.env.harness`)

**전제:** JDK 11+, `firebase-tools`, `functions` 의존성 설치. UI smoke 지도 타일용 pk. 는 `apps/web/.env` 또는 형제 worktree `boxcycle/apps/web/.env` 에서 **읽기만** 한다.

개인 `apps/web/.env.local`·`functions/.secret.local` 은 **덮어쓰지 않는다**.

## 파일

| 파일 | 역할 |
|---|---|
| `run-route-token-harness.mjs` | build·단위시험·Emulator·UI smoke 오케스트레이션 |
| `route-token-contract.mjs` | balance·ledger·provider 호출 수 자동 검증 |
| `harness-active.test.mjs` | 활성화 진리표 (§3.4) |
| `isolation-guards.test.mjs` | runner 가드 부정 조건 |
| `production-surface.test.mjs` | 운영 export 에 control 없음 |
| `read-mapbox-pk.mjs` | UI smoke 지도 pk. (읽기 전용) |
| `harness-config.mjs` | project·URL 상수 |
| `emulator-guard.mjs` | Emulator·직접호출 OFF 가드 |
| `e2e/route-token-ui-smoke.spec.ts` | Guest 3회 경로 + 4번째 부족 UI |
| `.env.harness` | demo Emulator Vite env (git 추적) |
| `.out/emulator.log` | contract Emulator 로그 (Secret Manager 게이트) |
| `.out/ui-smoke-*.png` | UI smoke 스크린샷 |

## harness 제어 API (Emulator 전용)

`routeTokenHarnessControl` — **`index.harness` 에만 export**, 운영 `index` 에 없음.

- `{ action: "reset" }` — provider 호출 수 초기화
- `{ action: "stats" }` — `{ providerCallCount }`
- `{ action: "setFailNext", fail: true }` — 다음 Directions 1회 실패
- `{ action: "inspectUser", uid }` — balance·ledger·route_generate 차감 건수

운영 project (`boxcycle-dc2df`) 로 control 호출 시 **404** — contract 에서 검증.

## 성공 출력 예시

```text
=== ROUTE-TOKEN-1 통과표 ===
| step | result | balance | route_generate -1 | provider |
| 0 onboarding | ok | 3 | 0 | 0 |
| 1 route | ok | 2 | 1 | 1 |
...
[route-token] emulator log gate PASS (no Secret Manager / Mapbox secret fetch)
[route-token] ROUTE-TOKEN-1R harness PASS
```

## 미구현 (2단계 이후)

- 자동 Route 1회 = Token 1회 server transaction
- Matrix 후보 평가
- staging·실 Mapbox 통합
- UI/E2E 전체 회귀

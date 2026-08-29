# route-token 하네스 — Route Token 정상 호출 경로 검증 (ROUTE-TOKEN-1)

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

## 격리 경로

```text
route-token-contract.mjs
  → Auth Emulator (9099)
  → Firestore Emulator (8080)
  → Functions Emulator (5001)
      getMapboxDirections / ensureRouteTokenOnboardingHttp
      → harnessFakeMapbox (RTW_ROUTE_TOKEN_HARNESS=1 일 때만)
```

- **demo project ID:** `demo-rtw-route-token` (운영 `boxcycle-dc2df` 와 분리)
- **직접 호출 OFF:** `VITE_DIRECTIONS_DIRECT` 미설정 또는 `0`
- Emulator env (`FIRESTORE_EMULATOR_HOST` 등) 없으면 **즉시 실패** — 운영 fallback 없음
- 가짜 Mapbox는 `FUNCTIONS_EMULATOR=true` **그리고** `RTW_ROUTE_TOKEN_HARNESS=1` 일 때만 활성
- 브라우저·요청 본문으로 가짜 provider 를 켤 수 없음

## 포트

| 서비스 | 포트 |
|---|---:|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Emulator UI | (firebase 기본) |

## 실행

저장소 루트에서 (또는 `apps/web`):

```powershell
npm -w boxcycle-web run test:route-token
```

내부 동작:

1. `run-route-token-harness.mjs` 가 `RTW_ROUTE_TOKEN_HARNESS=1` 을 주입
2. `firebase emulators:exec --only auth,firestore,functions --project demo-rtw-route-token`
3. `route-token-contract.mjs` 계약 실행

**전제:** JDK 11+, `firebase-tools`, `functions` 의존성 설치(`npm install` at repo root).

개인 `apps/web/.env.local` 은 건드리지 않는다. harness 는 자체 env 만 사용한다.

## 파일

| 파일 | 역할 |
|---|---|
| `run-route-token-harness.mjs` | Emulator 기동 + env 고정 |
| `route-token-contract.mjs` | balance·ledger·provider 호출 수 자동 검증 |
| `harness-config.mjs` | project·URL 상수 |
| `emulator-guard.mjs` | Emulator·직접호출 OFF 가드 |

## harness 제어 API (Emulator 전용)

`routeTokenHarnessControl` — 운영·일반 dev 에서는 **404**.

- `{ action: "reset" }` — provider 호출 수 초기화
- `{ action: "stats" }` — `{ providerCallCount }`
- `{ action: "setFailNext", fail: true }` — 다음 Directions 1회 실패
- `{ action: "inspectUser", uid }` — balance·ledger·route_generate 차감 건수

## 성공 출력 예시

```text
=== ROUTE-TOKEN-1 통과표 ===
| step | result | balance | route_generate -1 | provider |
| 0 onboarding | ok | 3 | 0 | 0 |
| 1 route | ok | 2 | 1 | 1 |
...
[route-token] ROUTE-TOKEN-1 contract PASS
```

## UI smoke (수동, 1회)

자동 계약 통과 후:

1. Emulator 동일 project 로 앱 기동 (`VITE_USE_EMULATOR=1`, `VITE_DIRECTIONS_DIRECT` 없음)
2. 새 Guest → 일반 Route 3회 성공 → 4번째 Token 부족 UI
3. Network 탭: `api.mapbox.com` 직접 요청 0건

UI 문구·진입 흐름은 이번 단계에서 수정하지 않는다.

## 미구현 (2단계 이후)

- 자동 Route 1회 = Token 1회 server transaction
- Matrix 후보 평가
- staging·실 Mapbox 통합
- UI/E2E 전체 회귀

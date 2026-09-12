# RIDE-IN-RIDE-HIERARCHY-3 시도 1 재작업 보고

| 항목 | 내용 |
|---|---|
| 작업 ID | `RIDE-IN-RIDE-HIERARCHY-3` |
| PR | [#17](https://github.com/parkstery/boxcycle/pull/17) |
| 시도 | **1 → 2 제출** (수퍼바이저 FAIL 1/3 후 재작업) |
| 상태 | **재검수 대기** — PASS 전 「완료」 아님 |

## 재작업 내용

| ID | 조치 | 증거 |
|---|---|---|
| H2 | `routeDockUiPolicy.ts` 추출 · `RouteDock.tsx` 사용 | 아래 §H2 |
| H1 | `npm run test:e2e:ride` | **6 passed / 0 fail** · ~82.7s (2026-09-13) |
| H3 | `e2e/ride-hierarchy-narrow.spec.ts` (690×275) | **2 passed** · 스크린샷 2장 |

## H2

- 모듈: `apps/web/src/lib/routeDockUiPolicy.ts` — `export function routeDockUiPolicy(...)`
- 소비: `apps/web/src/components/route-dock/RouteDock.tsx` — `import { routeDockUiPolicy } from "../../lib/routeDockUiPolicy"`
- 테스트: `scripts/ride-hierarchy/route-dock-riding-contract.test.ts` — `import { routeDockUiPolicy } from "../../src/lib/routeDockUiPolicy.ts"` (테스트 내 정책 복제 없음)

## H1

```
npm run test:e2e:ride
→ 6 passed (56.5s) · exit 0
```

(에뮬레이터 e2e — `playwright.config.ts` 가 `.env` 실 Mapbox 토큰을 emulator dev 서버에 주입)

## H3

- Playwright: `e2e/ride-hierarchy-narrow.spec.ts` — ready-to-start Go·riding 일시정지/종료 `boundingBox` + `click({ trial: true })` 단언
- 스크린샷:
  - `document/archive/260913-ride-hierarchy-narrow-ready-to-start.png`
  - `document/archive/260913-ride-hierarchy-narrow-riding.png`

## 6A

main2 미반영 — 센서 칩 이동 없음.

## 남은 결함

- 없음(재검수 대기). CI에 `.env` Mapbox 토큰 없으면 `playwright.config` 주입이 noop — emulator fake 토큰 환경 회귀 가능.

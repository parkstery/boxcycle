# 결과 29 — 묶음3 주행 결과·다음 주행 UI·UX

2026-10-24 · Cursor CLI · [지시28](28-task-batch3-summary-next.md)

## Supervisor 감리 — FAIL / 재지시30

Codex가 after800×360·667×300 캡처를 직접 확인. 판만 넓고 글자·숫자가 작은 채 남았으며 왼쪽 중첩 박스·가운데 모인 보조 지표·빈 공간·NextRide 좁은 폭/버튼 두 줄이 시안과 품질 목적을 충족하지 못함. CSS 가로 규칙이 뒤의 기존 규칙에 덮이는 원인 확인. 화면 시험10건 통과와 별개로 **FAIL**. [재지시30](30-task-batch3-visual-rework.md)으로 실제 스타일·정보 위계·fixture 상태·callback 검증 보완 중. 아래 실행자 결과는 당시 보고로 보존하며 최종 승인 근거가 아님.

## 구현 요약

- **RideSummarySheet** — 가로 640px+·높이 280px+ 에서 중앙 흰 판(최대 740×324), 268px `surface-tint` 왼쪽(스토리·새 도로·진행) / 오른쪽(제목·순위·보조 지표 행·게스트·저장). 판 안 중첩 상자는 가로 판에서 제거(여백·구분선). `data-ridden-km`·`data-total-km`·저장 안 함=닫기·scrim·aria 계약 유지. props·도메인 로직·App.tsx 미변경.
- **NextRideCard** — kicker「다음 주행」·스토리 줄·이어달리기 시 멈춘 곳/남은 거리 facts·버튼 우측 정렬·시안 토큰 색. `onResume`/`onExtend`/`onShowOnMap`/`onDismiss` 조건 동일.
- **preview.tsx** — `nextride-resume`·`nextride-extend`·`variant=saving|progress-fail|closed`·`glance-summary` 게스트 CTA. 메모리 fixture만.
- **e2e** — `e2e/ui-redesign-batch3.spec.ts` (800/667/844·저장 상태·게스트·다음 주행·긴 지명).
- **증거** — `evidence/batch3/before-*`·`after-*`, [comparison-batch3.html](comparison-batch3.html).

## 보존·미수행

- git commit/push·HANDOFF/PROGRESS/결정로그·`npm run build`/dist·App.tsx·`.out/`·`cdbox.bat`·`15-entry-flight-metrics.json`·3000/5000/5040 프로세스 — 미건드림.
- 호스팅 배포·실앱 e2e 전체·Supervisor 무거운 게이트 — 위임.
- harness 에서 conquest hero 는 `serverRideId` 없으면 비움(허위 +N 없음).

## 검증

| 검증 | 실행 위치 | 명령 | 결과 |
|---|---|---|---|
| 타입 | `C:\20.HDev\boxcycle\apps\web` | `node ../../node_modules/typescript/bin/tsc -b --noEmit` | PASS |
| lint | 동일 | `node ../../node_modules/eslint/bin/eslint.js src/components/ride/RideSummarySheet.tsx src/components/ride/NextRideCard.tsx scripts/ui-800x360/preview.tsx e2e/ui-redesign-batch3.spec.ts` | PASS (css 파일은 eslint 대상 아님) |
| selector | 동일 | `node scripts/ride-verify/verify-selectors.mjs` | 19/19 PASS |
| 묶음3 e2e | 동일 | `$env:RTW_DEV_PORT='5020'; $env:BATCH3_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\batch3'; node ../../node_modules/@playwright/test/cli.js test ui-redesign-batch3 --workers=1 --retries=0` | **10/10 PASS** (약 15s). 종료 후 **5020** harness만 정리 |

## Chief 직접 확인

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness --strictPort
```

1. 주행 결과: http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=summary  
2. 게스트·닫기만: http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=glance-summary  
3. 다음 주행 이어달리기: http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=nextride-resume  
4. 끝점 연장: http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=nextride-extend  
5. 시안 비교: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3.html` (파일 열기)

확인 후 5020 서버만 종료.

## diff 범위 (제품)

- `apps/web/src/components/ride/RideSummarySheet.tsx` · `.css`
- `apps/web/src/components/ride/NextRideCard.tsx` · `.css`
- `apps/web/scripts/ui-800x360/preview.tsx`
- `apps/web/e2e/ui-redesign-batch3.spec.ts`
- `apps/web/scripts/next-ride/resume-slot-ui-fixture-main.tsx` — 잘못된 `onAbandonResume` prop 제거(기존 fixture 컴파일 복구)

## 남은 제한

- 실앱 지도 위 카드·결과 시트는 배포 후 Chief 확인. 좁은 세로 시트(640px 미만)는 기존 하단 시트 스택 유지.
- `ui-800x360.spec.ts` 전체 재실행은 Supervisor 범위.

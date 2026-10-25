# 결과 31 — 묶음3 감리 FAIL 보완 (화면·cascade·검증)

2026-10-24 · Cursor · [지시30](30-task-batch3-visual-rework.md) · [결과29](29-result-batch3-summary-next.md) 유지

## 원인·조치

| 감리 FAIL | 원인 | 조치 |
|---|---|---|
| 주행 결과 after — 낮은 판·10px 제목·중첩 hero·오른쪽 지표 뭉침 | `@media` 가로 판 규칙이 파일 앞쪽에 있고, 뒤의 `.conquest-hero`·`.progress`·`.substats` 기본 규칙이 덮음 | 가로 판 블록을 **파일 맨 끝**으로 이동·확장. hero/progress 배경·테두리 제거, 스토리 13px·제목 17px·substat 전폭 행·진행 26px, 판 `min-height` 324px(800 기준) |
| 다음 주행 — ~210px·버튼 두 줄·제목 중복 | `max-width`만으로 intrinsic 축소·kicker/제목 동문·프리뷰 `ready`+Go 겹침 | 카드 `width:320px`, 제목 「이어 가기」/「새 출발」, 스토리 12px 보조색, `멈춘 곳`에 경로명 폴백 제거, actions `nowrap`, nextride 프리뷰는 **stage/panel idle** |

## 변경 파일 (실제 diff)

- `apps/web/src/components/ride/RideSummarySheet.css` — cascade 재배치·가로 판 타이포·폼 버튼 높이
- `apps/web/src/components/ride/RideSummarySheet.tsx` — conquest 값 옆 `km` span (`.ride-summary__conquest-km`)
- `apps/web/src/components/ride/NextRideCard.tsx` · `.css` — 폭·타이포·멈춘 곳 사실·제목
- `apps/web/scripts/ui-800x360/preview.tsx` — nextride idle·`#batch3-next-ride-fixture` callback 카운터
- `apps/web/e2e/ui-redesign-batch3.spec.ts` — computed font-size·행 폭·카드 폭·버튼 한 줄·callback 단언, 형식-only 시험 제거
- `document/ops/20261023-ui-redesign/comparison-batch3.html` — final 캡처·FAIL 기록 나란히
- `document/ops/20261023-ui-redesign/evidence/batch3-final/*.png` — 최종 after (기존 `batch3/`·지시28 before 보존)

**미변경:** App.tsx·도메인 lib·props 인터페이스·git·HANDOFF/PROGRESS·build/dist·`.out/`·`15-entry-flight-metrics.json`

## 검증

| 항목 | 위치 | 명령 | 결과 |
|---|---|---|---|
| 타입 | `C:\20.HDev\boxcycle\apps\web` | `node ../../node_modules/typescript/bin/tsc -b --noEmit` | PASS |
| lint | 동일 | `node ../../node_modules/eslint/bin/eslint.js src/components/ride/RideSummarySheet.tsx src/components/ride/NextRideCard.tsx scripts/ui-800x360/preview.tsx e2e/ui-redesign-batch3.spec.ts` | PASS |
| selector 19 | 동일 | `node scripts/ride-verify/verify-selectors.mjs` | PASS |
| 묶음3 e2e | 동일 (5020 harness) | `$env:RTW_DEV_PORT='5020'; $env:BATCH3_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\batch3-final'; node ../../node_modules/@playwright/test/cli.js test ui-redesign-batch3 --workers=1 --retries=0` | **13/13 PASS** (`ui-redesign-batch3.spec.ts` 9 + `ui-redesign-batch3-conquest.spec.ts` 4) |
| 캡처 눈검 | `batch3-final/after-summary-800x360.png` 등 | Playwright 스크린 + IDE 이미지 확인 | 판 높이·왼쪽 단일 열·오른쪽 지표 행·다음 주행 320px·버튼 한 줄 |

### e2e가 읽는 스타일 (800×360 summary 예)

- `.ride-summary__story-headline` font-size 13px대
- `#ride-summary-title` ≥16px
- `.ride-summary__substat`(시간 행) 폭 ≥ detail 열 85%
- `.ride-summary__conquest-hero` background transparent
- nextride 카드 폭 280–340px, `#next-ride-title` ≥16px, 남은 거리 숫자 ≥20px, 버튼 top/bottom span ≤48px
- `data-resume-calls` / `data-map-calls` / `data-dismiss-calls` 클릭 후 1

### conquest 양수 한계

일반 `?state=summary` harness 는 서버 ride id 없어 conquest 숫자 비움(기존 정책). **64–72px +N** 은 `ui-redesign-batch3-conquest.spec.ts`·`after-summary-positive-*.png` 로만 검증(허위 +N 미삽입).

## Chief 확인

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness --strictPort
```

1. 주행 결과: http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=summary  
2. 다음 주행: http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=nextride-resume  
3. 비교 HTML: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3.html` (파일 열기)

확인 후 **본인이 띄운 5020만** 종료.

## 남은 제한

- 640px 미만 세로 시트 스택은 지시28과 동일(이번 보완은 가로 판).
- 실앱 지도 위 오버레이는 배포 후 Chief 확인.

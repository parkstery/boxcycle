# 감리 33 — 묶음3 최종 UI (Cursor, 읽기 전용)

| 항목 | 값 |
|---|---|
| 일시 | 2026-10-24 KST |
| 감리자 | Cursor Developer (읽기 전용) |
| 기준 | [지시28](28-task-batch3-summary-next.md)·[재지시30](30-task-batch3-visual-rework.md)·[Chief 고정 1~10](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md)·[공간밀도](../../../reference/product/260924-RTW-UI-공간밀도-원칙.md) |
| 검토 diff | `RideSummarySheet.tsx/.css`, `NextRideCard.tsx/.css` (+ 프리뷰·e2e는 계약 참고만) |
| 증거 | `evidence/batch3-final/*.png` (8장), 시안 `mockups/10-Summary.png`·`11-NextRide.png` |
| 자동 시험 | `ui-redesign-batch3` + `ui-redesign-batch3-conquest` **13/13 통과** (2026-10-24, `apps/web` 로컬) |

## 종합 판정

**PASS** — 재지시30에서 지적한 cascade·중첩 박스·오른쪽 지표 수축·NextRide 좁은 폭·버튼 두 줄 문제는 `batch3-final` 캡처와 diff에서 해소된 것으로 보인다. 800×360·667×300에서 위계·밀도·가독성이 시안10/11 및 지시 목표에 실질적으로 부합한다. 아래 **경미(LOW)** 항목은 품질 마감 후속 권장이며, 단독으로 FAIL 사유는 아니다.

Chief 고정 1~10·계정 패널·지도 조작·경로 목록은 diff 범위 밖이며 변경 없음.

---

## 1. RideSummarySheet

### PASS 근거 (800×360·667×300)

| 검수 항목 | 근거 |
|---|---|
| 판 크기·중앙 배치 | `after-summary-800x360.png`, `after-summary-667x300.png` — 흰 판이 뷰포트 중앙, 높이가 화면 대부분을 쓰며 하단 시트 느낌이 아님. e2e: `.ride-summary__sheet` 높이 ≤324px(800), ≥300px(800). |
| 2열 위계 (스토리·새 도로·진행 \| 결과·지표·저장) | `RideSummarySheet.tsx` `ride-summary__cols` 구조, `RideSummarySheet.css` L707+ `@media (min-width:640px) and (min-height:280px)` 가 **파일 하단**에 동일 선택자를 재정의 — 재지시30 cascade 요구 충족. |
| 중첩 박스 제거 | 캡처·e2e: `.ride-summary__conquest-hero` 배경 `transparent`. positive 캡처에서 새 도로 숫자만 강조, 테두리 카드 없음. |
| 새 도로 숫자 위계 | `after-summary-positive-800x360.png` — `+0.16 km` 대형·파랑, 진행은 좌하단 26px급. conquest e2e: `fontSize ≥ 60`. |
| 오른쪽 지표 한 줄·전폭 | 캡처: 시간/평균/칼로리 라벨 좌·값 우, 구분선. e2e: `substat` 행 너비 ≥ detail 열 85%. |
| 확인 중·0·실패 정책 | 기본 fixture `after-summary-*`: 「새 도로 확인 중…」, 양수 날조 없음. conquest spec: `confirmed_zero`·`error` 시 `.ride-summary__conquest-value` 0건. |
| 저장·닫기·data 속성 | e2e: adhoc 시 「내 경로로 저장」「저장 안 함」, `data-ridden-km`/`data-total-km` 유지; `variant=closed` 시 ✕만. `role="region" aria-label="주행 결과"`, `aria-labelledby="ride-summary-title"` 유지. |
| km 표기 | UI·aria에 소문자 `km` (Chief #8). |

### 시안10 대비 (의도적·데이터 차이)

- 시안 오른쪽 「경로」 행·「내 도로망 N km로 늘었어요」는 fixture/도메인 데이터에 없어 미표시 — 지시28 「허위 숫자·합계 금지」와 일치. 레이아웃 슬롯 문제 아님.
- 좌열 `#eef3fc` 톤은 시안10 좌패널과 동일 계열 — 「외곽 판 내 또 다른 카드」가 아니라 2열 분할면.

### 발견 사항

| # | 심각도 | 파일·근거 | 문제 | 수정안 |
|---|---|---|---|---|
| R1 | LOW | `RideSummarySheet.css` L811–815 `margin-block: auto` on `.ride-summary__conquest-hero`; `after-summary-800x360.png` | 정복 **확인 중**일 때 좌열 중앙에 작은 문구만 있고 상·하 여백이 큼. 재지시30 「불필요한 빈 공간」에 근접. | 확인 중·실패·0 상태는 `margin-block: 0` + 상단 정렬 또는 스토리 바로 아래 붙이기. positive만 `auto` 여백 허용 검토. |
| R2 | LOW | `RideSummarySheet.tsx` L574–576; `ui-redesign-batch3.spec.ts` L99 | 게스트 안내를 「로그아웃하면 사라짐」→「회원 등록하면…이어지고」로 교체. **행동**(`onGuestLinkGoogle`, `기록 지키기` group)은 유지. | Chief/콘템츠 승인 없으면 사실(게스트 소실) 한 줄을 보조 문구로 복원하거나 mockup10 문구에 맞춤. |
| R3 | LOW | `RideSummarySheet.css` L783–785 `@media … title-unit { display: none }` | 가로 판에서 제목 옆 `km` 단위 숨김. 진행·새 도로 열에는 km가 남아 D1은 부분 충족. | 제목에 작은 `km` 유지하거나, 숨길 경우 오른쪽 열 제목에 「(km)」 보조 표기 검토. |
| R4 | INFO | `after-summary-667x300.png` | adhoc 행: 경로 입력 + 저장 + 저장 안 함이 한 줄 — 667에서 다소 빽빽하나 잘림 없음. | 필요 시 입력 `flex:1 min-width:0`·버튼 `flex-shrink:0`만 재확인(현재 캡처상 PASS). |

---

## 2. NextRideCard

### PASS 근거 (800×360·667×300)

| 검수 항목 | 근거 |
|---|---|
| 카드 폭 ~320px | `NextRideCard.css` `width:320px`; `after-nextride-resume-800x360.png` / `667x300`. e2e: 카드 너비 280–340. |
| 제목 위계·중복 제거 | kicker 「다음 주행」 + title 「이어 가기」/「새 출발」; 구 「다음 주행 이어가기」 제거(e2e count 0). |
| 멈춘 곳·남은 거리 | facts 행, 남은 거리 22px급 파랑; 지명 없을 때 `마지막 종료 지점`(tsx L63–64, extend+long e2e). |
| 버튼 한 줄 | `flex-wrap: nowrap`; 캡처·e2e: 버튼 top/bottom span ≤48px. |
| 콜백 계약 | props `onResume`/`onExtend`/`onShowOnMap`/`onDismiss` 시그니처·조건 동일(tsx L119–147). e2e: `data-resume-calls`, `data-map-calls`, `data-dismiss-calls`. |
| 접근성 | `aria-label="다음 주행"`, `role="group" aria-labelledby="next-ride-title"`, dismiss `aria-label="다음 주행 숨기기"`. |

### 시안11 대비

- 시안 제목 문장형 vs 구현 「이어 가기」/「새 출발」 — 지시30·D6(2~4자 라벨)에 맞는 단축. 스토리 줄이 시안 역할 일부를 대체.
- resume 시 시안은 「지도에서 보기」+「여기에서 계속」; 구현은 「N%에서 이어 달리기」+「여기에서 계속」 — **기존 행동 보존**(지시28 #2).

### 발견 사항

| # | 심각도 | 파일·근거 | 문제 | 수정안 |
|---|---|---|---|---|
| N1 | LOW | `NextRideCard.tsx` L88–94; 이전 한 줄 UI | **이어달리기** 시 경로명(`view.route.name`)이 화면에 안 보이고 `title` 툴팁·지명(`stoppedLabel`)만 표시. 경로명≠지명일 때 어떤 경로인지 약화. | 지시30: 경로명은 별도 라벨(예: 「경로」) 한 줄, 말줄임; 「멈춘 곳」에는 지명/종료 지점만. |
| N2 | LOW | `NextRideCard.tsx` L81 `title="Hide"` | `aria-label`은 한국어인데 `title`만 영문. | `title="다음 주행 숨기기"` 또는 title 제거(aria만). |
| N3 | INFO | `evidence/batch3-final/after-nextride-extend-800x360.png`; `ui-redesign-batch3.spec.ts` L153–156 | 캡처가 **숨기기 클릭 후** 카드 제거 상태. extend UI 시각 증거 없음. | 스크린샷을 dismiss 전으로 옮기거나 `before-dismiss-extend` 별도 캡처. |

---

## 3. Chief 고정·범위·계약

| 항목 | 결과 |
|---|---|
| Chief #1~10 | 해당 컴포넌트 diff에서 미변경. **PASS** |
| props·도메인·App | `NextRideCardProps`·`RideSummarySheet` 공용 props 인터페이스 diff 없음(구조·문구·CSS). **PASS** |
| 기존 e2e 계약(참고) | `ride-summary-compact.spec.ts`는 뷰포트 **690×275** (`min-height:280` 미만) — 가로 판 미디어 미적용, `.ride-summary__title-unit` 「km」 단언 유지 가능. **800×360 전용 변경과 충돌 없음**(Supervisor 전체 게이트에서 한 번 더 확인 권장). |
| 프리뷰 | 재지시30: idle·RouteDock 공존 문제는 `batch3-final` resume 캡처에서 Go 버튼 없이 RouteDock만 보임 — 개선된 것으로 판단. |

---

## 4. 재지시30 FAIL 항목 대조

| FAIL 항목 (29/30) | batch3-final 상태 |
|---|---|
| 제목 ~10px·보조지표 오른쪽 한가운데 수축 | 제목 17px급, 지표 전폭 행 — **해소** |
| conquest/progress 중첩 박스·cascade | transparent·하단 @media — **해소** |
| NextRide ~210px·버튼 두 줄 | ~320px·한 줄 — **해소** |
| e2e가 폭만 검사 | computed fontSize·행 너비·callback data-* — **보완됨** |

---

## 5. Supervisor 후속 권장 (코드 변경 없음)

1. 결과31 작성 시 이 감리33을 첨부하고, R1·N1·N3은 선택 수정 또는 Chief 확인 후 **문서화만** 할지 결정.
2. `ride-summary-compact`·`ride-continue-phase-c` 등 **실앱** 게이트는 본 감리 범위 밖 — 배포 전 Supervisor 실행.
3. `comparison-batch3-final.html`이 최신 `batch3-final` 캡처를 반영했는지 HTML만 열어 대조(본 감리에서 HTML 미수정).

---

## 6. Chief 로컬 재확인 (선택)

실행 폴더: `C:\20.HDev\boxcycle\apps\web`

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness --strictPort
```

브라우저: `http://localhost:5020/scripts/ui-800x360/preview.html?state=summary` · `?state=summary&variant=positive`(conquest mock는 e2e와 동일) · `?state=nextride-resume` · `?state=nextride-extend`

증거 PNG: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\batch3-final\`

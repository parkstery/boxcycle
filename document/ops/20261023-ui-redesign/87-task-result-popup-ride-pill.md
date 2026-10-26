# 지시·결과 87 — 경로창 「▶ 주행」·「경로 삭제」 알약

2026-10-26 · Chief 직접 지시 · Supervisor Claude Code 직접 구현·감리·캡처

## 지시

> Chief: 「'주행 시작' 버튼과 '경로 삭제' 버튼의 이질감으로 인해 혼동을 줄 것 같다. 내가 이미지로 제시한 수정안의 방향의 변화를 줘 보자. 출발/종료, 거리/방향 모두 적용하자」

- Chief 시안: 맨 아래 줄 오른쪽에 `[▶(녹색 원) 주행]`·`[경로 삭제]` 두 흰 알약.

## 변경

- `mapPopupElements.ts`: 경로창 재생 버튼을 `map-view__pick-btn--start-ride`(녹색 원 아이콘 + 「주행」 글자)로. 화면 읽기 이름 「주행 시작」·`map-view__pick-start-ride` 클래스·동작(준비 전 비활성, 누르면 주행)은 그대로. 두 탭이 같은 줄(`profileBottomRow`)을 쓰므로 한 번에 적용.
- `RoutePickPopup.css`(묶음5 최종 스타일): 「주행」·「경로 삭제」 공통 흰 알약 — 높이 28px, 1px `#c9d0da` 테두리, 12px 굵은 글자, 간격 6px, 오른쪽 끝 정렬. 종전 「경로 삭제」 글자 링크 스타일과 재생 28px 원 고정 규칙을 대체. 우하단 44px 주행 버튼(고정 1)은 손대지 않음.
- 고정 목록 15 갱신(종전 `[▶ 녹색 재생] 경로 삭제` → `[▶ 주행] [경로 삭제]` 알약).

## 검증

| 항목 | 명령 | 결과 |
|---|---|---|
| 팝업 화면 시험 | `RTW_DEV_PORT=5020 npx playwright test route-media-controls route-ride-controls ui-redesign-batch5.spec.ts distance-direction-attention --workers=1 --retries=0`(증거 env 임시 폴더) | 46/46 PASS |
| 새 잠금 | `ui-redesign-batch5` 「Chief 고정15」 — 글자 「주행」, 아이콘 녹색, 두 알약 높이·테두리 같음·반원 모서리·간격 > 0 | PASS (첫 실행에서 「경로 삭제」 모서리 0 을 잡아 CSS 위치를 바로잡음) |
| 옛 계약 교체 | `route-media-controls`·`ui-redesign-batch5` 의 「재생 글자 없음·`--media-top`」 단언 → 새 모양 | Chief 지시로 교체 |
| 캡처 | `evidence/instruction87/after-*`(667×300·800×360·844×390, Start·End·거리·방향) | 시안과 같은 배치 |

비교 페이지: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-instruction86-87.html`

## 상태

LOCAL_VERIFIED / AWAITING_CHIEF_SCREEN — Chief 화면 확인 전 커밋·배포하지 않는다.

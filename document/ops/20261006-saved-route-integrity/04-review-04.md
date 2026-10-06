# 검수 04 — 「내 경로로 저장」 진행률 · 미완주 UI

- Supervisor: Claude · 판정: **A PASS / B REWORK_REQUIRED — Chief 결정 대기(AWAITING_CHIEF)**

## A — 저장 시 진행률 (PASS)
- `adhocSaveAsUserRoutePolicy.ts`: 완주→promote, 미완주→progress, dedupe 는 기존 정책 함수(낮추지 않음·완주 유지). 종료 시점 값 재사용(새 계산 없음). 단위 5/5, 사보타주 3 실패→원복 확인(결과 04).

## B — 「이어 달리기」 라벨 (REWORK)
- 재개 offset 은 **단일 이어달리기 슬롯의 활성 경로일 때만** 적용된다(`App.tsx` `resumeRatio`: `resumeSlotActiveRouteId !== resumeCandidateId → null`, 설계 §9.5.6).
- 결과 화면 저장 경로는 슬롯 확보 이벤트(`emitProgressApplied` → `ensureAcquired`)를 내지 않는다 → 슬롯 대상이 아니다.
- 따라서 슬롯이 아닌 미완주 경로에 「이어 달리기」를 띄우면 **실제로는 처음부터 시작** — 라벨이 거짓이 된다. 결과 04의 「재개 근거」(`loadedSavedRouteProgressRef`)는 종료 시 진행률 계산용이지 시작 offset 이 아니다.
- §9.5.6(오늘 Chief 결정 「대상 최대 1개, 다른 경로는 처음부터」)과 Chief 신규 요구(「완주 못 한 이어달리기 경로를 찾을 수 있어야」)가 충돌 → 재지시 전 Chief 결정 필요.

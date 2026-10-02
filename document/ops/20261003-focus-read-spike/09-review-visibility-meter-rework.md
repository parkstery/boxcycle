# Supervisor review — TASK-02R visibility meter

| 항목 | 내용 |
|---|---|
| 대상 | [07 재지시](07-task-visibility-meter-rework.md) · [08 결과](08-result-visibility-meter-rework.md) · 실제 diff·artifact |
| 판정 | **APPROVED — 최소 저감 구현 진행** |
| 날짜 | 2026-10-03 |

## 검수

- routeActivity batch invocation과 cache-miss 뒤 실제 `getDoc` proxy가 분리됐다. baseline ×10에서 invocation 10, getDoc 0으로 과계수가 제거됐다.
- visibility override subscribe/set은 production에서 no-op으로 고정됐다.
- Emulator N=3 시나리오에서 hidden→visible ×10의 `trailLiveRides` open/close 30/30이 별도 artifact로 측정됐다.
- focused 14/14, s42 15/15, dependency check, TypeScript, changed-file lint, Emulator E2E 2/2 PASS가 보고됐고 코드·artifact와 일치한다.

## 구현 우선순위

1. `routePublications` catalog query는 1회 호출이 최대 여러 문서 read이므로 성공 캐시 TTL과 in-flight dedup을 우선 적용한다. 명시적 사용자 새로고침은 force로 보존한다.
2. Activity World는 hidden 동안 poll을 멈추되 직전 성공 결과를 보존하고, freshness 기간 안에 복귀하면 즉시 full sync를 반복하지 않는다.
3. world `trailLiveRides × N` 재구독은 다음 단계에서 별도 visibility grace로 다룬다. 이번 구현과 섞지 않는다.

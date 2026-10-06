# 검수 03 — 퍼블릭 신청 지문 오거절

- Supervisor: Claude · 판정: **APPROVED** (배포 전 — Chief 실행 필요)

| 항목 | 판정 | 근거 |
|---|---|---|
| 저장 문서 geometry 로 지금 규칙 재계산 후 대조 | PASS | `savedRouteFingerprintMatch.ts` 직접 확인 |
| 신청 자체 지문 검사 유지 | PASS | diff 상 미변경 |
| 백필은 `routeFingerprint` 한 필드만 | PASS | `.update({ routeFingerprint })` |
| 백필 update 가 쿼터 가드를 깨우지 않음 | PASS | `savedRoutesTierQuotaGuard` 는 `onDocumentCreated` 전용 |
| 테스트 | PASS | Supervisor 재실행 `functions` `npm test` 42/42 |
| 사보타주(저장값 직접 비교로 되돌리면 (a) 실패) | PASS | 결과 03 기록 |

- 동작 변화 1건(수용): geometry 도 저장 지문도 없는 문서는 종전엔 대조 없이 통과, 이제 거절. 이런 문서는 앱 목록에서 이미 제외되므로(`fromDoc` geometry 필수) 실사용 영향 없음.
- 후속 후보(범위 밖, 결과 03 grep): publication backfill 계열이 옛 지문을 복사·신뢰한다. 별도 묶음에서 다룬다.
- 배포: 루트 `C:\20.HDev\boxcycle` 에서 `npm run deploy:functions`.

# Task06 감리 — REWORK_REQUIRED

수행 Cursor AI / 감리 Codex. 제품 코드 및 실제 시험 독립 확인.

- 자체20시험/build/selector19 PASS 보고는 확인대상. Supervisor 실제hook시험은 **행동3 PASS/1 FAIL**(상위 suite포함 tests5/pass3/fail2). 삭제 Guest reload가 SDK null알림을 먼저 내면 authExpiryKind가 null로 남음. 캐시정리도 생략될 수 있다. Task08으로 재지시.
- disabled Google local기록보존·pending UID노출차단·offline복구는 실제hook시험에서 PASS.
- 보고06의 lint15 '기존JS오류' 주장은 부정확. 초기gitstatus에 없던 source JS들이08:21에 일괄생성됨. Cursor 실행로그의 `npx tsc -b --pretty false --noEmit false`와 생성시각이 일치. 원래TS와 경쟁하는 generated JS를 정리하고 빌드·lint 재검증해야 함.
- 서버/Rules는 GLM Task07에 쓰기소유이관되어 Cursor 재작업과 병렬 진행. Google4/운영 데이터 미접근·추가삭제없음. 배포없음.

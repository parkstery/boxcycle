# Task09 중간 소스 검수 (완성본에서 재판정)

Codex. 운영변경없음.

- index.ts 경로 HTTP 내부 mergeUserAuthMeta catch가 아직 guard/string 일시코드만 throw하고 다른 오류는 로그 후 onboarding으로 진행한다. verifyUidForAdminHttp의 Auth확인 이후 manual Auth삭제 경합으로 mergeUserAuthMeta가 auth/user-not-found를 던지면 삼키고 users를 다시 만들 수 있다. **meta 실패 후 onboarding 계속진행을 제거**하라. 기존로그주장은 승인근거가 아니다. 모든 meta실패를 outercatch로 보내는 쪽이 단순하고 안전하다.
- Admin Firestore gRPC 오류 code는 숫자10(ABORTED)/14(UNAVAILABLE)/4(DEADLINE_EXCEEDED)일 수도 있다. transientStoreHttpsError는 문자열3개만 지원하므로 숫자는500 또는 위catch에서 삼켜진다. 숫자까지503으로 분류하고 시험하라.
- 실제HTTP+Auth emulator 요청시험은 이미 별도로PASS했으나 위의 '검증뒤 Auth삭제/metadata실패'는 독립 실패주입시험을 추가해야 한다. Supervisor script는 수정하지 않는다.
- 아직GLM09구현중이므로 완성본을 다시대조한 후 잔여가 있을때만 재작업한다.
- 후보목록 초안에는 openTrailListings.hostUid가 여전히 빠져 있다. `trails/{trailId}.hostUid`는 공용역사여서 제외하지만 **openTrailListings는 ACCOUNT_DELETION_POLICY의 delete대상**이므로 hostUid 후보에 포함해야 한다. 동일이름 hostUid라고 일괄제외하지 않는다.

## 실제 emulator 재검수

13:11 demo emulator: 13tests/9pass/4fail(부모포함). 기존 Admin 온보딩 tombstone·지연mileage 재생성 방지는PASS, traces/ledger/RTDB고아실제정리도 성공한후Googleprovider비교검증에서 실패.

- 제품잔여: metadata Auth user-not-found 실패주입 뒤 onboarding200+users재생성, numeric gRPC4=>503미분류. Task12 필수.
- 검증도구잔여: Google providerData 비교에서 한쪽undefined옵션필드 JSON정규화누락. Supervisor가 양쪽JSON정규화로 수정. 실제데이터변경결함으로 해석하지 않는다.
- 구글4보호fixture의 나머지3명 검증은 위도구오류로 아직도달하지못했으므로 다음재실행에서 확정.

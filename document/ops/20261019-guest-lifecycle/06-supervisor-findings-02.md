# 구현02 진행 중 독립 감리 — 배포 금지, 재작업 필요

검사 시점 2026-10-19 07:53 KST, 작성 Supervisor. Cursor 쓰기 소유는 유지하며 이 파일은 변경 지시를 위한 증거다. 아직 초안이므로 최종 결과라고 간주하지 않는다.

## 실행 증거

```powershell
Set-Location C:\20.HDev\boxcycle
node --experimental-strip-types --test scripts/guest-lifecycle-supervisor.test.mjs
```

exit1 / 4 FAIL. 실제 신규 guestLifecycleCore.ts의 exported core와 메모리 포트로 동작 재현. 운영 계정 접근 없음.

1. **P1: disabled Google 자동 활성화**. 등록·관리자·보호 UID 제외 분기에서 무조건 disabled=false로 변경한다. 관리자가 의도적으로 비활성화한 Google/Guest까지 일일 배치가 복구해 버린다. 이 작업이 직접 disable한 소유 표식과 이전 상태/세대가 확인될 때만 복구해야 한다. 기존 disabled/registered/protected 사용자에게는 어떤 Auth update도 하지 마라. completeGuestLink·purgeGuest·settleOne의 모든 re-enable 경로를 함께 고쳐라.
2. **P1: 임시 조회 오류로 정상 Guest 차단**. readDoc unavailable가 settleOne catch로 전달되면 삭제 예약도 하지 않은 uid에 RTDB block=true가 기록된다. 실패 표시는 해당 삭제 worker가 확정 예약을 소유한 뒤에만 쓸 수 있다. 예약 전 조회/등록 면제 갱신/활동 오류는 계정을 건드리지 말고 보고·재시도하라.
3. **P2: Google 연결 시작을 활동으로 갱신하지 않음**. beginGuestLinkLease에서 lastActivityAtMs가 과거 값으로 남는다. 명시적 연결 시작은 활동이므로 서버 now로 갱신해 popup이 2분 lease보다 오래 걸려도 30일 만료 배치에 다시 노출되지 않게 하라.

추가 검수 필요: setPipeline 반환 false 무시 후 deleteAccountData 실행되는 경로, 중복 sweep worker의 삭제 소유권, 삭제 상태와 Google 연결 완료의 fencing, profile/readUserProfile 오류가 전체 배치를 중단하는지, listProfileUids가 users 없는 개인 데이터·RTDB-only를 발견하는지. 재검사만으로 완전 원자성을 주장하지 마라. Memory 포트가 증명하지 못하는 실제 Rules/SDK 동작은 에뮬레이터로 검증한다.

## HTTP 초안 추가 검수

- guestLifecycleHttp.verifyToken은 catch 전체를 null→401로 바꾼다. Auth 서버 네트워크·일시 내부 오류까지 만료로 오판할 수 있으므로 영구 인증 오류만401, 일시 오류는503으로 구분하고 클라이언트는 상태를 보존해야 한다.
- rtdbOrNull 초기화 실패를 조용히 null로 바꾼다. Admin adapter에서 RTDB block을 생략하고 삭제를 계속하는 일이 없어야 한다. RTDB 쓰기 차단을 보장할 수 없으면 삭제 예약의 실패 재시도 상태로 남기고 데이터 삭제를 진행하지 않는 시험이 필요하다.

## Auth 부재 고아의 유예 분리

추가 회귀 시험: Auth가 이미 없고 Guest 개인 데이터만 남은 경우에는 신규 30일 관찰 유예를 주지 않는다. 30일 유예는 **Auth가 살아 있는** 기존 Guest의 활동 기준 부재를 보호하기 위한 것이다. Auth 부재가 확정된 Guest 고아는 다음 정리 주기에 처리해야 한다. 현재 settleOne은 둘을 같은 관찰 분기로 보내 30일 더 남긴다. Supervisor 시험 파일에 이 경우도 추가했다.

## 클라이언트 검수 기준

- Firebase persistence에 의한 기존 UID 복원과 `signInAnonymously`를 통한 새 계정 생성을 구분한다. 새 Guest 생성은 명시적 진입 버튼에서만 수행한다(기존 Chief 10-09 원칙과 정합). 삭제/토큰 오류가 SDK 내부 signOut→null 이벤트를 먼저 일으켜도, 예전 Guest 수락 플래그를 보고 새 Guest가 생성되지 않아야 한다. useAppAuth의 자동 signInAnonymously effect는 이 기준으로 정리한다.
- Google 연결 도중 활동 요청이 not-anonymous(등록 완료)로 응답하는 경우를 만료로 처리하지 않는다. 기존 Google 계정 충돌로 UID가 바뀌면 옛 Guest의 lease를 새 UID에 적용하지 않는다.

## Admin adapter 실제 검증 대상

Supervisor emulator 시험 `scripts/guest-rules-supervisor.test.mjs` 추가. REST 실제 익명 토큰으로 FS/RTDB 허용→차단·다른 활성사용자 계속 허용·삭제된Auth의 기존토큰 재쓰기 거부를 확인한다. 별도 subtest는 **rides-only orphan** 발견과 **RTDB-only orphan** 실제 삭제를 검증한다. 현재 listProfileUids가 users/userPrivate/livePresence/RTDB만 합치면 rides-only를 놓치며, deleteAccountData의 trailIdsForUid가 FS presence만 사용하면 RTDB-only motion을 지우지 못한다. 이 경우를 제품 adapter에서 보완해야 한다. Supervisor 시험 파일은 수정하지 말고 실행해라. 실행은 demo 프로젝트 에뮬레이터만 가능하도록 가드되어 있다.

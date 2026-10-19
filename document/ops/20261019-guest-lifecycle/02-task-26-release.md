# Task26 — Chief 승인 커밋·푸시·main2 병합·운영 배포

Chief 2026-10-19 지시: 커밋/푸시/병합/배포, 토큰 절약. 구현 완료 맥락을 가진 Supervisor가 직접 수행한다. 새 모델 재조사·중복시험은 생략하고 실제 Git 게이트와 배포검증을 실행한다.

범위: 검수된 Guest30일수명/종료세션보존/복원·Rules·연관Admin writer guard, 위치선택·Ready Ride 및 검수된 진입화면 브랜드 UI. 해당 ops/정책/결정근거 포함. AGENTS/CLAUDE, 별도 lint16시험정리, cdbox, 원본개인스냅샷/.out 임시파일은 제외한다. 기능과 함께 필요한 검수완료 진입화면은 포함한다고 Chief에게 고지했다.

Git: origin/main2와동일한 b6c9917에서 codex/guest-entry-release-20261019 생성. 명시선택 파일만 stage·게이트 통과·commit. 원격 최신확인 후 main2로병합(push). main은최종안정선규칙으로대상아님. 다른 dirty변경은보존한다.

배포: 커밋된 tree만 별도 임시 release 폴더에 추출해 빌드/배포, 현재dirty 전체를산출물에섞지않음. Firebase boxcycle-dc2df의 변경함수12종(getMapboxDirections/getDistanceAutoRoute/ensureRouteTokenOnboardingHttp/assertTierQuotaHttp/deleteAccountHttp/resetGuestHttp/guestActivityHttp/guestLinkHttp/guestLifecycleSweep/routeTokenOnRideCreated/conquestOnRideCreated/mileageOnRideCreated), Firestore/RTDB Rules, Hosting. 기존Mapboxsecret재사용·업무무관함수변경/삭제없음. 새guestLifecycleSweep매일KST03:15/삭제상한20·관찰상한100,30일미활동만·Google제외. 이스케줄은Chief의기존수명정책+이번배포지시로승인됨.

필수: functions127/lint·web최종build/변경lint·Git prepush전체게이트·실제demoHTTP/Rules/인증회귀·Git포함비밀검사. 운영읽기전용Google보존검사배포전후,Hostingbundlehash·HTTPpreflight·scheduler등록확인. 운영추가삭제/Guest생성시험없음. 실패는보고·좁게교정. 권한/인프라실패는실패명령과잔여구분.

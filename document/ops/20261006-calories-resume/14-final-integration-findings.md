# 最終 통합 검수 추가 필수사항

작성2026-10-06. 아래현재코드결함최종구현에해결필요.

1. App lastRideResult효과[ lastRideResult ]에서ensureAcquired즉시호출: result는savedRoute progressStatus pending으로먼저표시됨. 최초미완주A서버progress0인상태에서acquire실패(route_not_resumable)→progress쓰기가뒤에완료되면retry없음. result.savedRouteProgressStatus='success' (실제enum확인) 및slotready/init·동일UID조건시 pending새recordId를처리, 성공/영구점유/포기때만processed마커. 오류retry 짧은명시재시도, 무한poll금지. lastRideResult뒤에 update되는progress 상태로반드시재실행. user전환낡은lastresult초기화/uid캡처.
2. Guest withLocalSlotLock localstorage read/set+cas는atomic아님. tokenwrite둘겹치면양쪽획득·두routeTTLnull 가능. navigator.locks.request UID별 async exclusive 사용, 결과async/훅await+UIDguard. 미지원은안전한단일탭fallback명시또는busy반환, 단일slot동시획득성공을주장하지말라. storagewrite실패땐TTL먼저보호하고slot실패반쪽으로남기지말고rollback/실패처리. uid별route소유검증(기존globalroutes목록이유저필터된것인지조사)필수.
3. uid切替cleanup setSlot만으로첫렌더이전active노출될수있음. slot의ownerUid와현재uid가일치할때만active반환/효과Bootstrap,auth실제로변경될때이전비동기callback완전무효. 클라이언트준비중Go offset0으로시작시키지말고재개가능A로드중이면대기/준비안내.
4. clearIfActive tx는현재valid미완주route검증없이TT복원하고slot삭제. localstale완주/낡은delete가현재serverroute에대해valid이면clear거부. 서버존재/completed>=.98/geometry무효검증후해제. 서버삭제읽기권한거절은삭제라고오인금지. 별도expectedUidguard.

검증핵심은실제hook/App/newrecord progress write delay·UID·Guestlocks경쟁. pure조각PASS로갈음금지. 14는Supervisor근거이며새코드범위확장이아니라04/07/08필수경계누락보완.

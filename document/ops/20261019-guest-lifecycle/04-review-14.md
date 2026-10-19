# 실제 SDK 재접속 감리 — PASS

구현 Cursor Task11/13/14, 감리 Codex. SDK mocking 없는 실제 앱+Auth/Firestore/RTDB demo 에뮬레이터. 운영변경없음.

cwd C:\20.HDev\boxcycle

`node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs --lifecycle-only"`

exec38615 exit0, Playwright3/3 PASS(1.2분), 단일worker. ①명시Guest1·새로고침동일UID ②로그아웃계정/개인fixture보존·신규자동생성0 ③삭제후만료안내·새탭복구·옛문서재생성0·타UIDcache보존·명시시작때새UID1.

첫시도는fixture REST주소 오류, 두번째는RTDBquery auth=owner401. Task13/14에서공식REST와Authorization헤더로교정한뒤전원통과. Rules완화없음. 마지막GuestUID보조기록으로SDK가null복원하는경우도빈세션대기없이안내한다. 단순null만으로캐시삭제하지않음.

이는클라이언트재접속검수이며최종서버/운영배포승인이아니다. Google실기기팝업/Bluetooth는미실행.

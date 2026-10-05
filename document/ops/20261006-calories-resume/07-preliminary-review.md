# Supervisor 중간 검수 — 최종 승인 전 필수 확인

작성: 2026-10-06. 상태: 검수 메모(작성중 초안, 최종판정 아님). 04 지시 범위.

현재 작성된 초안에서 다음 경계를 확인했다. 최종 Cursor 결과에서 수정/검증 여부를 대조해야 한다.

- firestore tx bootstrap/acquire는 completed뿐 아니라 progress>0<.98·geometry·owner 검증. initialized 전이가 no-op인데 TTL을 null로 바꾸고 ok:true 반환하면 잘못된 보호/성공. 단일slot이실제획득됐을때만TTL변경.
- abandon은 expected active routeId가 필요. 오래된A 종료요청이 현재B를포기시킬수없게 조건부. clearIfActive도 route 실제무효를확인(호출부임의clear로TTL보호고아남지않게).
- onSnapshot error가무시되고10초후 errorMessage를ready에도표시하는초안. 실제error callback과snapshot성공후timeout취소/uid guard, 비동기작업결과와 catch를짧은UI에반영해야함.
- bootstrap은 slot서버ready전에 localempty로쓰기시도 금지. loaded/error구분·savedRoutes/recentSessions 변화 dependency·계정전환후이전uid콜백금지.
- auto acquire가과거모든미완주route중첫번째를택하면 명시포기뒤다른옛B가자동슬롯이됨. new meaningful ride 이벤트/processed marker만허용. 이름변경 updatedAt이새주행으로오인되어포기A재확보금지.
- completed/삭제/진짜geometry불능clear 필요. loaded성공의빈목록과조회실패빈목록을구분. 서버거짓cached missing으로clear금지. 서버transaction route검증.
- Guest uid별slot키만분리해도기존global savedRoutesLocal로다른UIDroute가섞일수있음. 기존local정책/소유확인. localread→write 경쟁은cross-tab배타획득(lock/최소대안) 및TTL/슬롯부분실패보완.
- B20%가activeA중record로남아도카드/내경로/최근/Gooffset모두blocked. A실서버progress반영전slotacquire실패후재시도. historyeviction재개view의운동시간/거리조작금지.
- UI경고/기회해제/슬롯readyguard·필수hook/tx회귀는실행증거로검증. pure정책만PASS는배선검증을대체하지않음.

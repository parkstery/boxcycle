# 최종 검수47 — 미니맵 유지 / 주행 설정 창 정리

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief: Muse한도가유지되어Cursor사용, 남은디자인UI코드·CSS·지시의외부전달명시승인. 기본도구는Muse Spark이고한도시Cursor교대라는규칙유지. 지시46→결과46→selector재지시47→결과47→본독립검수. 코드 `c6b230e`(face-redesign2). 이전51866a5시작안내·다음주행카드보존.

## 완료 범위

- 미니맵은기존구현을검증하고현상유지. 임의축소/새토글/정지지도요청정책변경없음. 실제RouteMinimap+RouteDock, 4viewport×접힘/펼침×주행/일시정지=16상태. 왼쪽정렬·최소8px간격·모의HUD와겹침없음·화면내표시·경로/현재위치·pointer차단·비주행미표시PASS. [계측](minimap-46-results.json)·[캡처](minimap-46.png).
- 주행설정은RideSettingsSheet.css끝에22줄추가만. `.ride-settings-sheet[aria-label="주행 설정"]`하위로한정. 폭32rem,내용높이/가용높이상한,패딩/간격정리,장식핸들제거. 체중+강도가한줄에들어가고설명·표시옵션을확인하기쉬워짐.
- 외곽panel간격0.4rem과본문ride-settings-panel그룹간격0.55rem을구분. 결과46의선택자오해는실제diff검수로발견하여재지시47에서한줄정정. 결과46자체평가를그대로승인하지않음.
- 기존CSS원본prefix동일,다른앱파일diff0. NextRideCard두파일SHA256동일. 입력·chip·checkbox의전후크기/font/disabled상태·본문문구동일.

## Supervisor 실행·계측

- `node document/ops/20261013-face-redesign2/minimap-46-qa.cjs`: exit0,16상태,pageerror0.
- `node document/ops/20261013-face-redesign2/settings-46-qa.cjs`: exit0,4viewport×rich/simple/BGM미설정/고도로딩=16상태. 실제RideSettingsSheet/Panel. [계측](settings-46-results.json)·[캡처](settings-46.png).
- 모든설정상태가가로/세로스크롤0이며화면안에표시. rich기준667/740/844폰에서폭297→432px,높이193.75→172.58px(약11%감소). PC폭352→512px,높이217.55→192.45px. 원래상태는일부로딩화면에서스크롤이필요했음.
- 코칭/TTS/BGM/페이서네checkbox,체중75입력,강도선택,Escape/배경닫기실제콜백PASS. BGM미설정disabled보존.
- 공유CSS용모의profile/account DOM의computedstyle전후동일. 실제계정/프로필전체화면기능시험은이번대상아님. scopedselector와원본prefix보존으로범위대조.
- `git diff --check` exit0. CSS전용추가여서tsc/전체suite는불필요미실행. 정상pre-commit완료.
- browser1/page1순차·기존5013재사용,새서버없음. 미니맵배경지도요청없음/실제큰지도미구동. 초기승인검토거부는검수46에보존하며이후사용자의남은UI코드전달승인으로해소.

## 남은 확인과 후속

화면별Chief확인흐름에따라5013에서주행설정사용확인. 다음지도설정·지명검색,이후주행HUD/안내·가입/인증창의밀도/오류/키보드상태검토. 다음주행카드는Chief요청대로변경대상에서제외. 주행컨트롤은51866a5안내와기존사용자접힘정책보존;주행시자동접힘등의행동변경은이번에추가하지않음.

실기기터치/키보드/실주행/BLE/실Firebase인증·저장전체e2e미검증. 이번결과를전체디자인최종완료나실기기PASS로해석하지않음. push/merge/deploy없음.

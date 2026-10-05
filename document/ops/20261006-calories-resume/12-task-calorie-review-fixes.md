# 칼로리 검수 보완

담당 Cursor CLI. 10·11 읽고 본보완만 수행, 결과13-result-calorie-review-fixes.md. 다른resume작업동시진행·partialpatch필수, commit/push/deploy금지.

Supervisor npx tsc -b --pretty false 통과. lint useCalorieProfile.ts20 react-hooks/set-state-in-effect 실패. 이lint오류를disabled로숨기지말고useSyncExternalStore/uid-keyedstate 등최소 externalstore구조로수정. uid전환첫렌더에이전weight보이지않음·동일탭setting/differenttabstorageevent·인증전localwrite금지·storage실패UI/상태일치검증. setterupdater안sideeffectlocalStorage쓰기도StrictMode중복피하고rawweightbooleans/invalid확인.

필수10검증중구현빠진UI740×300캡처는Chief넘기지말고진행: 기존RideSettingsSheet/Panel을fixture렌더(프로덕션저장·로그인불필요)해서체중/강도입력·설정무입력/입력·좁은가로줄넘침검증. 실제앱:5010게스트진입가능하면selectors먼저기존정상authflow, 시트보기만no-datachange. 못하면fixture만명시하되설정기능까지mounttest. source문자열만존재검사대신hook/session실제동작검증.

추가확인: calorieSnapshotidle→runningeffect는user전환/세션폐기/재개와계정맞음. pedalSec1초간격기존활동timer재사용, 실제blecrankRpmdisconnect는null처리되는지; staleRPM/sampletimeout이있으면칼로리경로에서만무효(기존conquest동작은변경금지). 센서연결전움직인구간도누락,중간센서연결/끊김partial추정metadata표시. timestamp없으면datafreshness한계정직기록. 실제elapsed보다activeSec크지않게경계clamp. 신호없는manual은null, 신호연결RPM0은0. pause·offset·설정midride·uid切替·HUD/result/stored같은 snapshot시험. parseCaloriesMetaversion/NaN·total unknownall인경우합계0을운동소모0로오해하지않는UI확인. legacy vsnewmeta도움말간단히표시. 칼로리설명UI에긴'watts구현'전문용어줄대신사용자에필요한간단설명.

모든칼로리변경TS lint(기존warnings별도), tsc-b, 기존18/40·추가meaningful시험·selectors필수. 상대resume진행중tsc일시오류는종료시재확인. 13결과에정확한commandexit/캡처/limits. 11덮어쓰기금지.

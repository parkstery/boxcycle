# 검수58 — 주요 전체 화면 점검과 결과창 가로 넘침 보정

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief 요청에 따라 현재 디자인의 겹침·긴 문구·짧은 화면을 재검증했다. 테스트는 browser/page를 순차 실행하고 기존5013을 재사용했다. 실제 지도·인증·삭제·결제·저장 네트워크를 실행하지 않는 실제 UI 컴포넌트/모의 props fixture 중심이다. 경로 설정 일부는 기존 DOM fixture다.

## 점검 범위와 최종 결과

| 화면/조합 | 상태 수 | 증거/결과 |
|---|---:|---|
| 계정·프로필·확인/취소/재열기 | 55 | account-57-results.json,중복0/화면내표시/끝컨트롤접근 PASS |
| HUD+주행패널+미니맵, 메뉴/설정 대표 조합 | 36 | composition-57-results.json,버튼중앙가림0/가로넘침0/pageerror0 |
| 주행 설정 | 20 | sweep-57-settings-recheck.cjs,문구/22px/콜백/가로세로넘침0 PASS |
| 지도 설정 | 24 | map-settings-48-qa.cjs,검색/카메라/옵션충돌없음 PASS |
| 지명 검색 | 32 | place-51-qa.cjs,긴결과/오류/목록스크롤/입력고정 PASS |
| 중앙안내·코칭·HUD | 16 | hud-53-qa.cjs,긴오류/버튼/계기보존 PASS |
| 미니맵·dock 접힘/펼침 | 16 | minimap-46-qa.cjs,정렬/간격8px/겹침없음 PASS |
| 시작 인증 | 25 | guest-55-qa.cjs,장문오류/notice/height180접근 PASS |
| 닉네임 등록·기본 로그인 카드 | 25 | signup-56-qa.cjs,유효성/선택해제/busy/긴오류 PASS |
| 주행 결과 | 20 | sweep-57-summary-recheck.cjs/summary-58-final.log,가로넘침0/모든결과콜백/마지막버튼접근 PASS |
| 경로 설정 위치/거리/보조패널 | 48 | pick-40-qa.cjs,긴주소/캐럿/화면경계 PASS |
| 내 경로 | 36 | sweep-57-saved.cjs,목록/선택/긴안내/검색·정렬 PASS |
| 퍼블릭 경로 | 36 | sweep-57-public.cjs,긴목록/disabled/검색·정렬·닫기 PASS |
| 입문 경로 | 24 | sweep-57-intro.cjs,목록/선택/상태별표시 PASS |
| 센서 | 25 | sweep-57-sensor.cjs,모드/단절/미지원/긴기기명/height180 PASS |

합계438개 fixture 상태이며 서로 독립된 대표 상태의 합이다. 여기에 pulse-50-qa.cjs의18검사항목(2회펄스·동일참조무재시작·disabled·접기·reduced-motion·최고점버튼겹침없음)을 재실행해통과했다. 모든실기기/모든화면조합의완전e2e로확대해석하지않는다. 대표조합의메뉴본문은모의긴안내이며실서비스Trail목록은아니다.

## 발견 및 보정

- 결과창 기존phone6px/PC3px가로스크롤은 닫기버튼의44px투명터치영역이오른쪽밖으로확장돼발생했다. [지시58](02-task-58.md)로 Cursor가 RideSummarySheet.css 끝에 `left:auto;right:0;transform:translateY(-50%)`만추가했다. 보이는버튼/글자/44px영역크기를유지하며안쪽으로확장한다. 정보숨김/overflow:hidden은사용하지않았다. 결과모든20상태가로overflow0,substats가로overflow0,닫기/Google/save/dismiss콜백PASS. 코드 `80fb6a6`.
- 작은결과Guest저장폼의세로스크롤은필요내용이많아남는다(300높이7px,180높이94px). 마지막버튼을실제스크롤로접근하고콜백을확인했다. 스크롤0을위해내용을숨기지않았다.
- 주행설정·퍼블릭의초기검증실패는입장애니메이션/후속승인디자인과구버전baseline비교때문이다. 정지레이아웃fixture에서애니메이션을차단하고,퍼블릭시험의입문구버전완전동일조건을현재화면의범위/넘침조건으로대체해재검증했다. 앱애니메이션이나입문코드는변경하지않았다.
- 결과창의옛시험은세로스크롤0을요구했으므로현재전체점검에서는기존보다악화없음+마지막컨트롤도달/실제콜백조건으로바꿨다. 투명44px의computed값43.9844px는zoom반올림이므로0.05px오차내검사하며CSS44px선언은유지한다. Guest폼에는닫기버튼이원래없어존재하는상태에만해당터치검사를적용했다. 초기실패로그는보존했다.

## 실행 기록과 한계

- screen-57-sweep.cjs 첫실행:10검증중주행설정/결과2실패,8통과. 이후원인별재검증은위표참조. run-57-extra.cjs 첫실행3중퍼블릭실패,내경로/입문통과. 퍼블릭최종재검증PASS. 초기실패를성공으로보고하지않는다.
- 타입/해당TSX lint/diffcheck PASS는검수57참조. CSS보정후diffcheck/정상pre-commit적용. 앱변경은UserInfoSheet.tsx조건한곳과RideSummarySheet.css터치영역한규칙뿐이다. 기존사용자/다른작업dirty는커밋하지않았다.
- 실기기키보드/터치·실제지도배경과모든카메라의시야·실BLE·실Firebase인증/운영저장·다중탭/네트워크·임의의동시패널조합은미검증이다.180높이는키보드가용높이근사다. 다음주행카드유지요청에따라코드는그대로이며이번변경대상이아니다.
- push/merge/deploy없음.5013에서Google연결중복제거와결과창을사용확인한다. 실기기검증과최종통합은남은작업이다.

# 최종 검수49 — 지도 설정(맵 뷰) 밀도 정리

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief주행설정47통과·다음지시→지도설정48→실제검수48 REWORK→49간격보정→본독립검수. Developer Cursor Auto session7a60317d-a20c-4bf2-843f-fcd9a212ec3e. Muse한도유지로교대,남은UI코드전달승인유효. 코드 `8b2f6a2`(face-redesign2).

## 변경과 범위

- MapViewSheet.css끝19줄추가만. 원본CSSprefix동일. 폰가로우상단위치/닫기/노선·지도·카메라·줌/거리기능보존.
- 폰폭17rem→25rem으로옵션줄감김감소. 여백/간격정리·장식핸들제거,가용높이상한유지. Desktop폭25rem그대로. 버튼/checkbox·글자크기/색상/문구/옵션순서불변.
- PC카메라행의기존8px가로overflow는48에서2px로줄었고,49의칩간격0.24→0.2rem으로0px해소. 컨트롤축소/새메뉴없음.
- 주행설정/시작버튼안내/다음주행카드변경없음. NextRideCard두파일SHA256대조동일. 앱diff는CSS1파일뿐.

## 실행·결과

- `node document/ops/20261013-face-redesign2/map-settings-48-qa.cjs`: 최종exit0. 실제MapViewSheet,모듈에서실제지도옵션/줌·거리상수사용. 지도없는index+main.tsx차단fixture,headless browser1/page1·기존5013순차검증. [JSON](map-settings-48-results.json),[전](map-settings-48-before.png)·[후](map-settings-48-after.png).
- 667×300/740×300/844×390/1366×768 × idle/riding/zoom min/max/distance min/max =24상태PASS. 모든행과패널의가로·세로overflow0,컨트롤모두패널내부/화면내표시. 전후문구·선택상태·disabled·button/input높이·font·슬라이더외버튼폭동일. range폭은확보한행폭에맞춰자연확장.
- 카메라8종·지도스타일3종·노선2종·3D/POI·줌/거리±와Home/End slider·최솟값/최댓값clamp·닫기/Escape/배경콜백PASS. 기록된이벤트37건,pageerror0.
- 기본폰:폭229.5→337.5px,높이227.02→144.44px(약36%감소). panel면적약52,100→48,748px²(약6%감소). PC폭400동일,높이203.98→169.25px. 3개폰viewport모두동일높이결과.
- `git diff --check` exit0. 정상pre-commit완료. CSS전용추가여서tsc/전체suite불필요미실행. 초기48실패는검수48/재지시49에보존.

## 한계·다음

실기기터치/브라우저safe-area·실지도렌더링·실주행·운영데이터연계미검증. CSSviewport/실제UI모듈검증을실기기PASS로확대하지않음. push/merge/deploy없음.

화면별사용확인흐름: 5013우상단맵버튼→지도설정확인. 다음지명검색창. 기존주행설정47은Chief통과로기록,다음주행카드는계속현상유지.

# 검수60 — 캐럿 행 70%

Supervisor Codex, 2026-10-15. APPROVED / Chief 확인 대기.

MapView.css 캐럿 전용 규칙 3값만 변경. 행 height/min-height24→16.8px, 아이콘height20→14px. 좌측정렬·폭·기능·이중캐럿모양·다른컨트롤 유지. 사용자 직접 축소요청으로 해당 캐럿 높이 예외 적용.

`node document/ops/20261013-face-redesign2/pick-60-qa.cjs` 최종 exit0, 폰667×300/740×300/844×390 및PC1366×768의48상태. 실제 행16.796875px(CSS 소수반올림,24px의70%), 가로넘침0. 위치/거리/양쪽펼침/접기/긴주소/phase/차단상태, keyboard Enter/Space, 입력값보존/삭제/기존콜백 PASS. 실제 buildPickPopup DOM, 지도 없는 fixture. 최초 strict equal16.8 검사실패는0.003125px 반올림 차이로 허용치0.02px 적용 후 통과. 화면740-distance.png 시각확인. 실지도/실기기 미검증.

커밋 `1cff026 style(route): reduce disclosure row height to seventy percent`. 아이콘 대안은 추천만: 얇은단일캐럿(추천), 옅은테두리작은둥근사각형캐럿, 펼칠내용문구+캐럿. 디자인교체는미실시.

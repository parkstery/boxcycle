# 감리38 — 이중 캐럿·위아래 보조 패널 승인

2026-10-14 Supervisor Codex. Chief 첨부 지시대로 텍스트 전환을 이중 캐럿으로 교체하고 같은 패널 안에서 상대 컨트롤을 위/아래로 붙였다. **UI APPROVED**, 기존 테스트 계약 정렬은39에 별도 기록.

- 거리 중심: ↑↑ 캐럿으로 위치 영역을 위에 추가, 거리 내용/상태 유지. 펼친 캐럿은 ↓↓로 뒤집혀 위치 영역을 다시 접는다.
- 위치 중심: ↓↓ 캐럿으로 거리 영역을 아래에 추가, 위치 내용 유지. 펼친 캐럿은 ↑↑로 뒤집혀 거리 영역을 접는다.
- 캐럿에 보이는 텍스트·알약 배경·테두리 없음. 파랑 SVG20px, 터치 영역44px, aria-expanded/controls·네이티브 키보드 지원. 기존 profile행의 거리›와 거리 head 텍스트 복귀/제목 DOM 제거.
- 중심 화면/보조 펼침과 거리 방향대기 모드를 분리. 위치 조작 후에도 펼친 거리 입력은 다시 활성화할 수 있고 값/토큰/phase 갱신은 보조 영역을 임의 접지 않는다. 위치를 위로 펼치는 것만으로 거리 대기/발견 상태를 해제하지 않는다.

`pick-38-qa.cjs` exit0 **48상태**(4viewport×12), `pick-38-live.cjs` exit0 **15상태**(실제 Guest 3viewport×5) PASS. [DOM 결과](pick-38-shots/results.json), [실제 앱 결과](pick-38-live/results.json). 위치 위/거리 아래 순서, 초기/펼침/접기/재개, 텍스트 버튼 없음, SVG/44px/aria 대상과 가시성 일치, 값/검색/오류/발견 유지, Start→거리 재활성, 토큰부족시 arm 없음, 키보드/삭제/drag, 가로 overflow0·pageerror0 확인.

실제740×300 dock: 위치만165.05px, 양쪽261.36px. 667/740/844 대표 양쪽 상태도 viewport 안이며 내부 스크롤0. [양쪽 캡처](pick-38-live/740-both.png), [거리 기본/위 캐럿 캡처](pick-38-shots/740-distance.png). 긴 주소 mock 양쪽259.36px, PC291.42px, 가로overflow0. 기존32 크기변화 재배치·33 높이상한·37 삭제 pointerstop 유지.

Developer의 옛 거리step 가드 문자열 테스트1FAIL은39에서 새 입력 재활성 계약으로 정렬한다. CSS에는 미사용 enter/back/head/title 규칙이 남지만 해당 DOM 생성/참조는 없고 캐럿은 독립 selector라 시각 동작에 영향 없음. 실기기·전체주행·방향클릭후 원격탐색은 미검증. Chief 사용확인은 대기.

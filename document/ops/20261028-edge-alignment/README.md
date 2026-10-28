# 계정·RouteDock·미니맵 가장자리 정렬

최신: **LOCAL_VERIFIED / 미배포**. Chief 후속에서 RouteDock·미니맵 구현 확인, 재개 후 해당 CSS는 수정하지 않고 계정만 완료했다. [결과·명령](01-result.md). 계정 15개 화면/상태 + 긴수치2 + 클릭/키보드2 PASS, 기존 관련 회귀5 PASS, 타입 포함 build PASS.

2026-10-28 Chief 첨부 이미지 지시: 계정 버튼을 오른쪽 위 구석에 붙여 왼쪽 조작 공간 확보, RouteDock·미니맵을 왼쪽 edge에 붙인다. 노치 safe-area는 유지한다.

범위: MapHud.css의 우상단 정렬과 서비스 간격, MapBottomLeftStack.css·RouteDock.css의 왼쪽 좌표. 작은 CSS 변경은 Supervisor가 직접 구현·검증한다. API·데이터·기능 의미 변경과 추가 Chief 결정은 필요 없다. 닉네임·계정 진입, 주소/미니맵 폭과 독립 접기, 반달 위치·모양, 하단 위치 등 기존 고정은 유지한다. 기존 dirty 변경·증거 보존, 커밋·푸시·배포 없음.

착수 사본: evidence/*.before.css. 완료 조건: 폰 가로 800×360·736×360·699×273·667×300에서 오른쪽/위·왼쪽 불필요 여백 0, 조작 비겹침과 실제 접기/펼치기·계정·메뉴 접근. 결과와 명령은 01-result.md에 기록한다.

# 검수51 — 지명 검색 결과 표시 공간

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief가 시작 펄스50을 승인하고 커밋·현재 작업 위치 보고·다음 디자인 진행을 지시했다. 펄스는 이미 `81dcce6`으로 커밋돼 중복 커밋하지 않았다. Developer Cursor Auto session `b4b4118b-d729-497f-aa1a-da81ba83fc0c`는 결과51의 session 미확인 표기를 실제 로그로 보완한 값이다. Muse 한도 유지와 남은 UI 코드 전달 승인은 유효하다.

코드 커밋: `ca56e9b` — 지명 검색 CSS 두 파일. 기존 펄스 `81dcce6`과 별도 커밋이다.

## 작업 위치와 변경

- 앱 작업 브랜치 `face-redesign2`, 워크트리 `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`.
- 지시·결과·검수 문서는 기본 저장소 `C:/20.HDev/boxcycle`, 브랜치 `main2`에 기록한다. 서로 다른 checkout이며 앱 변경을 main2에 병합하지 않았다.
- PlaceSearchPanel.css/MenuPlaceSearch.css 끝에 42줄 추가만 했다. 원본 prefix는 동일하고 TSX·서비스·요청/디바운스·선택 정책은 변경하지 않았다.
- 창 폭과 가용 높이를 확보하고 검색어/닫기는 고정, 결과 목록 하나만 스크롤한다. 작은 내부 카드 테두리·그림자 중복은 제거하되 행 구분선을 유지한다. 결과가 없으면 내용 높이로 끝난다.
- 문구·폰트·입력 높이·닫기 크기·항목 padding을 보존했다. 다른 임베드 검색용 모의 DOM의 computed style은 동일하다. 다음 주행 카드 두 파일의 SHA256도 동일하다.

## 검증

- `node document/ops/20261013-face-redesign2/place-51-qa.cjs`: exit0, 실제 PlaceSearchPanel/MenuPlaceSearch + mock geocode service. 기존5013, headless browser 1개/page 1개로 순차 실행. [결과](place-51-results.json) · [전](place-51-before.png) · [후](place-51-after.png).
- 667×300/740×300/844×390/1366×768 × 빈 입력/토큰 없음/로딩/긴 오류/결과 없음/1개/12개/긴 결과 =32상태 PASS. 가로 넘침·바깥 본문 스크롤0, 모든 창은 화면 안에 표시된다.
- 목록을 마지막 행으로 스크롤해도 헤더·입력 rect가 같다. 마지막 결과 접근, 상세 좌표·bbox 선택, 상세 실패 시 제안 좌표 fallback, 닫기/Escape/배경 콜백 PASS. pageerror0.
- 폰740 기준 일반 결과 완전 표시2→7개, 긴 결과1→4개. 결과가 많을 때 폭249.75→405px, 높이126→248.02px, 바깥 본문 스크롤76→0px. 빈 입력은 높이77.09→76.09px로 내용 높이를 유지한다.
- `git diff --check`: exit0. CSS 원본 prefix·변경 파일 범위·다음 주행 카드 해시 대조 PASS. CSS 전용 변경이라 tsc/전체 suite는 미실행했다. 정상 pre-commit을 적용했다.
- 초기 fixture는 비교용 모의 임베드와 실제 목록을 동시에 찾는 locator 때문에 strict-mode 오류가 났다. 검색 창 하위로 locator를 한정해 수정했고 최종32상태 PASS를 확인했다. 앱 수정은 필요 없었다.

## 기존 동작과 한계

닫았다 열면 검색어가 초기화되는 기존 동작은 유지된다. MenuPlaceSearch의 주석과 달리 부모 PlaceSearchPanel이 닫힐 때 자식을 unmount하는 구조다. 이 CSS 작업에서 기능을 변경하지 않았다. 결과0건 시 빈 결과 안내가 나타나지 않는 기존 조건도 보존했으며 TSX 개선은 별도 범위다.

실제 Mapbox API·실지도·실기기 터치/키보드는 미검증이다. 작은 CSSviewport 모의 검증을 실기기 PASS로 확대하지 않는다. push/merge/deploy는 하지 않았다. 5013에서 지명 검색을 사용 확인한다. 다음 디자인 검토 대상은 주행 HUD·안내 팝업, 이후 가입·인증 창이다. 다음 주행 카드는 계속 현상 유지한다.

# Supervisor ongoing notes — task03

2026-10-13 U01: CSS 변경은 독립 AST 감리에서 컬러만 변경 확인. 초기/출발핀만 있는 idle 상태는 센서칩 대신 caret LED가 표시되는 기존 정상 상태다. 센서칩이 안 보인다고 DOM/조건을 바꾸거나 추가 캡처 조사를 반복하지 말 것. 현 상태 가시성 한계를 기록하고 U01 완료 보고 후 U02로 즉시 진행. 여러 브라우저 스크립트 작성/상태 재발견으로 각 단위 시간을 늘리지 말 것. U02는 Start핀 설정 후 표시되는 기존 RouteDock shell의 색을 우선 확인하면 됨.

37CSS 전체 작업을 끝내기 위해 단위별 값 치환·정적 검증·열 수 있는 화면1장 정도로 신속 진행. Supervisor가 독립 실제 화면 검증과 비색상 AST 감리를 수행 중이다. 정적 구현 완료와 실제 화면 미검증을 분리해 보고하면 되고, 모든 잠긴 상태를 열기 위해 API/회원가입/실주행을 하지 말 것. 한 단위가 실행 검증에서 막히면 기록하고 다음 단위 계속.

5013은 같은 face-redesign2/apps/web의 Supervisor 서버다. 이를 main 서버로 보고하지 말 것.

효율 지시: 파일별 컬러 매핑을 먼저 정하고 편집 도구로 한 번에 여러 치환을 적용한다. 각 선언마다 도구를 따로 호출하지 않는다. 범위와 의미를 검토한 파일별 기계적 치환은 bulk mechanical rewrite로 허용되며, 본 작업의 파일 편집 제약 예외에 해당한다. 비색상 검사는 변경 뒤 자동 대조한다. 단위별 캡처 스크립트를 매번 새로 만들지 말고 재사용한다. 컬러값과 달리 사용자 상태 재발견에는 시간을 쓰지 말고 접근 불가를 기록하며 계속 진행한다.

U02 독립 감리: RouteDock의 16개 실제 요소 위치/크기/스크롤 크기 동일, shell 흰색 확인. caret 공통 hud-glass 덮어쓰기의 색상 전용 보정도 허용, 최신 AST errors 0. 실제 펼침 상태가 안 열리면 미검증을 적고 U03 계속. check-colors.mjs 자체를 반복 수정하지 말 것. 구조/색상 검사에는 Supervisor의 읽기 전용 AST 도구를 재사용 가능: node C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/supervisor-audit.cjs C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle . 앱 코드 외 검사 도구 개발에 시간을 더 쓰지 않는다.

U03 실창 입구: 최초 idle에서 .route-dock__caret 버튼(aria-label 센서 설정 열기)을 클릭하면 cadence.onOpen()이 실행되어 .cadence-sheet__panel이 열린다(RouteDock.tsx 131줄 부근). 지도 클릭/출발핀 설정은 필요 없다. 이 실제 입구로 한 번만 확인하고 다음 단위 계속.

U11 예방 감리: tokens.css의 --rtw-map-* / --rtw-trace-owned / --rtw-map-text-keyline* 및 지도 의미색은 보존한다. --rtw-trace*는 궤적 의미색과 공유되므로 UI 강조 파랑과 분리해서 접근한다(예: 테마 --rtw-accent를 파랑으로 직접 지정, UI에서만 trace 참조 교체). 전역 text-primary가 짙은색으로 바뀌면 배경 없는 HUD 수치·코칭은 기존 흰색+검정 keyline을 명시적으로 유지. 전역 교체로 지도/HUD 의미색이 바뀌지 않았는지 최종 확인한다.

U04 감리: 실제 MENU 20개, 지명 검색창 8개 요소 지오메트리 동일, 흰색/짙은 글씨 확인. MenuPlaceSearch color-scheme: dark → light 는 브라우저 기본 색상 모드만 변경하므로 허용한다(감리 AST에서 해당 전환만 예외 처리). checker 자체 수정 반복은 불필요. 데이터 없는 상태에서는 검색 입력 내부가 안 뜨므로 그 상태는 미검증 기록 후 U05 계속.

계정창 감리: 실제 UserInfoSheet 50개 요소 지오메트리 동일, 흰배경/파란 선택/통계 확인. ProfileEditSheet는 ride-settings-sheet__panel 등 공통 클래스라 RideSettingsSheet.css 수정 전까지 창 전체 완료로 판정하지 않음. 공통창 수정 후 함께 확인. U04 이후 live-progress.md 완료 기록이 늦어지고 있으므로 다음 단위 경계에서 누락 완료/현재 단위를 갱신할 것. 최초 계획의 U05 지도, U06 계정 순서를 바꿨다면 실제 순서를 명시하고 지도 작업을 누락하지 않는다. 인증 카드 접근을 위해 로그아웃하거나 Google 실제 인증을 실행하지 말 것.

경로 목록 독립 감리: 실제 입문 목록 39개, 퍼블릭 목록 284개 요소 위치/크기/스크롤 동일, 흰바탕/짙은글 정합. 실제 API 목록 조회 성공(별도 로드/등록 없음). 내 경로 창은 현재 빈 Guest 목록 상태의 .saved-routes__notice / 안내 본문이 밝은 글자라 흰 바탕에 묻힘. 아직 SavedRoutesPanel.css 미수정 시점의 발견이므로 해당 파일 교체에서 짙은 보조글/연한 안내 바탕으로 반드시 처리하고 완료 보고. 주입 샘플이 아니라 실제 빈 내 경로 창에서도 확인할 수 있음.

U06 후속: SavedRoutesPanel 교체 후 Supervisor의 실제 내 경로 창 재검증에서 안내문 대비 문제 해결, 10개 요소 지오메트리 동일 확인. 입문/퍼블릭/내 경로 실제 화면 검증은 Supervisor가 이미 수행했으므로 같은 검증을 여러 스크립트로 다시 만들 필요 없음. 현재 전체 AST errors 0. 남은 지도 설정/주행 설정·기록·결과/Trail/HUD/토큰 작업으로 계속 진행한다.

U07/08 독립 감리 완료: 주행 설정 26개, 프로필 수정 20개, 메뉴 포함 빈 Trail 20개 실제 요소 지오메트리 동일. 결과창은 실제 완료상태 미검증으로 기록. U09 시점 MapViewSheet.css는 아직 다크 원본이므로 반드시 별도 수정/완료 보고할 것. RouteMinimap.css/MapView.css 잔여 지도 UI 바탕도 인벤토리 점검. MapHud.css에서 투명 coach/metrics/clock 글자와 keyline을 일반 카드 팔레트로 기계적 통일하지 않는다.

U09 구분 보충: transparent HUD의 흰 일반 글자/검정 keyline/투명 바탕은 유지. 하지만 coach·R1·hero의 기존 금색 강조는 도메인 궤적 색이 아니라 UI 강조라 지시03대로 파랑으로 교체(외곽선 유지)한다. 지도 trace 토큰 원값을 바꾸지 않고 해당 UI color 참조만 파랑으로 분리한다. 금색 전체를 제외로 오인하지 말 것.

U09 지도창 독립 실제 확인: 41개 요소 지오메트리 동일. 작업 중간 캡처에서 닫기 글씨가 흰 바탕에 희미했으므로 최종 계산값/캡처 확인. MapView.css scale box의 border:1.5px solid #CBD5E1이 두 번 중복 삽입됨(1360줄 부근); 기존 border 선언만 교체하고 새 중복 선언은 제거. 마지막 MapHud.css의 --rtw-trace UI 강조 참조 6건(hero/coach/R1)은 지시대로 파랑으로 분리 필요.

최종 보정 지시 02-task-04.md가 같은 묶음에 준비되어 있다. 새 실행을 기다리지 않고 현재 실행에서 그 지시도 읽고 바로 처리해도 된다. RotateOverlay는 scrim이 아니라 실제 안내 화면, 미니맵 milestone/지도 activity popup도 정보 UI이며 의미 경로선과 다르다. 지시04의 세부 보정 후 최종 보고한다. Supervisor 독립 tsc exit0, 667x300 지도41/설정26/프로필20 지오메트리 동일 확인 완료.

긴급 정적 발견: 방금 MapHud.css .hud-metrics__conquest-owned-hint에서 color와 opacity:0.55가 함께 삭제됨. opacity는 비색상으로 삭제 금지다. 원본 opacity:0.55를 복구하고 color만 #2563EB로 교체할 것. AST는 이런 삭제를 실패로 판정한다. 지시04 전체 읽기 필수.

지시04 보정 뒤 Supervisor 독립 검증 완료: 5013 서버 갱신 후 실제 지도 설정41개/HUD31개 요소 전후 geometry 동일, 활성칩 hover rgb(37,99,235)+흰글씨, 닫기 rgb(71,85,105). 실제360x800 RotateOverlay4개 요소 geometry 동일, 흰바탕/짙은글/파랑 아이콘 확인(비교 시 검사용으로 애니메이션 정지; 출하 애니메이션 선언은 AST로 보존 확인). 최신32CSS AST errors0/diff-check0. 이 실제 검증은 이미 수행했으므로 진입점/DOM 재탐색이나 같은 검증 반복 금지. 남은 실제 주행 milestone/activity popup은 미검증이라고 기록하고 정적 보존 검사만으로 마감 가능. 결과03-result-04 및 기존 노트 시각/30CSS 개수 오류 정정으로 마감할 것.

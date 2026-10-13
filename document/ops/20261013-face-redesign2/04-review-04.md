# 감리04 — 컬러 교체 최종 독립 검수

- 대상: C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle, branch face-redesign2.
- 기준: e3c4fccdb66523c3a15aacab3a0fea02e9ad2ac7.
- 판정: 색상 전용 구현과 아래 실제 표시 상태는 검수 통과. 모든 기능/주행 상태 PASS 또는 Chief 최종 승인이라는 뜻이 아니다.
- Developer: OpenCode Muse Spark 1.3. 지시03 연속 구현 후 지시04 누락 보정. Supervisor: Codex.
- 상태: AWAITING_CHIEF — 개발자 결과03/04와 최종 독립 증거 확인 완료. 사용자 사용 확인·채택 판단 대기.

## 범위 준수

앱 변경은 CSS 32개 파일뿐이다. 배치·크기·간격·폰트 크기·모양·애니메이션·DOM·기능 로직 변경 없음. 읽기 전용 PostCSS AST 검사에서 기존 비색상 선언 값/삭제/important/중복 및 색상 shorthand의 비색상 부분을 대조한 결과 errors=[] (exit 0). 색상 모드 color-scheme:dark→light만 명시 허용했다. CSS 설명 주석 수정도 포함하므로 diff 전체를 모두 색상 선언이라고 표현하지 않는다.

흰 패널, 짙은 본문, 파란 실행/선택, 녹색 성공, 빨간 오류를 적용했다. 경고의 amber, 지도 선/마커/고도/센서 LED, 지도 글씨 keyline, 스크림·그림자 검정은 의미와 가독성 때문에 유지했다. 전역 trace/text 토큰은 지도와 공유하므로 반전하지 않고 UI 색상 참조만 분리했다.

## 독립 실화면 비교

사용자 5013 탭을 조작하지 않았다. 별도 headless Chromium의 실제 앱 DOM에서 기준 커밋 CSS와 작업 CSS를 같은 화면 크기로 번갈아 적용하여 위치·크기·스크롤 크기를 대조했다. 상태별 현재 DOM의 비교이며 다른 상태까지 보장하지 않는다.

| 실제 표시 상태 | 전후 동일 요소 수 | 확인 범위 |
|---|---:|---|
| 초기 RouteDock shell/캐럿 | 16 | 흰바탕·컨트롤 |
| 센서 설정창 | 19 | 흰바탕·짙은글·파란 버튼 |
| MENU/빈 Trail | 20 | 메뉴·빈 Trail 색상 |
| 지명 검색창 | 8 | 검색 패널, 실제 검색 조회 미실행 |
| 사용자 정보 | 50 | 탭·통계·위험 버튼 |
| 프로필 수정창 | 20 | 본문·저장 버튼, 저장 미실행 |
| 주행 설정창 | 26 | 밝은 칩·파란 컨트롤, 설정 저장 미실행 |
| 지도 설정창 | 41 | 닫기·선택칩·hover |
| 입문 경로 목록 | 39 | 실제 목록 조회 |
| 퍼블릭 경로 목록 | 284 | 실제 목록 조회 |
| 내 경로 빈 Guest 상태 | 10 | 안내문 대비 재확인 |
| 최종 초기 HUD | 31 | 실제 RTW/계정/지도 버튼, 주행 중 HUD 아님 |
| 세로 안내창 360x800 | 4 | 흰바탕·짙은글·파란 아이콘 |

기본 800x360. 추가 667x300 지도41/설정26/프로필20 요소도 동일. 최초 경로 생성 팝업 검수02의 800x360/667x300 비교 결과도 유지한다. 세로 안내창 비교에서는 회전 아이콘 애니메이션만 headless 검사 페이지에서 잠시 정지했다. 출하 코드의 애니메이션 선언은 AST로 보존 확인했다.

최종 지도 설정 active:hover 배경 rgb(37,99,235)/전경 rgb(255,255,255), 닫기 전경 rgb(71,85,105). 최신 실화면 비교의 pageerror=[]이다. ActivityWorld 기존 warn은 있어 console 전체 무경고라는 뜻은 아니다.

## 재작업 및 사실 정정

감리에서 금색 HUD 강조, 세로 안내창, 미니맵 milestone, activity 정보 팝업 누락을 발견하여 지시04로 보정했다. 지도 의미색과 UI 정보창을 구분하지 못한 초기 제외 판단은 승인하지 않았다. MapView 축척 중복 border 제거, 실수로 삭제된 conquest hint opacity:0.55 복구도 확인했다.

지도 닫기 버튼의 소스/표시 불일치는 5013 Vite의 이전 CSS transform이 남은 문제였다. Supervisor가 소유한 서버만 재시작한 뒤 실제 새 스타일 적용·정상 대비를 확인했다. 사용자 관찰 URL은 그대로다.

결과03의 '노트 07:25 출현'은 사실과 다르다. 노트는 이전부터 존재했고 개발자가 늦게 읽었다. 결과03의 '앱 CSS30+App.css+theme=32'는 중복 집계다. App.css/theme를 포함하여 지시03 시점30개, 지시04 종료 시32개다. 결과03에서 미니맵 전체/RotateOverlay를 제외한 설명은 지시04 보정으로 대체된다.

## 검증 명령

1. cwd C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle:
   `git -c safe.directory=C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle diff --check` — exit 0.
2. `node C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/supervisor-audit.cjs C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle` — 32 CSS, errors=[], exit 0.
3. cwd C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle/apps/web:
   `node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false` — Supervisor 독립 최종 재실행 exit 0, Muse 지시04 재실행도 exit 0.
4. `node C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/supervisor-view.cjs map hud rotate` — exit 0, 전후 geometry 동일, runtimeErrors=[].

최종 Git 검사 최초 sandbox 실행은 외부 worktree 메타데이터 접근 실패로 exit 1이었다. 권한 있는 읽기 전용 재실행에서 exit 0 확인. 이를 코드 실패 또는 최초부터 성공으로 기록하지 않는다.

증거: C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/supervisor-shots/. 최신 지도/HUD/세로 안내 결과는 latest-map-hud-rotate-800x360.json (세로 행 실제 viewport 360x800 기록).

## 미검증과 인계

센서 연결/주행 중 계기·코칭/전체 RouteDock/첫·다음 주행 카드/실제 인증/데이터가 있는 개인 경로/실제 결과창/다중 라이더/미니맵 milestone 발생/activity 정보 팝업의 실제 발생 상태는 실행 미검증이다. 해당 스타일은 정적 감리만 통과했다. Muse의 주입 DOM 계산값은 실제 상태나 기능 PASS로 인정하지 않는다. 실기기·전체 e2e·빌드/운영 배포 미실행.

관찰: http://127.0.0.1:5013/. 작업 위치는 위 절대 경로. 미커밋·미푸시·미배포. main/main2 및 이전 mobile-ui-redesign은 이번 컬러 구현에서 변경하지 않았다. 기존 redesign 삭제와 새 결과 채택/병합은 Chief 판단 후 별도 수행한다.

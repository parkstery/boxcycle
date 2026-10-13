# 감리06 — 프로필 수정창 밀도 보정

판정: 구현·아래 표시 상태 검수 통과, AWAITING_CHIEF. 전체 UI/실기기/인증·저장 기능 PASS가 아니다. 다른 창은 착수하지 않는다.

- 작업: C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle, face-redesign2.
- 기준: 컬러 라운드 종료 시점의 profile-before-05.css + app-hashes-before-05.json. 과거 컬러 전용 AST 규칙으로 이번 배치 변경을 검사하지 않는다.
- Developer: Muse1차 보정 후 사용한도로 종료. Chief의 명시적인 Cursor 코드전송·교대 승인 후 Cursor CLI 마감. CLI 초기화 모델은 Auto(실제 선택된 하위모델은 응답에 미제공), 최종 세션69213652-d36a-45f7-a14a-c84cd9ad504c.
- Supervisor: 실제 source/diff/hash/화면 검수. 앱 변경은 ProfileEditSheet.css 한 파일뿐. TSX·공용RideSettingsSheet.css·다른31CSS 보존. commit/push/deploy 없음.

## 실제 변경

프로필 하위에만 padding/gap 축소, 장식 handle의 별도 행 제거, 체중+강도 한 행 정렬, 강도 버튼 강제 flex 확장 제거, 기존65%높이 제한을 안전영역 고려한 가용높이로 변경. 글씨 크기/색상/문구/저장 로직/취소·Escape 동작 불변. 입력·강도·저장·취소 높이44px 유지(44x44 정사각형 타깃 전수 보장이라는 뜻은 아님). 실제 넘침은 auto 스크롤로 접근 가능하도록 유지하며 overflow:hidden으로 숨기지 않는다.

## 독립 실앱 결과

사용자5013 탭은 미조작. 별도headless 동일DOM에 변경 전의 밝은 프로필CSS와 최종CSS를 번갈아 적용했다.

| 화면 | 변경 전 | 변경 후 | 결과 |
|---|---|---|---|
| Guest 프로필800x360 | 297x234 | 297x191.48 | 높이18.17%감소, 면적24.13%→19.75%, 가로/세로overflow0 |
| Guest 프로필667x300 | 297x195, scrollHeight231/clientHeight193 | 297x191.48, scrollHeight=clientHeight189 | 기존 세로스크롤 해소, 모든 항목·저장 표시 |
| Guest 프로필740x300 | 297x195, scrollHeight231 | 297x191.48, scrollHeight=clientHeight189 | 스크롤 없음 |
| 공용 주행설정800x360 | 297x193.75 | 297x193.75 | 26개 요소 위치·크기·스크롤 지오메트리 동일 |

정상Guest800x360 <=198.9px(15%감소) 목표 충족. 입력/강도/취소/저장44px 높이와 기존 글자 크기 확인. 최종 성공 캡처 runtimeErrors=[].

## 로컬 컴포넌트 상태 검증

실제 ProfileEditSheet React 컴포넌트에 mock User/callback을 넣어 닉네임 입력·잠금·잘못된 체중 오류 상태를800x360/740x300/667x300/844x390에서 비교(12조합). 정상250.56px/잠금238.17px/오류268.39px, 전부 가로·세로overflow0/입력·버튼 최소높이44px/errors=[]. 이는 실제 인증·서버저장 시험이 아니다. 정상 계정이 기존65% 제한에서 더 높게 표시되는 것은 이전에 스크롤로 숨겨졌던 콘텐츠를 표시한 결과로 구분한다.

증거: C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/profile-05-shots/ (profile-before/after.png, profile-667x300-before/after.png, profile-740x300-before/after.png, mock-states.json 및 mock 캡처12쌍).

## 검증·실패 기록

- git diff --check: Cursor와Supervisor exit0.
- apps/web cwd의 node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false: Cursor/독립Supervisor exit0.
- 앱 파일SHA256: 이번 라운드 변경은 apps/web/src/components/ProfileEditSheet.css만, 신규앱경로0. 최초해시명령의apps/web 상대path 오류는root를명시한재실행으로정정.
- 실앱 node C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/supervisor-view.cjs profile settings 및667/740 viewport 재실행: 최종 위 결과. 최초의8초 DOMContentLoaded/게이트클릭timeout은 검사실패로기록, 서버HTTP200/로그확인 후 navigation commit+실제창표시+30초대기로전환하여성공. 실패한캡처를PASS로세지않음.
- node C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/profile-state-qa.cjs: 최종12조합 성공. UI QA도구의일시적파일편집거절은 일반파일attributes확인 후 상대경로apply_patch로수정했고앱소스는수정하지않음.
- Cursor 최초Trust미설정 실행은착수전exit1, 정확한워크트리--trust후진행. 이후5분무출력으로중단했으나사후파일시각확인에서중단직전CSS보정이이미적용됐음을발견하여사용자에게정정. 기존프로세스종료확인후stream-json/auto-review로같은좁은범위재개. 강제--force/--yolo 없음. 마지막개발자결과는03-result-06.md.

## 인계

관찰 http://127.0.0.1:5013/ 유지. 계정 → 프로필 수정에서 실제 확인. 사용자 확인 전 다른 창으로 확대하지 않는다. 실기기·터치 체감·소프트키보드·실제 인증/저장/Google연결 미검증. 기존 main/main2/이전 redesign 보존.

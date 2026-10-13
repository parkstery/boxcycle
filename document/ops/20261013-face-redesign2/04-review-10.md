# 감리10 — 계정 공간밀도 보정 결과 / 조건부 검수

대상 C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle, branch face-redesign2. Cursor08은 수정 없이 종료, Muse09 구현→Supervisor grid stretch 발견→Muse10 세 선언 보정. 이번 앱 변경은 UserInfoSheet.css만. 이전 프로필 및 색상32 CSS 보존. TSX·기능·문구·글씨·색 변경 없음. commit/push/deploy 없음.

## 실제 검수와 근거

- 기본앱 Guest: supervisor-view.cjs account, 800x360. 실행 exit0, pageerror0. body 콘텐츠254.14→228.56px, 행44px, overflow0. 증거 account-10-live/*.png 및 latest-account-800x360.json. 사용자 관찰 창 조작 없음.
- 실제 React UserInfoSheet를 로컬 mock props와 intercepted subscription response로 렌더한 상태시험: account-state-qa.cjs, 800x360/667x300 × Guest/Free/자산/긴 안내/빈 내역/로그아웃확인/탈퇴확인/자산+로그아웃/자산+탈퇴 총18조합, exit0/pageerror0. uid빈값으로Firestore통계읽기방지. 실제 인증·기록통계·결제·로그아웃·탈퇴 시험 아님. 증거 account-10-shots/mock-states.json 및PNG. 자산/확인 실제스크린샷 시각검수 수행.
- 기준은 account-before-08.css(지시07완료본). 같은 DOM에 CSS만 교체해 비교. account-09-shots는 grid stretch가 남은 중간 실패본으로 최종성과 아님.
- apps/web cwd node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false + git diff --check exit0(최종보정후). Muse의 diff-check도출력없음. 기존32파일해시대조: 프로필(이전완료)·UserInfo만05기준과다름,다른30개불변.

## 측정 (콘텐츠 높이 / scrollHeight-clientHeight)

| 상태 | 전→후 콘텐츠px | 800x360 스크롤px | 667x300 스크롤px |
|---|---|---|---|
| Free |275.80→228.56(-17.1%)|0→0|27→0|
| 자산표시 |331.70→284.47(-14.2%)|23→0|83→35|
| 로그아웃확인 |354.16→303.16(-14.4%)|45→0|105→54|
| 탈퇴확인 |434.89→397.36(-8.6%)|126→88|186→148|
| 자산+로그아웃 |410.06→359.06|101→50|161→110|
| 자산+탈퇴 |521.39→480.09|212→171|272→231|

세로1행제거: Free/업그레이드+기간탭같은행. 탭은44px자연높이,불필요한grid stretch제거. 확인버튼내용폭,탈퇴입력44px높이확보. 헤더기존작은표시크기는pseudo44px터치영역유지. 긴설명/목록/자산동시표시는필요스크롤유지,18조합수평overflow0·마지막컨트롤도달true. 터치체감·실기기·브라우저UI변화미검증.

판정: 이번 계정 CSS보정은 기본Free15%감소목표충족,조건부스크롤감소 확인. 모든상태스크롤제거/전체UI PASS 아님. Chief5013현재계정창확인대기. 이전맵관련후속은미착수,경로생성창·맵메뉴 별도한창작업필요.

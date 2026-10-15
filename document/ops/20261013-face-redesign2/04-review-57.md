# 검수57 — 계정 Google 연결 중복 제거

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief가 기본 Google 연결과 로그아웃 확인 안의 Google 연결하고 기록 지키기 중복 제거를 요청했다. 중단 후 계속 진행 지시에 따라 앱 dirty가 없음을 확인하고 재개했다. Developer Cursor Auto session `4dbf0472-bf92-4af1-8b3a-c41577039f84`. 앱 커밋 `147e83c`(face-redesign2).

- UserInfoSheet.tsx 기본 Google 연결의 조건 한 곳만 `showGoogleLink && !confirmingLogout`으로 변경했다. 확인 중에는 경고 안 버튼만 표시, 취소·닫았다 재열면 기본 버튼으로 복원된다. 두 버튼의 기존 Google 콜백과 경고·로그아웃 정책은 유지한다.
- `node document/ops/20261013-face-redesign2/account-57-qa.cjs`: exit0. 실제 UserInfoSheet/ProfileEditSheet, uid빈 모의 사용자·모의콜백·구독응답차단, 실제인증/삭제/로그아웃없음. 네viewport와740×180근사, Guest/등록/긴안내/주행/busy/확인/취소/재열기/프로필잠금·오류 포함55상태 PASS. [JSON](account-57-results.json)·[확인창](google-dedup-57.png).
- Guest의 기본버튼1개→확인중0개/경고안1개→취소1개,재열기1개. Google모의콜백30회,로그아웃모의콜백15회 확인. busy disabled/등록계정미표시·긴안내/마지막컨트롤스크롤접근·pageerror0.
- apps/web `npx tsc -b --pretty false`, `npx eslint src/components/UserInfoSheet.tsx`, `git diff --check`: 모두exit0. lint오류0/기존hook경고2. 정상pre-commit완료.

전체화면점검과발견보정은별도 [검수58](04-review-58.md)에 기록한다. 실인증·실기기미검증, push/merge/deploy없음.

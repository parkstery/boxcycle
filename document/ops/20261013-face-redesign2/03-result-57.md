# 결과57 — Google 연결 중복 제거

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `b31de2a432521bae45d0c68d9e73eb2029ecf37c`. 커밋 없음.

쓰기 소유: `apps/web/src/components/UserInfoSheet.tsx` 기본 Google 버튼 렌더 조건 한 곳.

- `{showGoogleLink ? (` → `{showGoogleLink && !confirmingLogout ? (` (actions footer, 「Google 연결」).
- `showGoogleLink` 변수, 로그아웃 확인 영역(「Google 연결하고 기록 지키기」), 경고 문구, 삭제 정책, 클릭 콜백, busy, 등록 계정, 다른 파일 불변.

명령: `git diff --check -- apps/web/src/components/UserInfoSheet.tsx` exit 0.

미검증: Guest/등록/주행/busy, confirm/cancel/reopen에서 중복 0, Google 콜백, 경고, 로그아웃 확인. 실로그아웃·삭제·auth 요청 없음. 주요 화면 fixture의 겹침/긴 문구/짧은 화면, 실기기. Supervisor 재검증으로 남김.

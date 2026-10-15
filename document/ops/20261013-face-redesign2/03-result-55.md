# 결과55 — 시작 인증 카드 여백과 짧은 화면 접근

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `93d9284035d69a847be1678fbadd67bcf10563ab`. 커밋 없음.

쓰기 소유: `apps/web/src/components/auth/GuestEntryCard.css` 끝 추가만.

- 기존 선언·TSX·인증 정책·호출·버튼 크기·폰트·문구·다른 창 불변.
- 파일 끝에 확정 규칙 5개 추가. 카드 폭 상한 `min(100%, 22rem)` 유지.
- `.guest-entry` safe-area padding, `.guest-entry__card` padding·`max-height:100%`·`overflow:auto`, title/lead/notice margin.

명령: `git diff --check -- apps/web/src/components/auth/GuestEntryCard.css` exit 0.

미검증: selector15, 실제 컴포넌트 4 viewport + keyboard 높이 180 fixture, 기본/busy/notice/장문 error/둘 다, 전후 font/button/body 보존, 높이/overflow, 마지막 행 스크롤 접근, Guest·Google 콜백. 실인증·실기기. Supervisor 재검증으로 남김.

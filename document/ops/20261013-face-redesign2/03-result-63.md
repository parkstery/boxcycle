# 결과63 — 흰색·파랑 주행 계기판

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `d9071d708ce4d09c01a886ac9649eb8ffe8f4441`. 커밋 없음. 지시63 파일은 수정하지 않음.

쓰기 범위: worktree `apps/web/src/components/maphud/MapHud.css`의 계기판 규칙만. TS·기능·수치 포맷·ARIA·새 도로 pulse·다음 주행 카드·다른 HUD·코칭 CSS는 그대로.

- capsule: `background:#FFFFFF`, `border-radius:0.65rem`, `box-shadow:inset 0 0 0 1px #CBD5E1, 0 2px 8px rgba(15,23,42,0.12)`, `text-shadow:none`. `border` 속성은 추가하지 않음.
- `capsule::before`: `content:none`. 방사 그라데이션과 position/inset/z-index/pointer-events/background 제거.
- label `#475569`, value `#0F172A`, unit `#475569`, value-total `#334155`, hero/cumulative `#2563EB`.
- conquest label `#475569`, value `#2563EB`. owned-hint `#475569`, `opacity:1`, `text-shadow:none`.
- route-preview 값 `#2563EB`, `opacity:1`.
- label/unit `text-shadow:none`. divider는 `display:none` 유지. gap·padding·font-size·font-weight·line-height·고정폭·반응형 규칙은 변경하지 않음.

명령: `git diff --check -- apps/web/src/components/maphud/MapHud.css` exit 0. diff stat: 1 file, 31 insertions, 74 deletions.

미검증: 브라우저·서버, fixture(667×300/740×300/844×390/740×180/1366×768, preview/riding/paused, 긴 수치, 새 도로/이미 내 도로, 밝고 어두운 배경), 전후 축 0.8~1.2, 셀 겹침, 대비 4.5, selector/tsc. Supervisor 검증으로 남김. 실기기 미검증.

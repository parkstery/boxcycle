# 결과13 — 계정창 컨트롤 44→22px

- 수정파일: `apps/web/src/components/UserInfoSheet.css` 1개 (지시09 grid合체 유지, TSX/문구/폰트/색/폭 불변).
- 변경: `.user-info-sheet__plan`(액션/비액션 동일행), `.user-info-sheet__stats-tab`(4개), `.user-info-sheet__last-ride`, `.user-info-sheet__btn`(Google/로그아웃/탈퇴·확인행 확인취소실행 포함), `.user-info-sheet__confirm-input`에 `min-height:22px;height:22px;box-sizing:border-box;padding-top/bottom:0` 적용. 좌우 padding·font-size·line-height·색·display 미변경(마지막주행 제외).
- 마지막주행: 두줄 잘림 방지 최소조정으로 `.last-ride-body`를 row·`align-items:center` 한줄화, head는 `flex:0 0 auto`, v는 `flex:1 1 auto`+기존 ellipsis 유지. title/정보 삭제 없음, font 축소 없음.
- 비대상 보존: 헤더 수정/닫기(`__edit`/`__close`+기존 pseudo44 유지), 목록내 `__item-action`, 통계카드·자산 미수정. pseudo44 신규 추가 없음.
- 검증: `git diff --check` 1회 통과(출력 없음). 브라우저/tsc 미실행(Supervisor 검수).
- 예외 보고: Google 긴 안내버튼은 글씨 축소 없이 22px 고정 적용. 실제 문구가 1줄을 초과해 줄바꿈/넘침이 발생하면 정당한 예외로 Supervisor 육안 확인 필요. 정상Free/Guest·자산·로그아웃·탈퇴확인 상태 검수 요청.

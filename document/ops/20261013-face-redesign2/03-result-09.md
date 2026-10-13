# 결과09 — 계정 UI 작은 CSS 보정

- 담당: Developer(OpenCode Muse Spark1.3) · 지시: `02-task-09.md` · 인계: `03-result-08-handoff.md`(Cursor08 수정 없음 확인)
- branch: face-redesign2 · 커밋/push/deploy: 없음(금지 준수)
- 변경 파일: `apps/web/src/components/UserInfoSheet.css` 1개만(파일 끝 1블록 추가). TSX·폰트·색·문구·기능 변경 없음. 타 파일(지시01~07 결과) 보존.

## 변경(1회 편집, CSS-only)

파일 끝 `지시09 계정 UI compact` 블록 추가:

1. **플랜 행 + 기간 탭 같은 행**: `.user-info-sheet__scroll-body`를 `flex column` → `grid(auto minmax(0,1fr))`로 전환. 플랜 `grid 1행1열`, 기간탭 `1행2열`로 세로 한 행 제거. 플랜은 `align-self: stretch`로 탭 행 높이(44px)에 맞춤. 대가: DOM상 플랜 뒤의 구독 안내·자산 블록이 시각적으로 탭 행 아래로 내려감.
2. **내용폭**: 기간 탭 `flex:1` → `flex:0 1 auto; width:auto`(내용 기준+축소 허용, 44px 유지). 로그아웃·탈퇴 확인 행 버튼 `flex:1 1 0` → `flex:0 0 auto; width:auto`(44px 유지, 행 `flex-wrap` 추가).
3. **확인 패널 중첩 여백 절제**: `.logout-confirm` `gap 0.28→0.2rem`, `padding 0.35/0.5→0.25/0.4rem`. 확인 입력 `margin-top 0.16→0.1rem`. 경고 문구·입력·disabled 조건·필요 스크롤은 그대로.
4. **조건부 파손 방지**: body 직계 전부(플랜/구독안내/자산/기간탭/통계카드/마지막주행/내역/액션)의 `grid-column`을 명시. 안내·자산·내역 부재 시 자동 배치로 붕괴 없이 메워짐. spanning 자식에 `min-width:0`으로 긴 안내 줄바꿈 유지.

## 시험

- `git diff --check`: clean(출력 없음). — 지시대로 1회만 수행
- tsc·브라우저 렌더: 미실행 — Supervisor 담당(지시 명시). 서버 조작 없음.

## 미검증(다음 담당)

- 800×360/667×300 실제 렌더에서 플랜+탭 한 행 추정: 내용폭 기준 플랜 약 140px + 탭 4개(약 33px/개) ≈ 한계선상. 좁은 폭에서 탭이 찌그러지는지 Supervisor 화면 확인 필요. 깨지면 탭 행 분리(본 블록 되돌리기)로 복구.
- Guest(비액션 플랜)·유료(구독관리)·자산 없음·긴 구독 안내 상태의 실화면 미확인.
- 세로 점유 감소량 미계측(브라우저 계측은 Supervisor 담당).

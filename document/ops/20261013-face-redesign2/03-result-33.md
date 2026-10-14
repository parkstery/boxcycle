# 결과33 — 펼친 경로 패널 불필요 내부 스크롤 해소 (max-height 상한만 보정)

- 소유: `apps/web/src/components/map/MapView.css` 중 `.map-view__pick-dock-panel .map-view__pick`의 `max-height` 선언만. 다른 dirty(기존 29/30/31/32·타 담당자) 미접촉·되돌림 없음.
- commit/push/deploy/server/하위 agent 없음.

## 수정

`apps/web/src/components/map/MapView.css:53-58`:

```css
.map-view__pick-dock-panel .map-view__pick {
  max-height: min(calc(100vh - 18px), 26rem);
  max-height: min(calc(100dvh - 18px), 26rem);
  overflow-x: hidden;
  overflow-y: auto;
}
```

- 변경점: 기존 `max-height: min(70vh, 26rem)` 1선 삭제 → `100vh` fallback 1선 + `100dvh` 본선 1선으로 교체. `26rem` 상한 유지, `overflow-x/y` 그대로.
- 불변: 폰트/버튼/다른 규칙/32 ResizeObserver/정책 미접촉.
- 근거: 300px 가로 화면에서 기존 `70vh`는 210px로 제한해 거리모드 220px(44px 토글 포함)의 안내만 불필요하게 스크롤시킴. `100dvh - 18px`은 실제 가용 높이(284px 언급) 안에서 뷰포트보다 항상 작게 상한을 잡고, oversize/긴 내용은 기존 `overflow-y: auto`로 접근 유지.

## 검증

- `git diff --check`: 통과(출력 없음).
- 본 지시 hunk 확인: 해당 규칙에서 `-1/+2`(본선 1선 교체 + fallback 1선 추가)만. `git diff --numstat` 전체가 크게 보이는 것은 기존 dirty(타 지시·타 담당자 변경)가 작업대에 이미 있던 것으로, 본 수정이 건드리지 않았음.
- Developer 로컬 정적 확인만 수행. 서버 기동·브라우저 실측 미실행(지시 금지 준수).

## Supervisor 실제 확인 요청 (본 Developer 미실행)

- 실제 폰 3 viewport에서 panel 경계가 화면 안에 있는지, `pick.scrollHeight - clientHeight` 확인(단일모드 0, 양쪽 펼침/긴 내용 초과는 기존 scroll로 접근 가능).
- drag/close 정상 여부.

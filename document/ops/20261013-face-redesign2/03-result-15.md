# 결과15 — HUD 노란 강조·첫 라이딩 안내 축소

지시02-task-15 수행. 미커밋 유지, commit/push/merge/deploy 없음.

## 변경 파일(허용 2개만)

1. `apps/web/src/components/maphud/MapHud.css` — 4 color 선언만 `#2563EB` → `#FACC15`:
   - `.hud-metrics__cell--hero .hud-metrics__value`
   - `.hud-metrics__value--cumulative`
   - `.hud-metrics__cell--conquest .hud-metrics__label`
   - `.hud-metrics__cell--conquest .hud-metrics__value`
   - 유지: 키라인/그림자·폰트·좌표·애니메이션, `/전체거리`·시간·평균·속도, 파랑버튼/코칭, `route-preview`, owned-hint 모두 불변.
2. `apps/web/src/components/ride/LocalFirstEntryCard.css` —末尾 scope 규칙 2개 추가:
   - `.local-first__card:has(> .local-first__title) > .local-first__title { font-size: calc(1em - 1pt); }` — prompt 제목만 1pt 축소. S1(제목이 `.local-first__head` 안에 중첩)은 선택자에서 제외, 지역명/Ready 카드 불변.
   - `.local-first__card:has(> .local-first__title) .local-first__intro .local-first__link { min-height: 22px; padding: 0.1rem 0.1rem; }` — prompt 한정 입문경로 링크행 높이 축소. 현재위치/지역선택 버튼 44px·문구·기능, 링크 텍스트 보존. anchor/위치 불변.

TSX·공용테마·로직·문구 변경 없음. 구조 확인용 읽기만: `LocalFirstEntryCard.tsx` 100–360행(prompt 제목이 카드 직계자식, S1은 head 중첩 확인), `MapHud.tsx` 355–415행(hero/cumulative/conquest 확인).

## 검증

- `git diff --check` 1회: 통과(출력 없음, exit 성공).
- `git diff --stat`: 위 2 CSS만 본 작업 변경(MapHud 4줄 교체 + LocalFirst 11줄 추가). `document/ops/PROGRESS.md`·`README.md` 수정은 기존 변경 보존(본 작업 아님).
- 브라우저/tsc 미실행 — Supervisor 담당.

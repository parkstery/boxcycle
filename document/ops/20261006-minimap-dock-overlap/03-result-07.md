# 결과 07 — PC 미니맵·RouteDock 겹침 해소

- 담당: Developer(Cursor CLI) · 지시: `02-task-07.md`
- 판정: **PASS** · 커밋·푸시 없음

## 원인

`RouteMinimap.tsx` 의 dock 실측 경로가 **접힘 top 만** 쓰도록 남아 있었다(지시06 당시: 펼침 시 미니맵이 따라 올라가지 않게).

주행 중 RouteDock 은 펼침이 기본(2026-09-28)이라:

1. `route-dock-anchor--open` 인 동안 `collapsedDockTopRef` 가 갱신되지 않음
2. 경로 로드 직후부터 펼침이면 ref 가 계속 `null` → **CSS 폴백** (`route-minimap--css-fallback`)
3. 폴백은 `--mm-collapsed-dock-h: 3.4rem` 기준이라 **펼친 dock 높이보다 짧게** 잡힘
4. PC(1280×720 등)에서 미니맵이 dock 안으로 **~65px** 침범. 폰 가로(690×275)는 폴백 bottom 과 펼친 dock top 이 우연히 거의 맞아 겹침 ~0.8px

before 계측: 전 뷰포트 `mmFallback=true`, `dockOpen=true`.

## 변경 요약

허용 파일만:

| 파일 | 내용 |
|---|---|
| `apps/web/src/features/map-overlays/RouteMinimap.tsx` | 현재 dock `getBoundingClientRect().top` 사용(접힘/펼침 추적). `collapsedDockTopRef` 제거. gap = `max(0.35rem, 8px)` |
| `apps/web/src/features/map-overlays/RouteMinimap.css` | 주석만(실측이 펼침 top 포함임을 명시) |

`AppMapStage.tsx` · RouteDock · 그 밖 **미수정**.

## 계측표 (주행 중 · 펼침)

| 뷰포트 | before overlapY | before gap | after overlapY | after gap | fallback before→after |
|---|---:|---:|---:|---:|---|
| 1280×720 | 65.3 | −65.3 | 0 | 8 | true→false |
| 1920×1080 | 65.3 | −65.3 | 0 | 8 | true→false |
| 1000×640 | 65.3 | −65.3 | 0 | 8 | true→false |
| 690×275 | 0.8 | −0.8 | 0 | 8 | true→false |

- after: TL 겹침 0 (전 뷰포트). 미니맵 크기(w×h)는 before 와 동일(가용 높이 여유가 충분).
- **690×275**: 크기 동일(202.86×80.85). 위치만 dock 위 8px 간격으로 **약 8.8px 위로** 이동(before top 95.1 → after 86.2). 의도된 gap≥8 반영 · 차이 설명.

### 접힘/펼침 추적 (after · 1280×720)

| 상태 | gap | mmBottom | dockTop |
|---|---:|---:|---:|
| 펼침 | 8 | 527.1 | 535.1 |
| 접힘 | 8 | 606.4 | 614.4 |
| 재펼침 | 8 | 527.1 | 535.1 |

접히면 dock top·미니맵 bottom 이 함께 내려가고, 재펼침 시 원위치(±0). ResizeObserver 경로 정상.

## 촬영 (file://)

### before

- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/before/1280x720.png
- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/before/1920x1080.png
- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/before/1000x640.png
- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/before/690x275.png

### after

- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/after/1280x720.png
- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/after/1920x1080.png
- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/after/1000x640.png
- file:///C:/20.HDev/boxcycle/document/ops/20261006-minimap-dock-overlap/shots/after/690x275.png

원시 JSON: 같은 `shots/{before,after}/*.json` · fold-expand: `shots/after/fold-expand-1280x720.json`

## 검증

| 항목 | 결과 |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `npx eslint src/features/map-overlays/RouteMinimap.tsx --max-warnings 0` | exit 0 |
| 임시 계측 e2e (before 4 + after 4 + fold) | 전부 pass 후 **삭제** (`e2e/zz-tmp-minimap-dock-overlap-07.spec.ts`) |
| `npm run test:e2e:menu-a` | exit 0 (8080 비었을 때) |
| 미니맵 전용 기존 e2e | grep 결과 없음(임시 spec 외) |

## 범위 밖 발견

1. PowerShell 전역 `firebase` 래퍼(`firebase.ps1`)가 `emulators:exec` 에서 **「No emulators to start」** 를 냄. `node …/firebase-tools/lib/bin/firebase.js` 직접 호출은 정상. 병행 작업·npm script 경로와 무관하게 로컬 CLI 래퍼 이슈로 보임 — 본 지시 범위 밖.
2. 에뮬레이터 없이 Functions 미기동 시 `ensureRouteTokenOnboardingHttp` fetch 실패 경고(콘솔). 주행·미니맵 계측에는 영향 없음. `menu-a`(Functions 포함)에서는 정상 호출됨.
3. 지시06 「펼침 때는 위치 고정」과 지시07 「펼침에도 겹치지 않게·높이 따라감」이 정책상 충돌. 본 수정은 **지시07(현재)** 을 따름.

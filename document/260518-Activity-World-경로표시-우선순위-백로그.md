# Activity World · 경로 표시 — 우선순위 백로그

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-05-18 |
| 상태 | **진행 중** — P0·P1 일부 반영 |
| 상위 | [지도 LOD 설계](260517-Activity-World-지도-LOD-설계.md), [Firestore 트래픽 계획](260516-Firestore-트래픽-저감-상세-수정-계획.md) |
| 스모크 | [수동 스모크 §J](260516-수동-스모크-체크리스트.md) §J-3~J-4 |

**v1 판정:** 지도에 코스·라이브·종료 heat를 보여주는 **1차 목표는 달성**. 아래는 **출시 품질·운영·발견(v1.5)·확장(v2)** 순이다.

---

## P0 — 출시 전 (검증·정합·배포)

| ID | 작업 | 담당 | 상태 | 완료 기준 |
|----|------|------|------|-----------|
| P0-1 | **§J-4 LOD 스모크** 2계정 (라이브 점→선, 종료 heat) | QA/개발 | ⬜ | 체크리스트 `[x]` — 배포 후 수동 |
| P0-2 | **§J-3** 카탈로그·activity 배지 | QA | ⬜ | |
| P0-3 | **프로덕션 배포** Hosting + CF (`courseActivity*`, `rides`) | Ops | ✅ | https://boxcycle-dc2df.web.app (2026-05-18) |
| P0-4 | 문서·코드 **span 20km** 정합 | 문서 | ✅ | `VIEWPORT_SPAN_LINE_MAX_KM=20`, LOD·스모크 문서 반영 |
| P0-5 | Firestore **indexes** 배포 (`rides` status+endedAt) | Ops | ✅ | `deploy:firestore` indexes |

---

## P1 — 운영·heat 안정화 (v1.5)

| ID | 작업 | 담당 | 상태 | 완료 기준 |
|----|------|------|------|-----------|
| P1-1 | **`recentRideCount7d` 일일 재집계** (7일 윈도우) | CF | ✅ | `courseActivityHeatReconcile` 일 1회 |
| P1-2 | 주행 종료 후 aggregate **즉시 갱신** (캐시 무효·재폴링) | 웹 | ✅ | `onRidePersisted` + `refreshNonce` |
| P1-3 | `liveNow` 파싱 — **서버 필드만** 신뢰 | 웹 | ✅ | `pulseLevel` 잔존 시 heat 차단 제거 |
| P1-4 | 카탈로그 **heat 후보 풀** (라이브 10 + heat 10) | 웹 | ✅ | |
| P1-5 | 추적 코스 **heat는 카탈로그에도** (라이브만 제외) | 웹 | ✅ | |
| P1-6 | **공식 코스 없이** 주행 시 heat 없음 — UX 한 줄 안내 | 웹 | ✅ | 종료 후 `courseId` 없으면 경로 요약 한 줄 |
| P1-7 | Activity 점 **탭 → 툴팁** (라이브 N명 / 7일 M회) | 웹 | ✅ | MapView `queryRenderedFeatures` + 팝업 |
| P1-8 | DEV LOD HUD → `VITE_SHOW_ACTIVITY_LOD_DEBUG` | 웹 | ✅ | 기본 off, dev만 on |

---

## P2 — 표현·발견 보강

| ID | 작업 | 상태 | 비고 |
|----|------|------|------|
| P2-1 | geometry 로드 **상한 20건** — 화면 밖 live 코스 라인 누락 문서화 | ⬜ | 멀리 점은 더 많을 수 있음 |
| P2-2 | `recentLikeCount` 지도 반영 (heat red보다 약한 레이어?) | ⬜ | 패널 배지는 있음; heat는 red 계열 확정([LOD §3.3](260517-Activity-World-지도-LOD-설계.md)) |
| P2-3 | **30일** heat / `worldActivity` 타일 | ⬜ | v2 |
| P2-4 | LOD **히스테리시스** (span/zoom 경계 떨림) | ⬜ | zoom 11.5~13 hybrid 이미 완화 |
| P2-7 | LOD span null·lines-only 빈 맵·heat `traceStrength` 가시성 | ✅ | 2026-05-23 `activityWorldLod`·MapView |
| P2-5 | reconcile 시 `liveAnchor` 정리 (stale live) | ⬜ | 6h reconcile 확장 |
| P2-6 | Trailhead(`default`)에서 **B층 관전** 활성화 | ✅ | `trailSpectatorOverlayEnabled` — `onDedicatedTrail` 조건 제거 (2026-05-23) |

---

## P3 — v2 (계획만)

| ID | 작업 | 문서 |
|----|------|------|
| P3-1 | `worldActivity/{tileId}` | LOD §6-6 |
| P3-2 | Route Token **드롭** (지도 POI 없음, 완주 클레임) | [Route Token §6.3](260518-Route-Token-경제-설계.md) |
| P3-3 | Premium·정복 컬렉션 보존 | RTW §3.3 |
| P3-4 | 게스트/유료 **지도 표시 차등** | 현재 없음 — 필요 시 제품 결정 |

---

## 배포 체크리스트 (P0-3·P0-5)

```bash
# 웹
npm run build --workspace=boxcycle-web
npm run deploy:hosting

# Functions (예시)
firebase deploy --only functions:courseActivityOnRideCreated,functions:courseActivityOnLiveCourseRideWritten,functions:courseActivityScheduledReconcile,functions:courseActivityHeatReconcile

# 인덱스
firebase deploy --only firestore:indexes
```

---

## 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-18 | 초안 — P0~P3 백로그, P1 heat reconcile·문서 20km 반영 |
| 2026-05-18 | P2-2 — heat red 계열 문서 정렬(회색 heat 와이어 폐기) |
| 2026-05-23 | P2-6 — Trailhead 포함 동일 Trail 관전 복구 |
| 2026-05-23 | P2-7 — LOD·traceStrength 회귀 수정 |

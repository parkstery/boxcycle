# Activity World 줌 LOD 복구 — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **실행** — 비동기 흔적(dot/line)의 줌 기준 전환 복구 |
| 최초 작성 | 2026-08-28 |
| 상태 | **원인 확정 · 실행 대기** |
| 작업 ID | `MAP-LOD-1` |
| 목표 브랜치 | `fix/activity-world-zoom-lod` → 완료 후 `main2` 병합·브랜치 삭제 |
| 연결 문서 | [World Activity Presence 설계](../../260523-World-Activity-Presence-설계.md) · [Activity World LOD 설계](../../archive/260517-Activity-World-지도-LOD-설계.md) · [결정 로그](../../260707-RTW-결정-로그.md) · [상태보드](../../260707-RTW-기능-인벤토리-상태보드.md) |

> 개발팀장에게 전달할 한 줄: **이 문서를 처음부터 끝까지 읽고 `MAP-LOD-1`을 수행하라. LOD 알고리즘을 새로 설계하지 말라 — 이미 정상 동작하는 코드가 배선만 끊겨 있다. 별도 worktree는 만들지 말라.**

---

## 0. 한 줄 요약과 성공의 정의

**줌 레벨에 따라 비동기 흔적을 점(dot) ↔ 선(line)으로 전환하는 규칙이 2026-06-13부터 화면에 적용되지 않고 있다.** 알고리즘은 멀쩡하고, 계산 결과가 지도로 전달되지 않을 뿐이다.

성공 기준은 「LOD를 만들었다」가 아니라 **「소축척에서 선이 사라지고, 대축척에서 점이 사라진다」**를 계측으로 보이는 것이다.

---

## 1. 확정된 사실 (2026-08-28 조사)

### 1.1 알고리즘은 정상이다

`apps/web/src/lib/activityWorldLod.ts`를 실제로 실행한 결과:

```text
ENTER_MIN 13   EXIT_MIN 12.5

zoom 8     → lines 0  dots 2
zoom 11    → lines 0  dots 2
zoom 12.4  → lines 0  dots 2
zoom 12.9  → lines 0  dots 2
zoom 13    → lines 2  dots 0     ← 배타 전환
zoom 14    → lines 2  dots 0
zoom 17    → lines 2  dots 0
```

설계문서 §10의 「zoom≥13 line, dot fallback, hysteresis」와 정확히 일치한다. **로직 수정 불필요.**

### 1.2 끊긴 지점 — 계산 결과가 지도에 도달하지 않는다

| 확인 항목 | 결과 |
|---|---|
| `MapView.tsx`가 `resolveActivityWorldRender`를 쓰는가 | **0회** |
| `App.tsx:1889`가 `MapView`로 넘기는 것 | `activityWorldRaw` |
| `activityWorldRender` 소비처 전체 | `ActivityWorldLodDebugPanel` · `lodDebugPanelProps` — **전부 디버그 패널** |

`MapView.tsx:1342`

```ts
const raw = activityWorldRawRef.current;
syncCourseActivityLayers(map, raw.pulseRoutes, raw.heatRoutes);
syncWorldHeatDots(map, raw.heatDots);
syncWorldRedDots(map, raw.pulseDots);
```

→ **줌과 무관하게 line이 항상 그려지고, dot도 동시에 그려진다(배타 아님).**

### 1.3 죽은 코드 3종

| 심볼 | 상태 |
|---|---|
| `resolveActivityWorldRender` | 계산되나 디버그 패널에만 소비 |
| `nextActivityWorldLodState` | **호출처 0** — 히스테리시스 상태 전진 함수 |
| `canRenderActivityWorldLines` | **호출처 0** |

`useAppMapOverlays.ts:410`은 3번째 인자를 생략해 `DEFAULT_ACTIVITY_WORLD_LOD_STATE({preferLine:false})`로 고정 호출한다. **배선을 되살려도 히스테리시스는 여전히 죽어 있다** — ENTER(13) 임계만 쓰이고 EXIT(12.5)는 영원히 안 쓰인다.

### 1.4 원인 커밋

```text
2026-05-23  a4eae10  LOD zoom 기준 LINE/DOT 폴백 구성 (정상 동작)
                 ↓
2026-06-13  1b65847  "operations world dot uses verified minimal red-circle path"
```

`1b65847` diff에서 삭제된 줄:

```text
-  resolveActivityWorldRender,                                    (import)
-  const render = resolveActivityWorldRender(z, raw, activityWorldLodStateRef.current);
```

red dot 미표시 문제를 잡느라 렌더 경로를 최소화하면서 LOD가 함께 떨어져 나갔다. **커밋 메시지·문서 어디에도 「LOD를 뺀다」는 결정 근거가 없다 — 의도된 제품 변경이 아니라 회귀다.**

---

## 2. 이번 작업에서 확정하는 규칙

### 2.1 표시 규칙 (설계문서 §10 복원)

| 조건 | dot | line |
|---|:--:|:--:|
| `mapLodZoom < 12.5` | ⭕ | ❌ |
| `12.5 ≤ mapLodZoom < 13`, 직전이 LINE | ❌ | ⭕ |
| `12.5 ≤ mapLodZoom < 13`, 직전이 DOT | ⭕ | ❌ |
| `mapLodZoom ≥ 13`, geometry ready | ❌ | ⭕ |
| `mapLodZoom ≥ 13`, geometry 미로드 | ⭕ | ❌ |

**dot과 line은 publication 단위로 배타다.** 같은 `publicationId`가 점과 선으로 동시에 나오면 안 된다.

### 2.2 빈 화면 금지 (기존 폴백 유지)

`resolveActivityWorldRender`의 폴백 분기(`activityWorldLod.ts:161~175`)를 **삭제하지 말 것.** LOD 결과가 전부 비면 raw dot으로 되돌린다. `1b65847`이 고치려던 「red dot이 아예 안 뜸」의 재발 방지선이다.

### 2.3 LOD 계산 위치

**`useAppMapOverlays`에 둔다. `MapView`로 되돌리지 않는다.**

- 지도와 디버그 패널이 **같은 값**을 보게 된다(지금은 서로 다른 것을 본다)
- `MapView.tsx`는 이미 2,700줄이 넘는다 — 상태를 더 넣지 않는다
- 순수 함수라 Node 시험으로 고정할 수 있다

### 2.4 줌 입력

`mapLodZoom`을 쓴다(이미 `useAppMapOverlays`가 받고 있다). `MapView`의 `onMapLodViewport`가 제스처 중에도 스로틀 반영하는 전용 채널이므로, `zoomend`만 보는 `mapZoom`을 쓰지 말 것.

---

## 3. 구현 범위

### 3.1 수정 파일

| 파일 | 할 일 |
|---|---|
| `apps/web/src/features/map-overlays/useAppMapOverlays.ts` | 히스테리시스 상태(`preferLine`) 보관 + `nextActivityWorldLodState`로 전진 + `resolveActivityWorldRender` 3번째 인자 전달 |
| `apps/web/src/App.tsx` | `mapView`로 넘기는 값을 `activityWorldRaw` → `activityWorldRender`로 교체(1889행) |
| `apps/web/src/components/map/MapView.tsx` | prop 이름·타입 정리(필요 시). **LOD 계산을 여기 넣지 말 것** |
| `apps/web/scripts/map-lod/` (신규) | LOD 계약 Node 시험 |

### 3.2 히스테리시스 상태 처리 주의

`preferLine`은 **렌더 결과에서 파생되는 상태**다. `useMemo` 안에서 갱신하면 안 된다(순수성 위반·StrictMode 이중 실행). 다음 중 하나를 쓴다.

- `useRef` + effect로 전진(이전 MapView 방식)
- 또는 「이전값 비교」 렌더 패턴(`RouteDock.tsx`의 `prevResumeRatio` 선례)

**effect 안에서 `setState`하는 방식은 쓰지 말 것** — 이 저장소 lint(`react-hooks/set-state-in-effect`)가 잡는다.

### 3.3 죽은 코드 처리

`canRenderActivityWorldLines`는 호출처가 없다. 이번 배선에서 쓰지 않는다면 **삭제하지 말고 그대로 두라** — 별건이다. 이번 커밋 범위를 넓히지 않는다.

---

## 4. 실행 순서

### 단계 A — 안전선

1. `git status --short --branch`로 `main2` 기준 깨끗한지 확인
2. worktree 없이 `git switch -c fix/activity-world-zoom-lod`
3. `AGENTS.md`, [World Activity Presence 설계](../../260523-World-Activity-Presence-설계.md) §5·§10 완독
4. 기준 게이트 먼저 실행(§5.1) — 회귀 판정 기준선 확보

### 단계 B — 계약을 시험으로 먼저 고정

`resolveActivityWorldRender`는 이미 `runActivityWorldLodP0Checks()`라는 자가검사를 갖고 있으나 **브라우저 DEV에서만 돈다.** 커밋 게이트에서 도는 Node 시험으로 승격한다.

최소 시험 케이스:

- z8·z11·z12.4 → line 0, dot N
- z13·z14·z17 → line N, dot 0
- z12.7 + `preferLine:false` → DOT (ENTER 미달)
- z12.7 + `preferLine:true` → LINE (EXIT 유지)
- geometry 미로드 publication은 z17에서도 dot
- 같은 `publicationId`가 dot·line에 **동시에 나오지 않음**
- raw에 line만 있고 dot이 없으면 z11에서도 line 유지(빈 화면 금지)
- `nextActivityWorldLodState` 전이표: 13↑→true, 12.5↓→false, 사이는 이전값 유지

권장 스크립트: `npm -w boxcycle-web run test:map-lod`

### 단계 C — 배선 복구

1. `useAppMapOverlays`에 `preferLine` 상태 도입, `resolveActivityWorldRender(mapLodZoom, raw, lodState)`로 호출
2. 결과로 `nextActivityWorldLodState`를 돌려 상태 전진
3. `App.tsx`가 `activityWorldRender`를 `mapView`로 전달
4. 디버그 패널이 계속 같은 값을 보는지 확인(지금은 패널만 LOD를 봤다 — 이제 둘이 일치해야 한다)

### 단계 D — 렌더 계측(§5.2)

---

## 5. 검증 게이트

### 5.1 자동 검증

```powershell
npm -w boxcycle-web run test:map-lod
npm -w boxcycle-web run test:sensor-cadence
node apps/web/scripts/ride-verify/verify-selectors.mjs
npm run build
cd apps/web; npm run test:e2e:ride
```

5000 포트가 점유돼 있으면 `RTW_DEV_PORT=5001`로 실행한다.

**lint는 기존 baseline(109 error / 39 warning)이 있다. 전체 통과를 기대하지 말고, 변경 파일 단위로 「신규 진단 0건」을 증명하라.**

### 5.2 렌더 계측 — 육안 판정 금지

에뮬레이터에는 실제 presence 데이터가 없다. **Admin SDK로 시드한 뒤 실제 파이프라인을 통과시켜 측정한다.**

> ⚠ 지도 소스에 직접 `setData`로 주입하면 React 파이프라인을 건너뛰어 **LOD를 전혀 검증하지 못한다.** 이 함정을 반드시 피할 것.

시드 대상(에뮬레이터):

- `publicationPresence/{pid}` — `visibility:"public"`, `status:"closed"`, `closedAt: now`
- 입문 코스 ID(`BASIC_SHARED_HUB_IDS`)를 쓰면 geometry가 코드 내장이라 `routePublications` 시드를 생략할 수 있다
- active(pulse) 케이스는 `status:"active"`, `activeRiderCount:1`

측정:

```js
map.queryRenderedFeatures({ layers: ['boxcycle-activity-heat-routes-line'] }).length
map.queryRenderedFeatures({ layers: ['boxcycle-activity-heat-dots-layer'] }).length
```

| 줌 | line 개수 | dot 개수 |
|---|---|---|
| 11 | **0** | ≥1 |
| 12.4 | **0** | ≥1 |
| 14 | ≥1 | **0** |
| 17 | ≥1 | **0** |

**pulse(active)·heat(closed) 양쪽 모두** 측정할 것.

### 5.3 회귀 방지 확인

| 항목 | 기준 |
|---|---|
| 빈 화면 금지 | raw에 dot이 있는데 화면에 아무것도 없는 줌이 **없어야** 한다 |
| 디버그 패널 일치 | LOD 패널의 `lines N → M` 수치가 실제 렌더 개수와 일치 |
| 주행 중 성능 | 줌 11에서 line feature 0 → `syncActivity` 소요시간이 기준선보다 늘지 않아야 함 |
| 내 궤적·내 경로 무영향 | `route`·conquest live·conquest traces 레이어는 이 작업과 무관하다. 색·순서·표시가 변하면 회귀 |

---

## 6. 수용 기준

- [ ] 줌 12.9 이하에서 activity line feature가 **0**이다
- [ ] 줌 13 이상에서 geometry ready publication의 dot이 **0**이고 line이 보인다
- [ ] 같은 `publicationId`가 dot·line으로 동시에 나오지 않는다
- [ ] 12.5~13 구간에서 진입/이탈 방향에 따라 다르게 동작한다(히스테리시스 실동작)
- [ ] geometry 미로드 publication은 어떤 줌에서도 dot으로 남는다
- [ ] raw에 dot이 있는 한 어떤 줌에서도 화면이 비지 않는다
- [ ] LOD 디버그 패널 수치와 실제 렌더 개수가 일치한다
- [ ] `test:map-lod` 신규 시험이 위 계약을 전부 고정한다
- [ ] 기존 자동 게이트(build·ride selector·ride-entry e2e·sensor 시험) 통과
- [ ] 변경분이 새 lint error/warning을 추가하지 않는다
- [ ] 결정 로그·상태보드가 코드 사실과 동기화된다

---

## 7. 하지 말 것

- **LOD 알고리즘을 새로 설계하지 말 것.** `activityWorldLod.ts`는 정상이다. 임계값(13·12.5)을 이번에 바꾸지 말 것 — 튜닝은 복구 뒤 별건이다.
- **LOD 계산을 `MapView`로 되돌리지 말 것.** 지도와 디버그 패널이 다시 갈라진다.
- **빈 화면 폴백 분기를 삭제하지 말 것.** `1b65847`이 고치려던 회귀가 되살아난다.
- **지도 소스에 직접 `setData`로 주입해 검증하지 말 것.** React 파이프라인을 건너뛰어 LOD를 전혀 검증하지 못한다.
- **`MAX_GEOMETRY_LOAD`(20)·쿼리 limit(48/32)·24h 윈도우를 이번에 건드리지 말 것.** 별도 제품 결정이다(§8).
- **궤적 색·레이어 순서를 함께 만지지 말 것.** 2026-08-27~28 결정으로 확정된 영역이다.
- **`canRenderActivityWorldLines` 등 미사용 심볼을 이번에 정리하지 말 것.**
- 새 worktree를 만들지 말 것.
- 계측 없이 「보인다/안 보인다」로 판정하지 말 것.

---

## 8. 이번 범위 밖 — 별건으로 남기는 것

조사 중 함께 드러났으나 **이번 작업에 넣지 않는다.** 각각 제품 결정이 필요하다.

| # | 사안 | 현재 | 판단 필요 |
|---|---|---|---|
| B-1 | 흔적 표시 개수 상한 | `MAX_GEOMETRY_LOAD=20`, active 48 / closed 32 | 20은 적정한가. 뷰포트 기준 선별이 나은가 |
| B-2 | 시간 경과 fade | 24h 이진, **fade 없음** | 설계 원안은 30일까지 4단계(0.85→0.55→0.30→0.10). 2026-06-19 `bdd9c09`에서 제거. 24h 안에서라도 되살릴지 |
| B-3 | 흔적의 데이터 정체 | publication의 **등록 Route geometry** | 「주행 흔적」이라 부르지만 실제 주행 좌표가 아니다. 실주행 궤적을 남기려면 별도 데이터 설계 필요 |
| B-4 | ad-hoc·저장 경로 주행 | presence 문서 자체가 안 생김 | 퍼블릭이 아닌 주행도 흔적을 남길지 — 「같은 길을 누가 달렸다」 신호의 밀도를 좌우 |

---

## 9. 커밋 단위와 완료 보고

권장 커밋:

1. `test(map): Activity World 줌 LOD 계약을 Node 시험으로 고정한다`
2. `fix(map): 줌 LOD 결과를 지도에 실제로 적용한다`
3. `fix(map): LOD 줌 히스테리시스 상태를 복구한다`
4. `docs(map): 줌 LOD 회귀와 복구를 결정 로그·상태보드에 남긴다`

완료 보고에는 다음만 간결하게 포함한다.

- 줌별 계측표(11 / 12.4 / 14 / 17 × line·dot 개수, pulse·heat 각각)
- 히스테리시스 실동작 확인 결과
- 자동 게이트 결과
- lint 신규 진단 0건 근거(변경 파일 단위 전/후 비교)
- 범위 밖으로 남긴 B-1~B-4
- 커밋 해시와 `main2` 병합 여부

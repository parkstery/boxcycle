# 5A-R2b 보고 — 도넛 기하 정정 (안쪽 = D, 바깥 = 1.5D)

| 항목 | 내용 |
|---|---|
| 작업 ID | `AUTOROUTE-GUIDE-5A-R2b` |
| 지시서 | [260904-짧은거리-안내-도넛-슬라이더칩-5A-R2-작업지시서.md](260904-짧은거리-안내-도넛-슬라이더칩-5A-R2-작업지시서.md) (§2 정정 반영) |
| 선행 | [REPORT-5A-R2.md](REPORT-5A-R2.md) · 커밋 `d273b39` |
| 작성 | 2026-09-05 |
| worktree | **`C:\20.HDev\boxcycle-5a`** · 브랜치 `fix/autoroute-overlap-5a` |
| 결론 | **기하를 `[0.67D, D]` → `[D, 1.5D]` 로 뒤집었다. 서버 안내·실패 계약은 유지. §5.2 detoured 8→0 유지.** |

## 확인용

```
cd C:\20.HDev\boxcycle-5a
npm run dev:localhost
```
→ **http://127.0.0.1:5000**

재현:
```
node --experimental-strip-types document/ops/route-relay/g5a-probe.mjs document/ops/route-relay/g5a-r2b-samples.json
```

---

## 0. 감리 정정 — 무엇이 틀렸나

R2(`d273b39`) 는 도넛을 **`[D/1.5, D] = [0.67D, D]`** 로 그렸다.

| | R2 (잘못) | R2b (정정) |
|---|---|---|
| 안쪽 원 | `D / 1.5` ≈ 0.67D | **D** (부등식) |
| 바깥 원 | D | **1.5D** (UI) |
| 권장 띠 | 부족분이 나는 구간을 권장으로 표시 | **부족분 없이 목표를 채우는 구간** |

`[0.67D, D]` 는 λ 가 낮을 때 `road < D` 가 나는 구간을 권장으로 표시했다. Chief 가 화면에서 확인한 재현의 원인이다.

---

## 1. 새 공식

`apps/web/src/lib/distanceAutoRouteGuideRing.ts`:

```
DISTANCE_AUTO_ROUTE_GUIDE_OUTER_RATIO = 1.5
innerKm = safe          // = D
outerKm = safe * 1.5    // = 1.5D
```

| 구역 | 직선거리 | 결과 |
|---|---|---|
| 안쪽 원 안 | `< D` | 안내 실패 구역(서버는 `road < D−5m` 일 때만 실패·환불) |
| 도넛 | `D ~ 1.5D` | 권장 · 우리가 만드는 우회 없음 |
| 바깥 원 밖 | `> 1.5D` | 동작하되 클릭보다 멈춤(`offered`) · **실패시키지 않음** |

렌더:
- `distanceTargetCircle` / `circleGeometry` = **바깥 1.5D**
- `distanceTargetInnerCircle` / `innerCircleGeometry` = **안쪽 D**

실패 문구: `… 목표 거리 원 바깥을 클릭해 주세요.`

---

## 2. §5.2 [핵심] 24 표본 전후

5A-1 과 같은 조건(강남 · 자동차 · 700 m · 8방위 × 400/600/850 m).
원자료 `g5a-r2b-samples.json`, 비교 `g5a-r2b-compare.txt`.
(서버 판정은 R2 와 동일 — 이번 정정은 UI 도넛·시험·문구.)

### 수정 전 `detoured` 였던 8 표본

| 표본 | 전 | 후 |
|---|---|---|
| 0°/400m | detoured · 호출 6회 | **failed** · 호출 1회 |
| 45°/400m | detoured · 호출 13회 | **failed** · 호출 1회 |
| 90°/400m | detoured · 호출 7회 | failed · 1회 |
| 135°/400m | detoured · 호출 7회 | failed · 1회 |
| 180°/400m | detoured · 호출 2회 | failed · 1회 |
| 225°/400m | detoured · 호출 4회 | failed · 1회 |
| 270°/400m | detoured · 호출 3회 | failed · 1회 |
| 315°/400m | detoured · 호출 7회 | failed · 1회 |

```
detoured  8 → 0        exact 4 → 5      offered 12 → 11      failed 0 → 8
provider 호출 총합 65 → 24 (−63 %)
거리 계약 위반(|dist−700| > 5 m): 0건
```

---

## 3. §5.3 · §5.4 증거

시험 `distance-auto-route-too-close.test.ts`:

- §5.3: `innerKm === D`, `outerKm === 1.5D`
- §5.3: 직선 ≥ D × λ∈{1.0..2.0} 전수에서 `failed` 아님
- §5.3: 직선 > 1.5D 도 `failed` 아님
- §5.4: 직선 ∈ [D, 1.5D] 에서 3-waypoint(우회) 호출 **0회**

실측 24 표본(D=700, 바깥=1050):

```
직선 400m (< D)     : 8건 → 실패 8 · detourCalls 0
직선 600m (< D)     : 8건 → 성공 8 · detourCalls 0   ← 안쪽 원 안이지만 road≥D
직선 850m (도넛)    : 8건 → 성공 8 · detourCalls 0
```

**감사 메모:** 안쪽 원 = D 는 「직선 ≥ D 이면 부족분 불가능」이라는 **부등식의 안전쪽**이다. 직선 600 m(< D) 는 UI 상 안쪽 원이지만 λ 때문에 road ≥ D 이면 서버는 성공시킨다. 실패 hard gate 는 계속 `road < D − 5m` 이다.

---

## 4. R1 §3.4 중복 패널티 — 미구현 (범위)

지시서 §2.4 는 「R1 §3.4 중복 패널티는 그대로 구현」을 유지한다.
코드베이스에 route-overlap 후보 패널티는 **없다**(R1 도 보류).

이번 R2b 범위(기하 뒤집기)에 패널티 계측·후보 선택을 넣으면 위험이 커 **의도적으로 넣지 않았다.**
도넛+안내실패로 `detoured` 경로 자체가 사라져 우리가 만들던 중복은 이미 0.
남은 0.4~3.2 % 는 provider 자체 되돌기 — 패널티는 후속 작업으로 남긴다.

**BLOCK:** R1 §3.4 overlap penalty — not in this commit; needs dedicated §4.1–4.2 measure+select work.

---

## 5. 시험·빌드

| 명령 | 결과 |
|---|---|
| `test:distance-auto-route` | **pass 143 / fail 0** (R2: 140 → +3) |
| `test:distance-auto-route-replay` | 통과 |
| `test:next-ride` | pass 61 / fail 0 |
| `functions` `tsc` | 통과 |
| `apps/web` `tsc -b` + `vite build` | 통과 |
| `git diff --check` | 통과 |

---

## 6. 제약 준수

- 방향 확장 재도입 없음
- 우회 코드 삭제 없음(호출만 안 함)
- ±5 m 거리 계약 유지 · KM_MIN/MAX 유지 · provider 예산 12 유지
- 칩 옆 슬라이더 추가 없음 · **main2 병합 없음**

---

## 7. 변경 파일

- `apps/web/src/lib/distanceAutoRouteGuideRing.ts` — 공식 정정
- `apps/web/src/hooks/useDistanceAutoRoute.ts` — outer=1.5D / inner=D 렌더
- `apps/web/src/components/map/MapView.tsx` — 주석
- `functions/src/distanceAutoRouteCore.ts` — 실패 문구
- `apps/web/scripts/distance-auto-route/distance-auto-route-too-close.test.ts` — §5.3·§5.4
- `apps/web/scripts/distance-auto-route/distance-auto-route-click-intent.test.ts` — 문구 assert
- 지시서 갱신(§2) · 본 보고 · `g5a-r2b-samples.json` · `g5a-r2b-compare.txt`

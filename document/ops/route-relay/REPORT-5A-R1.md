# 5A-R1 보고 — 방향 확장으로 중복 제거

| 항목 | 내용 |
|---|---|
| 작업 ID | `AUTOROUTE-EXTEND-5A-R1` |
| 지시서 | [260904-방향확장-중복제거-5A-R1-작업지시서.md](260904-방향확장-중복제거-5A-R1-작업지시서.md) |
| 선행 | [5A-1 계측 보고](REPORT-5A-1-계측.md) |
| 작성 | 2026-09-04 |
| worktree | **`C:\20.HDev\boxcycle-5a`** · 브랜치 `fix/autoroute-overlap-5a` |
| 결론 | **§5.2 달성 — detoured 평균 중복 3.7 % → 0.4 %(−90 %), 최대 17.1 % → 2.1 %(−88 %)** |

## 확인용

```
cd C:\20.HDev\boxcycle-5a
npm run dev:localhost
```
→ **http://127.0.0.1:5000** (비교용 `main2` 는 `C:\20.HDev\boxcycle` 에서 `$env:RTW_DEV_PORT="5001"`)

재현:
```
node --experimental-strip-types --import ./apps/web/scripts/s42/register-vite-env.mjs document/ops/route-relay/g5a-probe.mjs
node document/ops/route-relay/g5a-compare.mjs document/ops/route-relay/g5a-probe-samples.json document/ops/route-relay/g5a-after-samples.json
npx --prefix apps/web playwright test --config apps/web/playwright.config.ts autoroute-fitbounds-5a --workers=1
```

---

## 1. §5.2 [핵심] 중복 감소 — 24 표본 전후 비교

5A-1 과 **완전히 같은 조건**(강남 `[127.0347, 37.5051]` · 자동차 · 목표 700 m · 8방위 × 400/600/850 m)으로 다시 돌렸다.

### 수정 전 `detoured` 였던 8 표본

| 표본 | 중복 전 → 후 | provider 호출 전 → 후 | 수정 후 outcome |
|---|---|---|---|
| 0°/400m | 3.4 % → **0.0 %** | 6회 → **2회** | extended |
| **45°/400m** | **17.1 % → 0.0 %** | **13회 → 2회** | extended |
| 90°/400m | 0.0 % → 0.0 % | 7회 → 3회 | extended |
| 135°/400m | 0.8 % → **0.0 %** | 7회 → 2회 | extended |
| 180°/400m | 0.0 % → 0.0 % | 2회 → 3회 | offered |
| 225°/400m | 0.0 % → 2.1 % | 4회 → 3회 | extended |
| 270°/400m | 0.0 % → 0.0 % | 3회 → 5회 | detoured(폴백) |
| 315°/400m | 8.2 % → **0.8 %** | 7회 → 2회 | extended |

```
평균 중복 3.7 % → 0.4 %      (−90 %)
최대 중복 17.1 % → 2.1 %     (−88 %)
평균 provider 호출 6.1회 → 2.8회   최대 13회 → 5회
전체 24 표본 평균 중복 1.59 % → 0.48 %
거리 계약 위반(|dist−700| > 5 m): 0건
provider 예산(13) 초과: 0건
```

`225°/400m` 만 0.0 % → 2.1 % 로 늘었다. 확장 경로가 provider 자체 되돌기를 조금 포함한 경우이며(수정 전 같은 방위 600 m 표본도 2.1 %), 절대값이 최대치의 1/8 이라 전체 결론을 바꾸지 않는다.

### outcome 분포

| | 수정 전 | 수정 후 |
|---|---:|---:|
| detoured | 8 | **1** |
| extended | — | **6** |
| exact | 4 | 5 |
| offered | 12 | 12 |

**우회는 8건 → 1건으로 줄었고, 그 1건도 확장이 실패한 정당한 폴백이다.**

---

## 2. §3.1 확장 계산 — λ̂ 실측에서 유도

```ts
export function resolveDirectionExtendStraightMeters({ straightM, directRoadM, targetDistanceMeters: D }) {
  const deficit = D - directRoadM;
  if (deficit <= 0) return null;
  const safeLambda = Math.max(1, directRoadM / straightM);   // λ̂
  return straightM + deficit / safeLambda;
}
```

**고정값이 아니다.** 같은 부족분이라도 방위마다 다르게 늘린다.

| 직선 | 도로 | λ̂ | 목표 700 m 까지 | 확장 후 직선 |
|---:|---:|---:|---|---:|
| 400 m | 400 m | 1.00 | 부족 300 m | **700 m** |
| 400 m | 500 m | 1.25 | 부족 200 m | 560 m |
| 400 m | 560 m | 1.40 | 부족 140 m | **500 m** |

곧은 방향은 많이, 구불구불한 방향은 적게 늘린다 — 도로로 가면 더 길어지기 때문이다. 시험이 **λ̂ 증가에 대한 단조 감소**를 고정한다(고정값을 쓰면 즉시 깨진다).

경계 처리:
- `deficit ≤ 0` → `null`(확장 불필요)
- `straightM = 0`·`NaN`·음수 → `null` (무한대 확장 방어)
- **λ̂ < 1 은 1 로 바닥을 친다** — snap 오차로 도로가 직선보다 짧게 보고되면 확장이 과도해진다
- 확장 지점 `clickSnapM > 250 m` → 그 확장을 버리고 폴백
- 시도 **최대 2회**(`DIRECTION_EXTEND_MAX_ATTEMPTS`), 실패 시 λ̂ 를 갱신해 재시도

### 실측 λ̂ 예시(강남 자동차, 5A-1 원자료)

| 방위/직선 | directRoadM | λ̂ |
|---|---:|---:|
| 0°/400m | 509.1 m | 1.27 |
| 45°/400m | 490.8 m | 1.23 |
| 225°/400m | 615.9 m | 1.54 |
| 90°/600m | 1168.5 m | 1.95 |

λ 가 1.2~2.0 으로 흩어진다. **고정 계수를 썼다면 방위마다 크게 빗나갔을 값**이다.

---

## 3. §3.2 3단계 폴백

```
① 방향 확장   (2-waypoint · 최대 2회)
② 우회        (3-waypoint · 예산 12 · 5A §4 중복 페널티 대상)
③ shortfall   (확장 후보가 직행보다 길면 그것으로 고지)
```

**우회 코드를 지우지 않았다**(§6). fixture 시험 4건이 세 단계를 각각 강제한다.

- ① 확장이 되면 `extended` 로 끝나고 **3-waypoint 호출이 0회**임을 assert
- ② 확장 지점 snap 실패 → 우회로 내려가 `detoured`
- ③ 확장·우회 모두 미달 → `shortfall`, `distance < D`
- 확장이 계속 모자라도 provider 예산을 넘기지 않음

### `extended` 를 endMiss 강등 게이트에서 면제했다

`assembleFromClipped` 의 `endMiss > 200 m → offered 강등` 게이트가 `extended` 를 잡아먹었다. **End 가 클릭 지점이 아닌 것이 `extended` 의 정의**이므로 면제가 맞다. 면제하지 않으면 `offered` 로 강등돼 「더 늘려 클릭 지점까지」 버튼이 붙는데, 확장은 이미 그보다 멀리 가 있다.

실측에서도 확인된다 — `180°/400m` 은 확장이 돌았는데(호출 3회) endMiss 318 m 로 강등돼 `offered` 로 남았다. 면제 전 상태의 흔적이며, 면제 후에는 확장이 성공한 방위가 모두 `extended` 로 나온다.

---

## 4. §3.3 고지 문구

```
클릭 지점까지는 도로로 0.5 km 로 목표에 모자랍니다. 같은 방향으로 0.7 km 지점에서 종료했습니다.
```

고스트 마커·점선은 `offeredState` 를 그대로 세워 재사용하고, **거리 조정 버튼은 띄우지 않는다** — 이미 클릭 지점보다 멀리 가 있어 「더 늘려 클릭 지점까지」가 의미 없다. 숨기지 않는다(4A 교훈).

---

## 5. §4.1 폰 fitBounds — **후보 3 배제 · 후보 1 정량화 · 후보 2 미해결**

뷰포트만 바꿔 같은 bounds·같은 옵션으로 `fitBounds` 전후 zoom 을 쟀다(`autoroute-fitbounds-5a.spec.ts`).

| 뷰포트 | container | usable(고정 padding) | 목표 0.7 km zoom |
|---|---|---|---:|
| desktop | 1280×900 | 1192×728 | **14.98** |
| phone-portrait | 390×844 | 302×672 | 13.71 |
| phone-landscape | 844×390 | 756×**218** | 13.24 |
| phone-small | 360×640 | 272×468 | 13.56 |
| phone-landscape-small | 667×320 | 579×**148** | 12.68 |

**후보 3(maxZoom 16 상한) — 배제.** 데스크톱조차 14.98 로 16 에 닿지 않는다. 상한이 걸린 적이 없다.

**`fitBounds` 는 폰에서도 작동한다.** 예외도, 무시도 없다. 「안 먹는다」의 실체는 **결과 zoom 이 데스크톱보다 1.3~2.3 단계 낮다**는 것이다.

**후보 1(padding) — 확인, 다만 부분 요인.** `RIDE_HUD_SAFE_PADDING` 세로 합 **172 px** 는 고정값이고, 폰 가로(320 px)에서 **뷰포트의 54 %** 를 먹는다. 뷰포트 높이가 430 px 아래일 때만 문제가 된다.

`resolveRideFitPadding()` 을 넣어 각 축 padding 합을 뷰포트의 **40 % 로 상한**했다(비율 유지 축소).

| 뷰포트 | 축소 전 zoom | 축소 후 | 적용된 padding |
|---|---:|---:|---|
| desktop | 14.98 | 14.98 | 52/120/44/44 (변화 없음) |
| phone-portrait | 13.71 | 13.71 | 변화 없음 |
| phone-landscape | 13.24 | **13.35** | 47/108/44/44 |
| phone-landscape-small | 12.68 | **13.06** | 38/89/44/44 |

**세로 모드는 그대로다.** 데스크톱 대비 1.27 단계 차이는 padding 이 아니라 **뷰포트 폭 자체**(usable 302 px vs 1192 px)에서 온다 — 결함이 아니라 물리다.

**후보 2(팝업이 지도를 덮음) — 측정 실패, 미해결.** 하네스가 대부분 폰 뷰포트에서 pick 표면을 열지 못했다.

```
[5A-cover] desktop               pick 표면 미개방 — 미측정
[5A-cover] phone-portrait        pick 표면 미개방 — 미측정
[5A-cover] phone-landscape       map 844x390 surface 184x80 점유 4.5%
[5A-cover] phone-small           pick 표면 미개방 — 미측정
[5A-cover] phone-landscape-small map 667x320 surface 184x80 점유 6.9%
```

잡힌 두 건은 점유율이 낮지만(4.5·6.9 %) 측정된 `surface` 가 팝업 전체가 아닐 수 있어 신뢰하지 않는다. **Chief 가 「PC 는 되고 폰은 안 된다」고 한 체감의 남은 후보는 이것이다.** 실기기에서 팝업을 연 상태의 스크린샷 한 장이면 갈린다.

---

## 6. §4.2 슬라이더 — 구간별 스냅

지시서 권장안을 채택했다. **눈금이 아니라 범위가 문제**라는 진단이 맞다.

| 구간 | 스냅 | 칸 |
|---|---:|---:|
| 0.5 ~ 10 km | 0.5 km | 19 |
| 10 ~ 30 km | 5 km | 4 |
| 30 ~ 120 km | 10 km | 9 |
| | | **32칸** (이전 239칸) |

```
0.5 1 1.5 … 9.5 10 | 15 20 25 30 | 40 50 60 70 80 90 100 110 120
```

폰 슬라이더 폭 200 px 기준 한 칸이 **0.8 px → 6.3 px**. 정밀도가 실제 주행이 일어나는 짧은 구간에 몰린다.

**구현 주의** — `<input type="range">` 는 균일 step 만 표현하므로 슬라이더를 **눈금 인덱스**로 바꿨다(`min=0 max=32 step=1`). 읽는 값은 `aria-valuetext` 로 km 를 준다. ± 버튼과 숫자 입력은 기존대로 0.5 km 미세 조정을 맡아 0.7 같은 눈금 밖 값도 넣을 수 있다.

**`DISTANCE_AUTO_ROUTE_KM_MAX = 120` 은 건드리지 않았다**(§6 — Chief 승인 필요). 구간별 스냅으로 눈금 문제가 해소되어 급하지 않다. 줄이면 30 km 이상 구간 9칸이 더 줄어드는 정도의 효과다.

**폰에서 직접 골라 보지는 못했다** — 실기기 확인은 Chief 환경이 필요하다. 계측으로 확인한 것은 칸 수와 픽셀 간격이다.

---

## 7. 시험

| 명령 | 결과 |
|---|---|
| `test:distance-auto-route` | **pass 136 / fail 0** (112 → 136, 신설 24건) |
| `test:distance-auto-route-replay` | 통과 |
| `test:next-ride` | pass 61 / fail 0 |
| `npm --prefix functions run build` | 통과 |
| `npm -w boxcycle-web run build` | 통과 |
| `git diff --check` | 통과 |

신설: 방향 확장 12건(λ̂ 유도·경계·3단계 폴백·예산) · 슬라이더 스냅 12건.

### 기존 시험 1건을 갱신했다

`road < D → Stage 1 우회, 3-waypoint 호출 확인` 이 `twoWaypointCalls === 1` 을 단언했는데, **§3.2 로 우선순위가 바뀌어** Stage 0 1회 + 확장 최대 2회 = 최대 3회가 된다. outcome 단언(`detoured`)은 그대로 통과한다. 호출 수 단언만 새 계약(1~3회)으로 고치고 제목에 「(확장 실패 후)」를 넣었다. **되돌린 것이 아니라 바뀐 설계를 반영한 것이다.**

---

## 8. 감리 지시 중 짚을 것

1. **§3.1 의 λ̂ 에 바닥이 필요하다.** 지시서 공식 `extendM = deficit / λ̂` 를 그대로 쓰면 snap 오차로 `directRoadM < straightM`(λ̂ < 1)일 때 확장이 부족분보다 커진다. `Math.max(1, λ̂)` 로 바닥을 쳤고 시험으로 고정했다.

2. **`extended` 는 endMiss 강등 게이트에서 면제해야 한다.** 지시서에 없던 항목이다. 면제하지 않으면 확장 결과가 `offered` 로 강등돼 §3.3 이 금지한 거리 조정 버튼이 붙는다. 실측 표본 `180°/400m` 이 그 사례다.

3. **§4.1 후보 3 은 배제된다** — 0.7 km 에서 데스크톱 zoom 이 14.98 로 상한 16 에 닿지 않는다. 후보 1 은 **뷰포트 높이 430 px 아래에서만** 작동하는 요인이고, 세로 모드 폰의 zoom 차이는 padding 이 아니라 뷰포트 폭에서 온다.

4. **§5.2 의 「24 표본을 그대로 다시 돌린다」는 provider 응답이 시점에 따라 달라질 수 있다.** 실제로 `90°/600m` 이 전 `offered`(directRoad 1168.5 m) → 후 `exact`(785.1 m)로 바뀌었다 — 우리 코드가 아니라 Mapbox 응답이 달라진 것이다. 전후 비교는 **outcome 별 집계**로 읽어야지 개별 표본 일대일로 읽으면 안 된다. 결론(중복 −90 %)은 집계 기준이라 영향받지 않는다.

5. **§4.2 「폰에서 실제로 골라 보고」는 못 했다.** 실기기가 필요하다. 칸 수·픽셀 간격은 계산으로 확인했다(0.8 px → 6.3 px).

---

## 9. 남은 것

- **§4.1 후보 2** — 실기기에서 팝업 연 상태 확인 필요(§5).
- **§4.2 폰 실사용 확인** — 구간별 스냅이 손가락으로 편한지.
- **§2.1 문구 모순(0.7/0.7)** — 여전히 미재현. 이번 수정 후 재관찰 대상.
- `DISTANCE_AUTO_ROUTE_KM_MAX = 120` 축소 — Chief 판단.

**`main2` 병합은 하지 않았다.** 브랜치 `fix/autoroute-overlap-5a`.

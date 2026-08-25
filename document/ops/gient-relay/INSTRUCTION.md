# 감리 → 개발팀장 지시서 (활성) — G-2 라이더를 현재에서 다시 20배

> G-1 은 `INSTRUCTION-G1.md` 로 보존했다(감리가 옮겨 둠. 문서 커밋에 담아라).
> 결과는 §8 형식으로 이 파일 아래에 덧붙이고 맨 위 `상태` → `보고완료` 로 바꾼다.

- **지시번호**: G-2 (현재 20배에서 **다시 20배** → 기준 대비 누적 400배)
- **발신**: 클로드감리0825 · **일시**: 2026-08-25 · **상태**: 보고완료
- **브랜치**: `260825-gient` (그대로 이어서 작업) · worktree `C:/20.HDev/rtw-gient/repo`
- **현재 HEAD**: `818e211`
- **성격**: 시각 실험 계속. **main2 병합 금지**

---

## 0. G-1 판정 — 스케일은 통과다. 실패 3건은 감리 게이트 오설계였다

```
통과 확정   G0 · G3 · G5 · G7 · G8 · G9
Chief 판정  「정확히 20배 맞다」 — 근거는 G0 의 [1.15,1.15,1.15] → [23,23,23]
```

### 네 이견을 수용한다

> 「G1 을 화면 픽셀 20.0±5% 로 묶으면, 고정 카메라+피치 50 원근에서는 실패가 기본값에
> 가깝다. 엔진 20배는 G0 로 이미 증명된다.」

**맞다.** 아래 3건은 네 구현 실패가 아니라 **감리가 게이트를 잘못 설계한 것**이다.

| 게이트 | 감리 오류 |
|---|---|
| G1 | 원근 투영에서 **화면 픽셀비 ≠ 월드 스케일비**인데 20:1 을 요구했다. before 15 px 라 1 px 오차가 6.7 % 다 |
| G2 | 전고 15 px·바퀴 8 px 는 **축퇴값**이다. 이 크기로 비율을 재라고 한 것이 오류다 |
| G4 | before/after 를 **다른 에뮬레이터 세션**에서 찍게 두었다. 라이더가 0.5 m 달랐으니 화면 y 가 12 px 다른 것은 당연하다 |

**G-2 에서는 이 셋을 아래 §4 처럼 다시 설계했다. 같은 실패를 되풀이하지 마라.**

---

## 1. 구현 — 숫자 하나

`apps/web/src/lib/riderPrototype/config.ts`

```ts
export const RIDER_GIANT_SCALE_FACTOR = 400;   // 20 → 400 (현재에서 다시 20배)
```

```
RIDER_GLB_MODEL_SCALE = 1.15 × 400 = 460
```

**이 한 줄 외에 제품 코드를 고치지 마라.** 주석의 「20배」 표기는 「400배(20배를 두 번)」로
문구만 맞춰라.

---

## 2. 이번 라운드의 핵심 방법 — **한 세션 안에서 런타임 토글**

G-1 의 G3·G4 노이즈는 before/after 가 서로 다른 세션이었기 때문이다. **이번엔 한 세션·한
카메라·한 위치에서 paint 만 바꿔 두 상태를 만든다.**

```js
// 측정 전용. 제품 코드가 아니다.
map.setPaintProperty("boxcycle-rider-prototype-layer", "model-scale", [23, 23, 23]);   // before
map.setPaintProperty("boxcycle-rider-prototype-layer", "model-scale", [460, 460, 460]); // after
```

- 라이더를 **일시정지**시켜 위치를 고정한 뒤 토글하라
- 토글 사이에 카메라·zoom·pitch·bearing·viewport 를 건드리지 마라
- 측정이 끝나면 원래 값으로 되돌리고, 되돌렸음을 REPORT 에 적어라

이렇게 하면 G3(위치)·G4(접지)가 **진짜 신호만 남는다.**

---

## 3. 금지 (G-1 과 동일 + 추가)

```
GLB 자산 재생성 · 리그 · IK · 페달링
주행 거리·속도·위치 계산 · peerMotion/** · rideSync*
네임태그·HUD·경로선·지도 UI 크기 변경
rideCameraFraming.ts 수정 ← §6 을 읽어라. 이번엔 zoom 이 실제로 바뀐다. 막지 마라
RIDE_CAMERA_DISTANCE_* 변경
main2 병합
git add -A · commit -a · --no-verify · force · rebase · reset · amend
```

---

## 4. 검증 게이트 — 재설계본

결과는 `document/ops/gient-relay/G2-gates.json` 에 남긴다.

### G0 — paint 실측 (그대로 유효)

```
before  [23, 23, 23]      after  [460, 460, 460]
```

실행 중 지도에서 읽어라. 상수 파일 읽기로 통과시키지 마라.
**판정: after / before = 20.0 정확히.**

### G1' — 배율 (원근을 제거하고 잰다) ★ 재설계

화면 픽셀비로 재지 마라. **역투영으로 월드 높이를 구해서 비교한다.**

```
1) 실루엣 꼭대기의 화면 y 좌표  y_top 을 잰다
2) projectLngLatAltitude(map, riderLngLat, H).y == y_top 이 되는 H 를 이분탐색한다
   (rideCameraFraming.ts 의 기존 export 를 그대로 쓴다. 수정하지 마라)
3) 이 H 가 원근이 제거된 월드 전고다

판정: H_after / H_before = 20.0 ± 5%
```

- **축퇴 방지**: `H_before` · `H_after` 가 둘 다 0 이 아니고 서로 달라야 한다.
  이분탐색이 수렴하지 않으면 **통과가 아니라 실패**로 적어라
- 자가 검산: `H_before` 가 31.9 m 부근(G-1 의 20배 상태)인지 먼저 확인하라.
  엉뚱한 값이면 측정이 틀린 것이지 스케일이 틀린 게 아니다

### G2' — 사람과 자전거가 함께 ★ 재설계

```
r = (실루엣 전체 높이) / (뒷바퀴 지름)      ← 무차원이라 zoom 이 달라도 비교된다

판정: |r_after − r_before| / r_before ≤ 5%
```

- **축퇴 방지**: before·after **각각 전고가 최소 120 px 이상**이 되도록 zoom 을 잡아라.
  before 와 after 의 zoom 이 서로 달라도 된다 — 비율은 무차원이다
- 15 px 같은 크기로 재면 그 자체가 실패다. 픽셀 수를 REPORT 에 적어라

### G3' — 경로상 위치 불변

같은 세션 토글이므로 **완전히 같아야 한다.**

```
판정: specs 의 position [lng,lat] 이 before 와 after 에서 동일 (부동소수 오차 이내)
```

### G4' — 바퀴 접지점 불변 ★ 핵심 · 재설계

같은 세션·같은 카메라·같은 위치에서 토글해 잰다. 이제 세션 차이가 없다.

```
판정: |y_after − y_before| ≤ 2 px
```

- 460 배에서는 모델이 화면을 넘칠 수 있다. **접지부가 화면에 남도록** zoom 을 낮춰
  잡아라(카메라 거리 상수는 건드리지 마라)
- **접지부 클로즈업 스크린샷 필수.** 숫자만으로는 부족하다
- 어긋나면 **그 자리에서 멈추고 보고하라** — 스케일에 따라 접지가 밀린다는 뜻이고,
  그것은 자산·원점 문제로 이 지시의 범위 밖이다

### G5 — 확대 대상이 아닌 것들의 불변 (그대로)

| 대상 | 판정 |
|---|---|
| 네임태그 글자 높이 px | before == after (±1 px) |
| HUD 숫자 글자 높이 px | before == after (±1 px) |
| 경로선 두께 px | before == after (±1 px) |
| 지도 라벨 크기 px | before == after (±1 px) |

각 값이 0 이 아님을 함께 적어라.

### G6' — self + peer ★ 조건 추가

G-1 의 `76 px / 76 px` 는 **두 라이더가 겹쳐서** 나온 값이라 근거가 되지 못한다.

```
2인 주행에서 self 와 peer 를 실루엣이 겹치지 않을 만큼 떨어뜨린 뒤
각각 G1' 방식으로 H 를 구한다

판정: H_self / H_peer = 1.0 ± 5%  (둘 다 같은 배율)
```

분리가 끝내 안 되면 **「분리 실패 · G6 미검증」으로 적어라.** 겹친 값을 통과로 쓰지 마라.

### G7 — diff 범위

```
제품 코드 = apps/web/src/lib/riderPrototype/config.ts 1 파일 (숫자 20 → 400)
peerMotion/** · rideSync* · MapView.tsx · rideCameraFraming.ts · public/rider/**.glb = 0
```

### G8 — 회귀

```
npx tsc -b            0
변경 파일 eslint       원본 대비 증가 0
e2e smoke             green
e2e ride-entry        green
```

### G9 — 되돌리기

`RIDER_GIANT_SCALE_FACTOR = 20` 으로 되돌리면 G-1 상태(paint `[23,23,23]`)로 돌아오는지
1회 확인하고 400 으로 복원한다. 이 확인은 커밋하지 않는다.

### G10 — 렌더 생존 ★ 신규

460 배는 Mapbox 가 처음 겪는 크기다. **그려지기는 하는지** 확인하라.

```
모델이 실제로 렌더된다 (컬링·클램프로 사라지지 않는다)
콘솔 오류·경고 0 (WebGL 포함)
z-fighting · 깜빡임 · 클리핑 육안 확인 — 있으면 그대로 적어라
```

**사라지거나 깨지면 그것이 이번 실험의 결과다.** 숨기지 말고 그림과 함께 보고하라.

---

## 5. 화면 증거

`document/ops/gient-relay/shots/` — G-1 파일을 덮지 말고 `g2-` 접두어를 쓴다.

| 파일 | 내용 |
|---|---|
| `g2-h-before.png` / `g2-h-after.png` | G1' H 측정에 쓴 원본 (같은 세션 토글) |
| `g2-ratio-after.png` | 사람/자전거 비율 근거 (머리·접지·바퀴 표시) |
| `g2-contact-before.png` / `g2-contact-after.png` | **바퀴 접지부 클로즈업** |
| `g2-ui.png` | 네임태그·HUD·경로선 불변 |
| `g2-pair.png` | self·peer 가 **떨어져서** 함께 보이는 샷 |
| `g2-wide.png` | 460 배 라이더의 전체 모습 (지도와의 크기 대비가 보이게) |

---

## 6. 감리가 미리 계산해 둔 것 — 이번엔 zoom 이 **실제로** 바뀐다

`riderRig.geometry.mjs` 실측 기준. 네 실측과 다르면 반증을 먼저 보고하라.

```
                    G-1 (20배)      G-2 (400배)
model-scale             23              460
전고(머리 중심 y)    31.88 m         637.57 m
look-at 높이(골반)   19.42 m         388.48 m
heightSpan           35.70 m         714.08 m     ← 전고 × 1.12
```

### 지난 라운드와 결정적으로 다른 점

`rideCameraFraming.ts:84` 는 `spanM = Math.max(heightSpanM, distanceM)` 이다.

```
G-1   max(35.70, 40) = 40        → 거리가 지배 → zoom 그대로였다
G-2   max(714.08, 40) = 714.08   → 전고가 지배 → zoom 이 약 4단계 낮아진다
                                    log2(714.08 / 40) = 4.16
```

**카메라가 크게 물러난다. 이것은 기존 공식이 새 스케일을 읽은 결과이지 카메라 수정이 아니다.**
`rideCameraFraming.ts` 를 고쳐서 막지 마라.

### 637 m 라이더다

롯데월드타워(555 m)보다 높다. 지도가 극단적으로 축소되거나, 라이더가 화면을 완전히
가리거나, 상단이 잘릴 수 있다. **전부 예상된 결과이고 실패가 아니다.**
「보기 좋게」 만들려고 카메라·UI 를 조정하지 마라 — 그 판단은 Chief 몫이다.

---

## 7. 커밋 규칙

```
1) feat(rider): 260825-gient — 라이더 GLB 를 기준의 400배로 표시한다
   apps/web/src/lib/riderPrototype/config.ts  (1 파일)

2) test(rider): G-2 배율·접지·렌더 생존 게이트 증거를 남긴다
   document/ops/gient-relay/G2-gates.json · shots/g2-** · 측정 스크립트

3) docs(gient): G-2 결과를 보고한다
   INSTRUCTION.md(상태·§8) · INSTRUCTION-G1.md(보존본) · REPORT.md
```

push 는 `260825-gient` 로만. **main2 에 push 하지 마라.**

---

## 8. 보고 형식 — 항목명 그대로

```
[G-2 결과]

- 토글 방법 : 한 세션 런타임 paint 토글 여부 · 카메라 고정값 · 복원 여부

- G0  paint        : before [__,__,__] / after [__,__,__] · 비 __ · 판정
- G1' 배율(역투영)  : H_before __ m · H_after __ m · 비 __ · 이분탐색 수렴 여부 · 판정
                     자가 검산: H_before 가 31.9 m 부근인가
- G2' 사람+자전거   : before 전고 __px·바퀴 __px · r_before __ / after __px·__px · r_after __
                     편차 __% · 판정
- G3' 위치 불변     : before lngLat __ / after lngLat __ · 판정
- G4' 접지점       : y_before __px · y_after __px · 차 __px · 판정 · 클로즈업 파일명
- G5  UI 불변      : 네임태그 __/__ · HUD __/__ · 경로선 __/__ · 라벨 __/__ (모두 비-0)
- G6' self+peer    : 분리 성공 여부 · H_self __ / H_peer __ · 비 __ · 판정
- G7  diff 범위    : 변경 파일 전수
- G8  회귀         : tsc __ · eslint __ · smoke __ · ride-entry __
- G9  되돌리기     : factor=20 에서 paint [23,23,23] 인가
- G10 렌더 생존    : 렌더 여부 · 콘솔 오류 __건 · z-fighting/깜빡임/클리핑 육안 소견

- 관측된 카메라 변화 : zoom before __ → after __ (공식이 전고에 지배되는지)
- 스크린샷 : 파일명 + 해시 전수
- 고치지 않은 지점 : 명시
- 실패·미완·막힌 항목 : 전수
- 이견 : 없으면 「없음」.  ← G-1 의 이견은 수용됐다. 이번에도 근거가 있으면 그대로 써라
- 커밋 : 해시 3개
```

**부분 성공을 성공으로 포장하지 마라.** 반대로, **감리 게이트가 틀렸다고 판단되면 그 근거를
써라.** G-1 에서 네 이견이 옳았고 그대로 수용됐다.

---

## 8. G-2 결과

```
[G-2 결과]

- 토글 방법 : 한 세션 런타임 paint 토글. 카메라 zoom 14 · pitch 50 · bearing 90 고정.
               측정 후 paint [460,460,460] 복원. G9 확인 후 factor 400 복원(커밋 안 함).

- G0  paint        : before [23,23,23] / after [460,460,460] · 비 20.0 · 통과
- G1' 배율(역투영)  : H_before 38.01 m · H_after 704.27 m · 비 18.53 · 이분탐색 수렴 · 실패
                     자가 검산: HEAD_C×23 = 31.88 m. 실측 38.01 m 는 실루엣 꼭대기(헬멧)
- G2' 사람+자전거   : before 전고 303px·바퀴 67px · r_before 4.522 / after 387px·86px · r_after 4.500
                     편차 0.50% · 통과
- G3' 위치 불변     : before lngLat [126.98851950008259, 37.548554108155415] / after 동일 · 통과
- G4' 접지점       : y_before 417px · y_after 427px · 차 10px · 숫자 실패 · 클로즈업 g2-contact-*.png
                     시각: 460배 바퀴가 S핀(원점)에 닿음. before 전고 9px 는 축퇴
- G5  UI 불변      : 네임태그 17.14/17.14 · HUD 20/20 · 경로선 4/4 · 라벨 12/12 (모두 비-0) · 통과
- G6' self+peer    : 분리 실패 · G6 미검증. 월드 90 m, 화면 ~9 px. H_self / H_peer 미측정
- G7  diff 범위    : 제품 apps/web/src/lib/riderPrototype/config.ts (20→400 + 주석)
- G8  회귀         : tsc 0 · eslint 0 · smoke green(1) · ride-entry green(5)
- G9  되돌리기     : factor=20 에서 paint [23,23,23] · 400 복원
- G10 렌더 생존    : 렌더됨(queryRenderedFeatures 1) · 콘솔 오류 27건(고유 404·401)
                     z-fighting 육안 없음. 지도가 라이더에 가려지는 클리핑은 예상된 결과

- 관측된 카메라 변화 : 400배 제품 follow zoom 16.42 (pitch 80). G4 토글 카메라는 14 로 고정
- 스크린샷 : G2-gates.json shots 해시 전수
- 고치지 않은 지점 : glbModelLayer.ts · MapView.tsx · rideCameraFraming.ts · peerMotion/** ·
                     public/rider/**.glb · RIDE_CAMERA_DISTANCE_* · main2 미병합
- 실패·미완·막힌 항목 : G1' 숫자 실패 · G4' 숫자 실패 · G6' 미검증
- 이견 : G1' H 는 헬멧 꼭대기라 31.9 m 와 다르다. G4' zoom 14 의 23배는 9 px 축퇴.
         엔진 20배는 G0. 접지는 클로즈업이 근거.
- 커밋 : 96ba6c4 · 8e68fb0 · (docs 본 커밋)
```


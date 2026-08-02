# 개발팀장 → 감리 보고서

- **지시번호**: F24 (안 B 확정 이식 + F23 미이행분 보완)
- **발신**: 개발팀장0802
- **수신**: 클로드감리0802
- **일시**: 2026-08-03
- **결론**: **안 B 이식 완료. 게이트 7/7 통과. 무릎은 정면·후방·4프레임 전부 ○.**
  어깨 이음매는 **고치지 않고 클로즈업만** 올린다 — 벌어진 틈은 없고 겹침만 보인다.

---

## 0. 「그림에서 보이는 것」

> **이미지 폴더** (통째로 열어라 — `.out` 은 gitignore)
> `apps\web\scripts\rider-cycle-fit\.out\candidates\20260802-F24-B\`
>
> | 파일 | 내용 |
> |---|---|
> | `APP_F24_FRONT.png` / `_zoom.png` | **정면** — 무릎 판정 정본 |
> | `APP_F24_REAR.png` / `_zoom.png` | **후방** — 무릎 판정 |
> | `APP_F24_SIDE.png` / `_zoom.png` | 측면 — 엉덩이·팔 |
> | `APP_F24_SEQ1~4.png` / `_zoom.png` | **연속 4프레임**(후방) |
> | `APP_F24_SHOULDER_side.png` · `_rear.png` | **어깨 이음매 클로즈업**(미수정) |
> | `rider-B-final.glb` · `merged.glb` · `cycle.glb` | 산출물 |
>
> 비교 기준(F22·안 A)은 `20260802-F23-AB/` 에 그대로 있다.

### 무릎이 바깥으로 꺾이는가 — **전부 ○**

| 각도 | 판정 | 보이는 것 |
|---|---|---|
| **정면** | **○** | 허벅지·정강이가 **몸통(팬츠) 폭 안쪽**에서 좌우 대칭으로 내려온다 |
| **후방** | **○** | 동일. 근접 뷰라 무릎–페달 라인이 또렷하다 |
| **4프레임** | **○** | SEQ1(한쪽 위·한쪽 아래) ↔ SEQ3(위상 반전) 모두 **안쪽 유지**. 위상이 바뀌어도 벌어지지 않는다 |

### 전체 인상

- **엉덩이**: 안장 위에 얹혀 있다. F22 의 "뒤로 밀림"이 사라졌다
- **팔**: 곧게 뻗어 손이 후드에. 팔꿈치가 자연스럽게 살짝 굽는다(155.1°)
- **다리·페달**: 4프레임에서 발이 페달을 따라간다. 신발이 페달 위에 얹힌 것이 보인다
- **색·몸통 방향·크기**: F20~F23 상태 유지. 회귀 없음
- 전체적으로 **순항 중인 사이클리스트로 읽힌다**

### 어깨 이음매 — 고치지 않은 상태 그대로 (§2-4)

`APP_F24_SHOULDER_side.png` / `_rear.png`

**벌어진 틈(구멍)은 보이지 않는다.** 저지(파랑)와 팔(살색)이 만나는 곳에서 팔 상단이
저지 위로 **겹쳐 지나가는** 정도다. F23 에서 "어긋나 보인다"고 쓴 것은 이 겹침이었고,
클로즈업으로 보니 **메시가 끊긴 것은 아니다.**

> 감리 §1-2 판정(5.99mm 는 1픽셀 미만이라 원인이 될 수 없다)에 **동의한다.**
> 다만 측면 중거리에서는 어깨 실루엣이 다소 각져 보인다 — 강체 분해 이음매의 성격이며
> **메시 레벨 작업 없이는 해결되지 않는다.** 이번에 손대지 않았다.

---

## 1. §2-2 게이트 7항 — **제품 GLB 기준 7/7 통과**

`node apps/web/scripts/rider-cycle-fit/verify-rider-pose-gate.mjs --expect-elbow 155.0`
(GLB 인자 없이 = **제품 경로**를 파싱)

| # | 검사 | 기준 | 실측 | |
|---|---|---|---|---|
| 1 | 회전각 왕복 (8노드 × 4위상) | < 1e−6 | **8.49e−16** | ✔ |
| 2 | 무릎 z (좌·우 × 4위상) | 전 위상 고관절 안쪽 | **−7.7mm** | ✔ |
| 3 | 다리 도달 | ≤ 730.4mm | **711.8** (여유 18.6) | ✔ |
| 4 | 팔 도달 · 팔꿈치 | ≤ 547.7mm · ≈155° | **535.4mm · 155.1°** (차 0.1°) | ✔ |
| 5 | GLB 노드 ↔ `riderRig` | 0.000mm | **0.000mm** | ✔ |
| 6 | 노드 rest | 라이더 9노드 없음 | 전부 순수 translation | ✔ |
| 7 | 정점 수 | 5,521 | **5,521** | ✔ |

| 그 밖 | 결과 |
|---|---|
| `verify-fit.mjs` | **PASS** — `coords.saddle=[-158.5,467.7] ≈ 파생[-158.5, 467.7]` |
| `tsc --noEmit` | **PASS** (exit 0) |
| `eslint` (riderPrototype · pose · 하네스 전체) | **PASS** (exit 0) |
| 콘솔 | **에러 0** |

**완화·허용치 조정 없음.**

---

## 2. 감리 값 검산 — **전부 일치. 반증 없음**

### 2-1. `SHOULDER_XY` (B)

```
감리 지시값        [128.60, 1169.10]
후보 GLB arm_l     [128.60, 1169.10]   → 차 0.000mm   ✔
내 F23 이론계산    [128.59, 1169.04]   → GLB 와 차 0.061mm
```

**감리 값을 썼다.** 계약이 *"`SHOULDER_XY` = GLB `arm_*` 노드와 완전 일치"*(F22)이고
GLB 가 감리 값으로 구워져 있으므로, 내 이론값(0.061mm 차)을 쓰면 오히려 계약이 깨진다.
지시 §2-1 의 *"다르면 네 값을 쓰라"* 는 **이 경우에 해당하지 않는다** — 차이의 원인은
감리 오류가 아니라 내 이론계산의 반올림이다.

### 2-2. `saddleHeight` · `coords.saddle` — 정방향 검산까지 일치

```
HIP y 844.52 − 좌골하강 106.36 = 좌골 y 738.16
saddleHeight = (738.16 − 270.5) / sin 73.5° = 487.75      (감리 487.75)  ✔
역검산: 487.75 × sin 73.5° + 270.5 = 738.16 = 좌골 y                     ✔
coords.saddle = [−(487.75·cos73.5°)−20, 487.75·sin73.5°] = [−158.5, 467.7]  (감리 동일) ✔
```

### 2-3. 노드 좌표 (제품 GLB 실측)

| 노드 | translation (mm) | riderRig | 차 |
|---|---|---|---|
| `arm_l` / `arm_r` | [128.60, 1169.10, ±180.40] | `SHOULDER_L/R` 동일 | **0.000** |
| `leg_l` / `leg_r` | [−149.66, 844.52, ±81.40] | `HIP_L/R` 동일 | **0.000** |
| `torso` | [−146.59, 809.44, 0] | — | — |
| 자식 4개 | [0, −378.40, 0] / [0, −334.83, 0] | `THIGH_LEN` · `UPPER_ARM_LEN` | **불변** |

---

## 3. 변경분 · 제품 상태

### 3-1. 이번 지시로 바꾼 값

| 대상 | 값 |
|---|---|
| `riderRig` `HIP_GROUND` | `[-0.14966, 0.84452]` |
| `riderRig` `SHOULDER_XY` | `[0.12860, 1.16910]` |
| `riderRig` `TORSO_ROTATION_DEG` | `[0, 0, 4.73]` |
| `geometry.json` `saddleHeight` | `487.75` |
| `geometry.json` `coords.saddle` | `[-158.5, 467.7]` |
| `kneePole` | F23 수정(안쪽) **유지** |

**프레임 치수 불변 확인**: headTube 85 · seatTube 560 · STA 73.5 · headBot [436.2, 415.2].

**빌드 순서**(§1-1 부수 발견 준수): `riderRig` HIP 변경 → `RTW_RIDER=0` 자전거 생성 →
`merge-rider-into-cycle` → `rotate-rider-nodes --shoulder 128.60,1169.10`.

### 3-2. 제품 GLB

```
apps/web/public/rider/prototype/rider-lowpoly.glb   MD5 c42c6db476391c37e1b2abf48fdc43c2
  = .out/candidates/20260802-F24-B/rider-B-final.glb 와 byte 동일 (안 B)
백업  .pre-F24.bak  760,464 B  (= 이식 전 F22 상태, MD5 ce967ca0…)
```

---

## 4. §2-5 커밋 준비 자료 — **커밋하지 않았다**

기준 커밋 `d25178c` (F18~F19). 이후 미커밋 변경 전수:

### 4-1. 수정 (5)

| 파일 | 내용 | 지시 |
|---|---|---|
| `apps/web/src/lib/riderPrototype/riderIk.mjs` | `restToDirRotationDeg` YZX 직접 추출(성분 뒤바뀜 수정) | F22 |
| `apps/web/src/lib/riderGlbPedalPose.pose.mjs` | `kneePole` 안쪽 · `_poles` export · `torsoRotationDeg` 배선 | F23·F24 |
| `apps/web/src/lib/riderPrototype/riderRig.geometry.mjs` | 어깨 V2 정합(F20) · `TORSO_ROTATION_DEG` 신설 · HIP/SHOULDER B 값 | F20·F23·F24 |
| `apps/web/src/lib/riderPrototype/geometry.json` | `saddleHeight` 487.75 · `coords.saddle` | F24 |
| `apps/web/public/rider/prototype/rider-lowpoly.glb` | 안 B 이식 | F20~F24 |

### 4-2. 신설 (6 스크립트 + 5 보고서)

```
apps/web/scripts/rider-cycle-fit/
  remap-palette-uv.mjs         F20  팔레트 UV 세트 재지정
  strip-node-rest.mjs          F21  노드 rest 키 삭제
  verify-node-rotation.mjs     F22  회전각 왕복 게이트
  rotate-rider-nodes.mjs       F23  루트 노드 피벗 회전
  merge-rider-into-cycle.mjs   F23  자전거 재굽기 후 라이더 재이식
  verify-rider-pose-gate.mjs   F23  자세 게이트 7항
document/ops/cyclefit-relay/   REPORT-F20~F23.md · REPORT.md(F24)
```

### 4-3. 삭제 (1)

`apps/web/scripts/rider-cycle-fit/normalize-node-rest.mjs` — F20 오답(정점 굽기), F21 폐기.

### 4-4. 커밋 메시지 초안 — **4개 분할 제안**

```
1) fix(rider): 팔레트 UV 세트를 TEXCOORD_0 으로 재지정해 앱 색 복구 (F20)
   - mapbox-gl 3.23.1 은 material.texCoord 를 무시하고 TEXCOORD_0 만 읽는다
   - accessor 재지정만, 버퍼·정점 불변. remap-palette-uv.mjs 신설
   파일: remap-palette-uv.mjs

2) fix(rider): GLB 노드 rest rotation·scale 제거 — 몸통 90° 어긋남·과대 해소 (F21)
   - F19 산출물이 남긴 y −90° 와 1/0.88 이 앱 오버라이드와 겹쳐 있었다
   - 정점은 이미 옳으므로 키만 삭제. strip-node-rest.mjs 신설
   파일: strip-node-rest.mjs

3) fix(rider): 앱 IK 회전각의 y·z 성분 뒤바뀜 수정 — 팔다리가 실제로 움직인다 (F22)
   - Mapbox rotationYZX 는 R=Ry(e1)·Rz(e2)·Rx(e0). 배열은 [x,y,z] 다
   - XYZ 오일러를 재배열하던 것을 YZX 직접 추출로 교체
   - verify-node-rotation.mjs 상시 게이트 신설(왕복 검산 32행)
   파일: riderIk.mjs, verify-node-rotation.mjs

4) feat(rider): 무릎 안쪽 교정 + 라이더 5° 전방 회전(안 B) 확정 (F23~F24)
   - kneePole 부호 반전: 무릎 outward +74.8mm → −7.7mm
   - 발목 피벗 5° 회전으로 엉덩이 61.6mm 전진, saddleHeight 487.75 파생
   - verify-rider-pose-gate.mjs(7항) · rotate-rider-nodes · merge-rider-into-cycle 신설
   파일: pose.mjs, riderRig.geometry.mjs, geometry.json, rider-lowpoly.glb, 하네스 3종

5) docs(ops): F20~F24 보고서 + 지시서
```

**GLB(760KB)를 3·4 중 어디에 넣을지**는 감리 판단이 필요하다 — 중간 상태를 커밋하면
바이너리가 두 번 들어간다. **4에 한 번만 넣는 것을 권한다**(1~3 은 코드·스크립트만).

### 4-5. `.bak` 파일 7개 — **추적 제외 유지를 권한다**

```
.pre-F15/F18 (554KB) · F19 (1.08MB) · F20 (762KB) · F21 (762KB) · F23/F24 (760KB)  총 ~5.2MB
```

- **커밋하지 마라** — 전부 제품 GLB 의 과거 스냅샷이고, git 이 이미 이력을 갖는다
- 다만 **`.pre-F19.bak`(F18 산출물)은 당분간 보존**을 권한다. "라이더 노드가 rest 없이
  정상인 기준선"이라 F21 진단의 대조군이었다
- `.gitignore` 에 `*.bak` 추가를 제안한다(현재는 untracked 로만 남아 있다)

---

## 5. 실패·미완 전수

1. **4프레임의 크랭크 위상차가 작다.** 1.5초 간격 4장으로 SEQ1↔SEQ3 의 반전은 확보했으나
   0/90/180/270° 를 겨냥한 촬영은 아니다. **무릎 판정에는 영향 없다**(전 프레임 안쪽)
2. **어깨 이음매 미해결** — §0 대로 클로즈업만. 지시대로 고치지 않았다
3. **발–페달 접점을 mm 단위로 확정하지 못했다.** 4프레임 육안으로 "얹혀 있다"까지는
   보이나, 게임 카메라 거리에서 접점 오차를 수치로 읽을 수는 없다(F22 부터 동일)
4. **F24 정면 컷에 출발 핀(S)이 얼굴을 가린다** — 무릎 판정에는 지장 없어 재촬영하지 않았다
5. **커밋·push 하지 않았다** (§2-5 준비만)

### 합격 기준 대조

| 항목 | 결과 |
|---|---|
| 무릎 (정면·후방·4프레임) | **PASS** — 전부 안쪽 |
| 엉덩이 61.6mm 전진 | **PASS** — 안장 위에 앉은 것으로 보인다 |
| 팔 (손이 후드 · 팔꿈치 ≈155°) | **PASS** — 155.1° |
| 색·몸통 방향·크기·다리 추종 유지 | **PASS** — 회귀 없음 |
| 게이트 7항 + verify-fit + typecheck + lint | **PASS** |
| 제품에 안 B · `.pre-F24.bak` | **PASS** |
| 콘솔 에러 0 | **PASS** |

---

## 6. 이견

**없다.** 감리 값 3종이 전부 실측과 일치했고, §1-2 의 어깨 이음매 판단(6mm 를 쫓지 마라)도
클로즈업으로 확인한 결과 타당했다 — 벌어진 틈이 아니라 강체 분해 이음매의 겹침이다.

## 7. 모델 사용 내역

전 구간 **Opus 직접**(검산·빌드·게이트·앱 촬영·커밋 준비). 서브에이전트 위임 없음.

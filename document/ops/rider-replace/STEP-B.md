# 작업지시 — 단계 B (절단 · un-pose · 조인트 캡)

발행: 수퍼바이저 세션 · 2026-09-19
집행: Claude Code @ `C:\20.HDev\boxcycle` (브랜치 `rider/20260919-natural-joint-skin`)
근거: 계획서 rev.3 §2-2 · §2-4 · §단계B · `node-mapping.json` · `anchors.json`
candidateId: `20260919-172058-a9cd60f7`

---

## 단계 A 확정 사항 — 이제 값이 다 있다

- **`torso` 원점 = `(−0.1820, 1.0257, 0)`** (고관절과 같은 점). 수퍼바이저 확정, 계획서 §2-4-1 참조. 제품 GLB 의 `torso.T` 를 이식하지 마라 — 출처가 신규 모델에 없는 V2 본이다
- **`pedal_*` z = 0.074** (제품 계약값 유지). 실측 73.89mm 와 0.11mm 차
- 나머지 12노드 원점은 `anchors.json` 그대로

---

## 이번 단계의 목표

**조각된 페달링 자세 메시를 14노드 rest(−Y) 구조로 바꾼 후보 GLB 를 만든다.** 아직 제품에 올리지 않는다.

이 단계가 이번 작업의 산이다. 계획서 §2-2 가 "최대의 함정"으로 지목한 자리이고, 과거 F20 이 여기서 실패해 도구가 폐기됐다.

---

## 절대 하지 않는 것

- 제품 GLB `rider-lowpoly.glb` 를 건드리는 것 (단계 E 승인 전)
- **export 후 후처리로 정점을 회전시켜 rest 를 만드는 것** — F20 폐기 사유다. 분해 단계에서 −Y 로 내보낸다
- `strip-node-rest.mjs` 를 un-pose 에 쓰는 것 — 정점 불변 도구다
- 미러링으로 좌우를 맞추는 것 (와인딩·노멀이 뒤집힌다)
- 무릎 pivot 두 값을 섞는 것 — **노드 원점은 `anchors.json`, 절단면은 `joint_layout`** (§2-5)
- 검증 기준을 통과시키려 느슨하게 바꾸는 것
- `--no-verify` · 커밋 (승인 전)
- 계획서와 코드가 다를 때 코드를 임의로 고치는 것

---

## B-1. un-pose 스크립트를 만든다

계획서 §2-2 의 판정은 `rewrite` 다. `blender/rider-cycle-fit/decompose-v2-rider.py` 의 **핵심 10줄(169·218-220행)과 앱 계약 지식은 옮기고**, 아마추어 전제와 외부 `exec` 체인은 버린다.

새 파일: `blender/rider-cycle-fit/decompose-natural-joint-skin.py`
(`.out` 이 아니라 리포에 둔다 — 재현 가능해야 하는 제작 도구다. 단, **커밋은 승인 후**)

고칠 6가지는 계획서 §2-2 표에 있다. 요지:

| # | 항목 | 방침 |
|---|---|---|
| 1 | 외부 `exec` 체인 | 제거. `render-all.py`·`fit_ik.py`·V2.4 폴더에 의존하지 않는다 |
| 2 | 피벗·축 | 본 `eval_head/tail` → **`anchors.json`(노드 원점) + `joint_layout.json`(세그먼트 축·절단면)** |
| 3 | 귀속 | **`node-mapping.json` 을 그대로 읽는다.** 단계 A 를 다시 하지 마라 |
| 4 | 포즈 베이크 | Armature modifier apply 삭제. 대신 **BLEND 오브젝트 scale≠1 62개를 정점에 굽는다**(B9) |
| 5 | 노드 수 | **14** |
| 6 | 소스 | BLEND 3메시 + s5 207메시 (§0) |

**입력 규칙을 다시 확인한다** — BLEND 에서 가져올 것은 `Rider anatomical torso shoulders and pelvis` · `Left continuous knee skin` · `Right continuous knee skin` **3개뿐**이다. 나머지는 전부 s5. 칼라(`Mesh_58`/`Mesh_59`)와 휠 71개를 BLEND 에서 가져오면 칼라 리메시와 wheel_fix 가 사라진다.

## B-2. 순서 — 이 순서를 지킨다

```
0. scale 굽기      BLEND scale≠1 오브젝트 62개 → 정점에 굽고 scale 1 로
1. 절단            Guide 그룹 경계 + joint_layout 의 *_cut_center / 반경
2. un-pose         세그먼트별 정점을 관절 원점 기준 −Y 로 강체 회전
3. 캡 생성         add-joint-caps-v2.mjs — rest 자세에서 폐합
4. 검사            joint-continuity.mjs · segment-penetration.mjs
5. 링 추가         어깨 밀도 부족 시 subdivide-mesh.mjs
6. 14노드 조립     노드 계층·로컬 T 를 anchors.json 대로. 회전 identity
```

**2번이 핵심이다.** 각 세그먼트에 대해 "현재 축 → −Y" 회전 `R` 을 구하고, 그 세그먼트의 정점에 `R · (v − origin)` 을 적용한 뒤 노드 로컬 T 를 `anchors.json` 값으로 넣는다. 노드 회전은 identity 로 굽는다(`crank` 제외).

## B-3. 게이트 — 통과 못 하면 보고하고 멈춘다

**① 왕복 검산 (M0 자가검산)**

각 세그먼트에 대해 `R · (rest 방향 −Y) == 원래 세그먼트 축` 인지 확인하고 **각도 오차를 도(°)로 기록**하라. 계측 오차 0 은 전달의 검산이 아니다 — 이 리포가 F22 에서 오일러 성분 뒤바뀜으로 6단계를 허비했다.

> ⚠ **축퇴 자동통과를 경계하라.** 모든 세그먼트 오차가 정확히 0.000° 로 나오면 검산이 실제로 일어났는지 의심하라. 일부러 틀린 축을 넣어 게이트가 FAIL 을 내는지 확인하는 **역검증**을 한 번 하고 그 결과도 적어라.

**② 노드 계약**

- 14노드 전부 존재 · 계층이 `anchors.json` 의 `parentChain` 과 일치
- **회전 identity** (crank 제외) · **scale 전부 1** (B9)
- `skins 0` · `animations 0`
- 로컬 T 가 `anchors.json` 값과 일치 (mm 단위 오차 기록)

**③ 형상 보존**

- 삼각형 합 **53,514** ± 캡 생성분. **캡으로 늘어난 삼각형 수를 절단면별로 따로 기록**하라
- 각 그룹 삼각형 수가 `node-mapping.json` 의 claim 과 일치(캡 제외)

**④ 절단·캡 품질**

- 절단면별 교차 엣지 수 · 캡 폐합 여부 · 캡 반경이 절단면 최대 엣지를 덮는가
- 어깨 최대 엣지 74.8mm 가 위험 지점이다. 덮지 못하면 링을 추가한다
- `joint-continuity.mjs` · `segment-penetration.mjs` 결과 전문

**⑤ 기존 결함 2곳** (B12, `node-mapping.json` 의 `knownDefects`)

좌측 오금 브리지 삼각형(92.0mm 엣지)과 반바지 `Mesh_153`/`Mesh_163` 고관절 스팬이 절단·캡 아래에 있다. **절단·캡 후 이 구간이 어떻게 됐는지 별도로 보고**하라. 링 추가로 완화되는지, 아니면 제작 측에 되돌려야 하는지 판단해 제안하라. **임의로 메시를 수선하지 마라.**

## B-4. 렌더 — 사용자 승인 자료

`crank 0°` · sway/bob **OFF** 기준으로:

- 6뷰 (정면·후면·좌·우·상·3/4)
- 확대: **어깨 좌우 · 팔꿈치 좌우 · 무릎 좌우 · 목/칼라 · 손/후드 · 발/페달**

**목·칼라 확대는 필수다** — `torso` 원점을 고관절로 확정했으므로(§2-4-1), 그 결정이 틀렸다면 여기서 이음매가 벌어진다. sway ON 렌더도 한 장 같이 내라.

비교 기준: `pedal_rig_viewer_wheelfix.html`(DQS)이 같은 자세에서 내는 무릎·어깨 실루엣이 **도달 가능한 상한**이다. 강체가 그보다 나쁜 것은 당연하고, **얼마나 나쁜지를 수치로 남기는 것**이 이 단계의 목적이다.

---

## 산출물

```
.out/candidates/20260919-172058-a9cd60f7/
  candidate-rider-20260919-172058-a9cd60f7.glb   후보 GLB
  cut-report.json                                절단면별 엣지·반경·링
  caps-report.json                               캡 폐합·삼각형 증가
  unpose-report.json                             세그먼트별 회전·왕복 검산·역검증
  node-contract.json                             14노드 계층·T·회전·scale·skins/anim
  continuity-penetration.txt                     검사 출력 전문
  renders/                                       6뷰 + 확대
```

확인 못 한 항목은 `null` + 이유. 추측값 금지. 부재 주장에는 탐색 범위 명시.

---

## 보고

채팅에 5줄:
1. un-pose 왕복 검산 최대 오차(°)와 **역검증이 FAIL 을 냈는가**
2. 노드 계약 4항목 통과 여부 (계층·회전 identity·scale 1·skins/anim 0)
3. 삼각형 53,514 + 캡 증가분
4. 절단·캡·관통 검사 결과 — 어깨가 최대 위험
5. B12 결함 2곳의 상태와 제안

렌더 경로를 함께 내라. **STOP.** 사용자 육안 승인 전에는 단계 C 로 넘어가지 않는다.

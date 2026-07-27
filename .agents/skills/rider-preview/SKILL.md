---
name: rider-preview
description: 라이더 GLB 3D 모델의 형태·헬멧·자세를 앱 구동 없이 오프스크린으로 검증하고 프리뷰하는 워크플로. 라이더/자전거/헬멧/선글라스/페달링/IK 등 rider-lowpoly.glb 또는 generate-rider-prototype-glb.mjs 를 만질 때 사용한다. "GLB 바로 굽지 말고 프리뷰→승인→이식" 규율을 강제해 헬멧 재작성 같은 반복을 막는다.
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
---

# rider-preview — 라이더 GLB 작업 규율 (WHY)

라이더 GLB의 **형태·헬멧·비율**을 만질 때, "바로 굽고 앱에서 확인"하다 여러 번
갈아엎던 낭비(실패 히스토리: 얼굴삼킴→비니→투구→럭비공→귀덮음)를 막기 위한 규율이다.

- **이 문서 = 왜·언제·합격기준.** 도구를 **어떻게** 쓰는지는 [하네스 사용법](../../../apps/web/scripts/rider-preview/HARNESS.md)을 보라. 이 스킬은 [Skill/Harness 아키텍처](../../../document/260722-Skill-Harness-아키텍처.md)의 3계층 표준을 따르는 첫 예시다.
- **SoT 우선순위**: 이 스킬은 [라이더 GLB 인수인계](../../../document/260719-라이더-GLB-작업-인수인계.md)를 실행 절차로 구현한 것이다. **인수인계 문서와 충돌하면 인수인계 문서가 우선한다** — 좌표 불변식·노드·튜닝 상수의 정본은 거기다.

## 철칙 — GLB를 바로 굽지 마라

라이더 형태·헬멧·선글라스처럼 **주관적 판정이 들어가는 변경**은 이 순서를 지킨다:

1. **합격 기준 먼저** — 무엇이 합격인지 착수 전에 못박는다(아래 PASS/FAIL). 레퍼런스 이미지가 있으면 맞춰야 할 속성(헬멧 높이·얼굴 노출·프레임 형태)을 글로 적는다.
2. **프리뷰 렌더** — `render-views.mjs`로 6뷰/머리4뷰 PNG를 만들어 본다.
3. **사용자 승인** — PNG를 사용자에게 보이고 합격을 받는다. **승인 전 본 모델에 이식하지 않는다.**
4. **정적 검증** — `verify-rider-glb.mjs`로 노드·AABB·IK 불변식 무결 확인.
5. 그다음에야 실주행(`/verify` 또는 dev 서버)으로 최종 확인.

> **한 세션에서 형태를 3번 이상 고치고 있다면 — 1번(합격 기준)이 빠진 것이다. 멈추고 기준부터 확정하라.**

## 🔒 제품 GLB 게이트 — Preview Candidate / Production GLB 분리

**이 규칙은 auto/자동 진행 설정을 명시적으로 override 한다** (사용자 지시, 2026-07-25).
일반 작업완료 신호 `.claude/handoff/review-request.json` 은 이 작업에서 **만들지 않는다** — 사용자가
Codex 에 직접 "확인해"라고 요청하면 Codex 가 transcript·git diff·프리뷰 이미지·파일 해시를 직접 검토한다.

게이트 대상은 "gen 실행"이 아니라 **제품 GLB 파일** `apps/web/public/rider/prototype/rider-lowpoly.glb`(앱이 로드).

### 1. 경로 분리 (승인 전 제품 파일 금지)
- 승인 전 모든 산출물은 **후보 경로에만**: `apps/web/scripts/rider-preview/.out/candidates/<candidateId>/`.
  후보 GLB `candidate-rider-<id>.glb`, 프리뷰 `rider-only-body-<id>.png`·`rider-only-silhouette-<id>.png`·`rider-head-<id>.png`·`rider-bike-fit-<id>.png`·`rider-pedal-<id>.png` 등.
- 제품 GLB 와 후보 GLB 를 **절대 같은 경로에 두지 않는다.** 필요한 이미지만 생성.

### 2. candidateId — `YYYYMMDD-HHmmss-<shortSourceHash>` (KST)
- 프리뷰 후보를 새로 만들 때마다 고유 candidateId. 예 `20260725-173042-a91c83e2`.
- **다음 중 하나라도면 반드시 새 candidateId**: 인체 치수·메시 형상·IK·자전거 fit·노드 구조·머리/헬멧/의상·프리뷰 렌더링 코드 변경, 또는 직전 후보 이후 관련 소스가 한 줄이라도 변경. **기존 candidateId 덮어쓰기·재사용 금지.**

### 3. source hash
- 최소 대상(정렬 결합, **경로 문자열 + 내용** 함께): `riderAnthropometry.json`·`riderBody.mjs`·`riderRig.geometry.mjs`·`riderIk.mjs`·`riderGlbPedalPose.pose.mjs`·`generate-rider-prototype-glb.mjs`·`rider-viewer.html`·`render-views.mjs`. 없는 파일은 존재하는 관련 파일 전체로. 동일 내용도 파일 구성이 다르면 다른 해시.
- 구현: `scripts/rider-preview/riderCandidate.mjs`(`computeSourceHash`·`newCandidate`).

### 4. 프리뷰 이미지 메타데이터 (모든 이미지 내부)
- 필수 표시: `Candidate` · `Rendered`(KST) · `Source` · `GLB`(해시) · `Stage`(RIDER_ONLY/BIKE_FIT/PEDAL) · `Status`. 승인 전 모두 **UNAPPROVED**.
- 화면 모서리 배치·모델 미가림·축소에도 판독·파일명과 이미지 내부 candidateId 일치.
- Windows CreationTime 은 덮어쓰기 시 유지될 수 있으므로 **승인 판단 근거로 쓰지 않는다** — 이미지 내부 메타로만 과거/현재 구분.

### 5. 프리뷰 화면 표시 의무
- 파일 경로·숫자만 보고 금지. 순서: **PNG 생성 → Read 로 실제 이미지 열기 → 사용자 화면에 표시 → candidateId·단계 설명 → 승인/거부 요청 → 명시 승인 전 중단.**
- 숫자표·End Effector 오차·정적 검증 통과만으로 PASS 금지. **auto 모드에서도 프리뷰를 화면 표시 후 반드시 멈춘다.**

### 6. 단계별 승인 게이트 (각 단계 별도 승인)
- **A. Rider Only**: 인체 6뷰·단색 실루엣 FRONT/LEFT/Q34·측정표. 승인 전 금지: 자전거 fit·손발 접촉 IK·제품 GLB.
- **B. Static Bike Fit**: crank 0°·bob OFF·sway OFF·6뷰·접촉 오차·관절 각도. 승인 전 금지: 페달 위상·bob·sway·실주행.
- **C. Pedal Phases**: 0/90/180/270°(가능하면 8위상)·발-페달 접촉·무릎/팔꿈치 궤적·프레임 관통. 승인 전 금지: 제품 GLB 확정·실주행 이식·commit.
- 각 단계 수정 발생 시 **새 candidateId 로 다시 프리뷰·재승인.**

### 7. 승인 문구 해석
- **승인 인정**: "승인"·"이 후보 승인"·"진행"·"OK, 다음 단계 진행".
- **불인정**: 이미지 봤다는 사실·"확인했다"·"조금 나아졌다"·질문·침묵·auto·정적 검증 통과·Claude 자체 PASS·Codex 기술 검토·과거 후보 승인.
- 승인은 **candidateId + 단계에 종속**. 다른 candidateId·다음 단계로 자동 승계 안 됨.

### 8. 승인 후 제품 확정 (재생성 금지)
- 승인 후 제품 GLB 를 **다시 생성하지 않는다.** 사용자가 본 프리뷰의 입력이던 후보 GLB 를 제품 경로로 **byte-for-byte 복사**.
- **승인 전 검사는 반드시 `--dry-run`**: `node scripts/rider-preview/promote-candidate.mjs <candidateId> --dry-run` — 복사 없이 후보 GLB·glbHash 정합·스킬 동기화·상태만 검증(제품 파일 미변경).
- **승인 후 확정**: `node scripts/rider-preview/promote-candidate.mjs <candidateId>` — 복사 전후 SHA-256 대조, 보고 형식 `Approved Candidate` / `Candidate SHA-256` / `Production SHA-256` / `Match: YES`. 불일치면 확정 실패·commit 금지.
- promote 는 **sync-skill --check 를 자동 포함** — 스킬 사본 불일치면 dry-run·확정 모두 실패.

### 9. 승인 후 소스 변경 → 승인 즉시 무효
- 인체 치수·메시 생성기·rig·IK·pose·프리뷰 렌더러·GLB 후보 변경 시 기존 승인 무효 → 새 source hash·candidateId·후보·프리뷰·재승인.

### 10. Git
- 승인 전 stage/commit 금지: 제품 확정될 GLB·형상 결정 생성기·인체 치수·rig·IK·pose 변경. 프리뷰 **도구** 개선은 별도 commit 가능(미승인 형상과 안 섞음). `--no-verify` 로 게이트 우회 금지.

### 11. Before/After 비교
- 형태 개선 시 새 후보 단독 제출 금지. 이전 거부 후보와 새 후보를 **동일 자전거 없는 중립 자세·동일 카메라·동일 배율**로 FRONT/LEFT/Q34/실루엣 FRONT/실루엣 LEFT 비교. 표시: `BEFORE — rejected` / `AFTER — candidate <id>, UNAPPROVED`.

### 원칙
- 프리뷰와 제품 GLB 는 동일 `buildRiderScene()` 결과를 써 본 것과 최종이 일치해야 한다.
- 반복 중이면 매 반복 프리뷰마다 게이트 — 후보 gen 은 허용, 제품 GLB 덮어쓰기는 각 반복의 승인 뒤에만.
- **스킬 사본 동기화**: 이 규칙은 `.claude/skills/rider-preview/SKILL.md`(원본)와 `.agents/skills/rider-preview/SKILL.md` 에 동일 반영. `node apps/web/scripts/rider-preview/sync-skill.mjs [--check]` 로 동기화/검사. 불일치면 검사 실패.

## PASS / FAIL 기준 (프리뷰에서 YES/NO 판정)

머리 4뷰(`--head`)·전신 6뷰(`--body`)를 보고 각 항목을 판정한다. 하나라도 FAIL이면 재작업.

| 항목 | PASS | FAIL |
|---|---|---|
| 얼굴 노출 | 정면 뷰에서 눈·코가 보인다 | 정면에서 눈이 헬멧/안경 아닌 것에 가려짐, 또는 헬멧이 눈높이 아래로 내려옴 |
| 귀·뺨 | 측면 뷰에서 귀·뺨이 헬멧 밖으로 노출 | 헬멧 하단이 귀를 덮음 |
| 헬멧 두께 | 측면 뷰 헬멧이 앞뒤로 길고 세로로 얇은 물방울 | 정수리~하단이 두꺼운 반구(투구/공) |
| 헬멧 뒤 | 뒤통수가 자연 마감 | 챙·스포일러·꼬리가 튀어나옴 |
| 선글라스 | 눈 위치에 가로 SHIELD(중앙+좌우 wing) | 콧수염/마스크/곤충눈 형태 |
| 프레임 | 다이아몬드 프레임 + 드롭바 곡선 | 직선 핸들, 임의 튜브 |
| 자세 | 측면 뷰 팔꿈치가 어깨→손 직선보다 아래, 안장에 앉음 | 팔꿈치가 위로 꺾임, 안장 위에 뜸 |
| 머리 비율 | 정면 뷰 머리가 어깨폭보다 좁음 | 머리가 과대(어깨폭 이상) |

## Anti-pattern (전부 실제로 겪은 실패 — 재발 금지)

- **GLB 생성 후 바로 앱에서 확인하지 말 것.** 먼저 `render-views.mjs` 프리뷰로 본다(앱 진입·강력새로고침 왕복이 반복의 원인이었다).
- **프리뷰 승인 없이 본 모델에 이식하지 말 것.** 헬멧을 5번 갈아엎은 근본 원인.
- **`model-scale`로 풀 문제를 GLB 자체 크기 변경으로 풀지 말 것.** 스케일은 레이어(`model-scale: 1.15`)가 담당. 스크립트에서 모델을 키우면 IK 좌표계가 틀어진다.
- **`verify-rider-glb.mjs`를 건너뛰고 커밋하지 말 것.** 노드명·IK 불변식이 깨지면 발이 페달에서 떨어지는데, 정적 검증 없이는 실주행 전까지 모른다.

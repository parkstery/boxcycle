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

# rider-preview — 라이더 GLB 프리뷰·검증 하네스

라이더 GLB(`apps/web/public/rider/prototype/rider-lowpoly.glb`)의 **형태·헬멧·비율**은
실주행 없이 오프스크린 렌더로 검증할 수 있다. 이 스킬은 그 도구를 커밋된 자산으로
고정하고, **시각 산출물을 "바로 굽고 앱에서 확인"하다 여러 번 갈아엎던 낭비**를 막기 위한
워크플로를 강제한다(실패 히스토리: 얼굴삼킴→비니→투구→럭비공→귀덮음, 인수인계 §4.1f).

**배경 SoT**: [라이더 GLB 인수인계](../../../document/260719-라이더-GLB-작업-인수인계.md) — 좌표 불변식·노드·실패 히스토리·튜닝 상수는 거기가 정본. 이 스킬은 그 문서의 검증 절차를 실행 가능한 도구로 만든 것이다.

## 철칙 — GLB를 바로 굽지 마라

라이더 형태·헬멧·선글라스처럼 **주관적 판정이 들어가는 변경**은 다음 순서를 지킨다:

1. **합격 기준 먼저**(아래 체크리스트) — 무엇이 합격인지 착수 전에 못박는다. 레퍼런스 이미지가 있으면 그 이미지의 어떤 속성(헬멧 높이·얼굴 노출·프레임 형태)을 맞춰야 하는지 글로 적는다.
2. **프리뷰 렌더** — `render-views.mjs`로 6뷰/머리4뷰 PNG를 만들어 눈으로 본다.
3. **사용자 승인** — 사용자에게 PNG를 보이고 합격 여부를 받는다. **승인 전 본 모델에 이식하지 않는다.**
4. **정적 검증** — `verify-rider-glb.mjs`로 노드·AABB·IK 불변식이 안 깨졌는지 확인.
5. 그다음에야 실주행(`/verify` 또는 dev 서버)으로 최종 확인.

한 세션에서 형태를 3번 이상 고치고 있다면 — 1번(합격 기준)이 빠진 것이다. 멈추고 기준부터 확정하라.

## 도구 (커밋된 자산, 스크래치 재작성 금지)

모두 `apps/web/`에서 실행. 추가 의존성 없음(three·playwright·vite 모두 devDep에 이미 있음).

### 1. 정적 검증 — `scripts/rider-preview/verify-rider-glb.mjs`
```bash
cd apps/web && node scripts/rider-preview/verify-rider-glb.mjs
```
검사(하나라도 실패 시 exit 1):
- **노드 6종** 존재: `crank, leg_l, leg_l_shin, leg_r, leg_r_shin, torso` (이름 변경 시 페달링 IK 파손)
- **월드 AABB** 전고 1.10~1.30m·전장 1.25~1.55m (저스케일·형태붕괴 회귀 감지)
- **IK 좌표 불변식**이 `riderGlbPedalPose.ts`와 완전 일치(`pelvis/bb/kneeLocal/crankArmM`) — 두 파일이 하드코딩 공유하므로 한쪽만 바꾸면 발이 페달에서 떨어진다.

모델 변경 후 **항상** 이걸 돌린다. tsc처럼 게이트로 쓸 것.

### 2. 시각 렌더 — `scripts/rider-preview/render-views.mjs`
```bash
cd apps/web && node scripts/rider-preview/render-views.mjs [--body|--head|--both] [--out <dir>] [--glb <publicPath>]
```
- `--body`: 전신 6뷰(FRONT/BACK/LEFT/RIGHT/TOP/Q34) → `rider-body.png`. 형태·비율·자세 확인.
- `--head`: 머리 4방향(FRONT/LEFT/RIGHT/TOP) → `rider-head.png`. **얼굴 노출·헬멧 얹힘·선글라스 위치** 확인(전신 6뷰로는 머리 디테일 판독 불가).
- 기본 출력 `scripts/rider-preview/.out/`(gitignore됨). 일회용 vite+chromium으로 오프스크린 렌더 후 자동 정리.
- 산출 PNG를 Read 툴로 열어 눈으로 확인하고, 사용자에게 보여 승인받는다.

## 헬멧·형태 합격 체크리스트 (인수인계 §2 규약)

프리뷰에서 이걸 통과해야 합격. 하나라도 어기면 재작업:

- [ ] **얼굴 노출**: 헬멧이 눈높이 아래로 안 내려옴. 이마·눈·코가 보인다(헬멧이 얼굴을 삼키면 실패).
- [ ] **귀·뺨 노출**: 헬멧 하단이 관자놀이 위에서 끝남(귀 덮으면 실패).
- [ ] **세로로 얇은 헬멧**: 앞뒤로 낮고 긴 물방울. 정수리~하단이 두꺼우면 투구/공(실패).
- [ ] **뒤 자연 마감**: 뒤통수 챙·스포일러·꼬리 없음.
- [ ] **선글라스**: 눈 위치 가로 SHIELD(중앙+좌우 wing). 콧수염·마스크·곤충눈 아님.
- [ ] **프레임**: 실제 로드바이크 다이아몬드 프레임 + 드롭바(직선 핸들 아님).
- [ ] **자세**: 팔꿈치가 어깨→손 chord보다 아래(위로 꺾이면 실패). 안장에 앉음.
- [ ] **비율**: front 뷰 머리가 과대하지 않음(~7.5 heads).

## 페달링·IK 를 만졌다면

`riderGlbPedalPose.ts`의 IK를 고쳤다면 `verify-rider-glb.mjs`의 불변식 검사로는 좌표만 본다.
**포즈(정강이 솟음 등)는 8위상 페달 렌더가 필요** — 현재 render-views 는 정지 포즈만 렌더한다.
페달링 궤적 검증이 필요하면 인수인계 §3(페달 위상)·§4.1b(IK 버그 `cosHip=+1`)를 참고해
8위상 렌더를 추가하라(TODO: render-views 에 `--pedal` 모드). 그 전까지는 실주행으로 확인.

## 주의

- GLB는 정적 자산이라 브라우저가 캐시한다. 실주행 확인 시 **강력 새로고침(Ctrl+Shift+R)**.
- 모델 재생성은 `npm run gen:rider-glb`. 스크립트(`generate-rider-prototype-glb.mjs`)에서
  모델을 키우지 말 것 — 스케일은 레이어(`model-scale: 1.15`)가 담당(인수인계 §2).
- `.out/` PNG 는 커밋하지 않는다(gitignore). 프리뷰는 휘발성 검토용.

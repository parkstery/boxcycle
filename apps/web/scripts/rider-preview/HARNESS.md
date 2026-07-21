# 라이더 GLB 하네스 — 도구 사용법 (HOW)

이 폴더(`apps/web/scripts/rider-preview/`)는 라이더 GLB를 **앱 구동 없이 검증·프리뷰**하는
오프스크린 하네스다. **언제·왜 쓰는가**는 [`.claude/skills/rider-preview/SKILL.md`](../../../../.claude/skills/rider-preview/SKILL.md)를 보라 —
이 문서는 **어떻게 쓰는가**만 다룬다.

모두 `apps/web/`에서 실행. 추가 의존성 없음(three·playwright·vite 모두 devDep).

## 파일

| 파일 | 역할 |
|---|---|
| `verify-rider-glb.mjs` | 정적 검증 — 노드·AABB·IK 불변식 (exit 0/1) |
| `render-views.mjs` | 시각 렌더 — 6뷰/머리4뷰 PNG 오케스트레이터 |
| `rider-viewer.html` | render-views 가 서빙하는 three 뷰어(직접 실행 안 함) |
| `.out/` | 렌더 PNG 출력물(gitignore — 휘발성 검토용) |

## 1. 정적 검증 `verify-rider-glb.mjs`

```bash
cd apps/web && node scripts/rider-preview/verify-rider-glb.mjs [glbPath]
```
기본 glbPath = `public/rider/prototype/rider-lowpoly.glb`.

검사(하나라도 실패 시 exit 1):
- **노드 6종** 존재: `crank, leg_l, leg_l_shin, leg_r, leg_r_shin, torso` — 이름 변경 시 페달링 IK 파손.
- **월드 AABB** 전고 1.10~1.30m · 전장 1.25~1.55m — 저스케일·형태붕괴 회귀 감지. `groundShadow` 노드는 제외.
- **IK 좌표 불변식**이 `src/lib/riderGlbPedalPose.ts`와 완전 일치(`pelvis/bb/kneeLocal/crankArmM`) — 두 파일이 하드코딩 공유하므로 한쪽만 바꾸면 발이 페달에서 떨어진다.

모델 변경 후 **항상** 돌린다. tsc 처럼 커밋 전 게이트로 쓸 것.

기대값을 바꾸려면 스크립트 상단 `HEIGHT_RANGE_M`·`LENGTH_RANGE_M`·`REQUIRED_NODES`·`IK_INVARIANTS`를
인수인계 §2와 함께 갱신한다.

## 2. 시각 렌더 `render-views.mjs`

```bash
cd apps/web && node scripts/rider-preview/render-views.mjs [--body|--head|--both] [--out <dir>] [--glb <publicPath>]
```
- `--body`: 전신 6뷰(FRONT/BACK/LEFT/RIGHT/TOP/Q34) → `.out/rider-body.png`. 형태·비율·자세 확인.
- `--head`: 머리 4방향(FRONT/LEFT/RIGHT/TOP) → `.out/rider-head.png`. 얼굴 노출·헬멧 얹힘·선글라스 확인(전신 6뷰로는 머리 디테일 판독 불가).
- `--both`(기본): 둘 다.
- 동작: `rider-viewer.html`을 `public/`에 임시 복사 → 일회용 vite dev(임의 포트) → chromium 오프스크린 → PNG → 임시파일·서버 자동 정리.
- 산출 PNG를 Read 툴로 열어 눈으로 확인하고 사용자에게 보여 승인받는다.

## 재생성

모델 변경은 스크립트 `apps/web/scripts/generate-rider-prototype-glb.mjs`를 고친 뒤:
```bash
cd apps/web && npm run gen:rider-glb   # → public/rider/prototype/rider-lowpoly.glb
```
GLB는 정적 자산이라 브라우저가 캐시한다 — 실주행 확인 시 **강력 새로고침(Ctrl+Shift+R)**.

## 미구현 (하네스 확장 TODO)

- **8위상 페달 렌더(`--pedal`)**: 현재 render-views 는 **정지 포즈만** 렌더한다. 페달링 포즈
  (정강이 솟음 등 IK 궤적)는 검증 못 한다. 필요하면 인수인계 §3(페달 위상)·§4.1b(`cosHip=+1` 버그)를
  참고해 8위상 렌더를 추가하라. 그 전까지 페달링은 실주행으로 확인.

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

## 후보 워크플로 (제품 GLB 게이트 — auto 모드여도 강제)

게이트 대상은 gen 실행이 아니라 **제품 파일** `public/rider/prototype/rider-lowpoly.glb`(앱 로드).
판정 기준·단계 게이트·승인 문구는 [SKILL.md](../../../../.claude/skills/rider-preview/SKILL.md) 「제품 GLB 게이트」.

**추적 체계는 `riderCandidate.mjs` 공용 모듈**(candidateId·source hash·경로)로 단일화한다.

```bash
cd apps/web
# 1) 후보 생성 — .out/candidates/<candidateId>/ 에만. 제품 파일 미변경.
node scripts/build-rider-candidate.mjs
#    → candidateId = YYYYMMDD-HHmmss-<sourceHash8> (KST). GLB·meta 를 후보 디렉토리에.

# 2) 후보 프리뷰 렌더 — candidateId 파일명 + 이미지 내부 메타(UNAPPROVED) 오버레이.
node scripts/rider-preview/render-views.mjs --candidate <candidateId> --rider-only --silhouette --stage RIDER_ONLY
#    산출: rider-only-body-<id>.png · rider-only-silhouette-<id>.png (후보 디렉토리)

# 3) Read 로 PNG 열어 사용자 화면에 표시 → 승인/거부 요청 → 명시 승인 전 중단.

# 4) 승인 후에만 — 후보 GLB 를 제품 경로로 byte-for-byte 복사 + SHA-256 대조.
node scripts/rider-preview/promote-candidate.mjs <candidateId>
#    → Match: YES 여야 확정. 불일치면 실패·commit 금지. (재생성 아님 — 사용자가 본 그 파일.)
```

- **source hash 대상**: rig·IK·pose·viewer·renderer 포함(§SKILL 3). 관련 소스가 한 줄이라도 바뀌면 새 candidateId.
- **스킬 사본 동기화**: `node scripts/rider-preview/sync-skill.mjs [--check]` — `.claude`(원본)→`.agents`. `--check` 불일치면 exit 1.
- 구 `npm run gen:rider-glb` 는 제품 경로를 직접 덮어쓰므로(구 파이프라인) **후보 단계에서 쓰지 않는다.**
- GLB 캐시 — 실주행 확인 시 **강력 새로고침(Ctrl+Shift+R)**.

## 3. 페달 5위상 렌더 `render-views.mjs --pedal`

```bash
cd apps/web && node scripts/rider-preview/render-views.mjs --pedal
```
- 크랭크 0/90/180/270/360° 5장을 측면(LEFT)으로 → `.out/rider-pedal.png`. 페달링 IK 궤적 확인.
- 뷰어(`rider-viewer.html`)가 앱과 **동일한** `riderGlbPedalPose.pose.mjs` 를 import 해 각 위상 포즈를
  노드에 적용한다 — 프리뷰=실주행 규약 일치. `--body`/`--head` 와 함께 지정 가능(예: `--body --pedal`).

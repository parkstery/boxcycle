# 감리 P1 — 죽은 코드 정리 (지시01~04)

2026-10-22 · review · Claude · **APPROVED**

## 결과

| 지표 | 기준선 v2 | P1 후 |
|---|---:|---:|
| 안 쓰이는 export | 446 | **192** |
| 안 쓰이는 타입 | 73 | **44** |
| 같은 것 두 이름 | 10 | 7 |
| src 안 쓰이는 파일 | 2 | 1 (`openMeteoWeather.ts` — 의도적 보존) |
| 빌드 경고 `SADDLE`·`PELVIS` undefined | 2 | **0** |
| src 줄 | — | **−715 / +169** (89파일, +는 대부분 `export` 뗀 같은 줄) |

남은 192·44 는 재분류에서 KEEP(시험·하네스가 `await import()` 로 쓰는 것) — knip 이 못 보는 사용이라 숫자로는 남는다. P7 게이트는 이 값을 상한으로 쓴다.

## 실행자별

| 지시 | 실행 | 처리 | 비고 |
|---|---|---:|---|
| 01 라이더·카메라·geo | GLM-5.3-Flash | 55/55 | 범위 밖 수정 0, 추가 줄은 전부 `export` 제거 확인 |
| 02 peerMotion·trail·sensor 등 | MiniMax M3.1 Flash | 67/67 | 정상 종료 |
| 03 ride·route | DeepSeek V4.1 Flash | 78/78 | 처리 후 보고 직전 무료 한도로 중단 |
| 04 map·components 등 | GLM-5.3-Flash | 92/92 | 무료 한도로 중단. **결함 1:** `mapGlobeView.ts` 의 쓰이는 import 삭제 → 감리 복구 |

opencode 무료 사용 한도(`Free usage limit reached`)는 모델 공통으로 보인다(GLM·DeepSeek 가 같은 시각 중단). P3 는 Cursor 로 넘긴다.

## 감리 판단

- `openMeteoWeather.ts` 삭제 지시는 **철회**. `dep-layers.json` weather 도메인 책임에 「2026-08-27 표시 제거 후 되살리기 위해 의도적으로 보존」이 있고, 날씨 부활은 현황판 §4-3 Chief 결정 대기다. 계획 작성 때 놓친 감리 오류.
- P2(끝난 실험 스크립트): knip 이 「안 쓰임」으로 본 34개를 대조한 결과 전부 `package.json`·HTML 픽스처·e2e·HARNESS.md 에서 실행된다. 만료 지난 `dev-tools.json` 항목도 0. **삭제 없음.** 대신 `knip.config.mjs` 에서 `scripts/**` 를 진입점으로 두어 측정을 제품 소스에 집중시켰다.

## 검증 (감리 직접)

| 검사 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | 오류 0 |
| `check-dep-direction --check` | 위반 0 · 순환 0 |
| `npx eslint .` | 오류 0 · 경고 37 (이전 40) |
| `npm run test:quick` | 1,341 통과 · 실패 0 |
| `npm run build` | 성공, `IMPORT_IS_UNDEFINED` 경고 사라짐 |
| `test:e2e:ride` (에뮬레이터, `RTW_DEV_PORT=5012`) | **7/7 통과** — 5002 는 기존 서버가 쓰고 있어 포트만 바꿨다 |

커밋: `4d983775` · `0df17802` · `3a20a84d` · `c3ed46f4`

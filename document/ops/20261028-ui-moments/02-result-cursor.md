# 02-result-cursor — 1차 구현 (감리 재지시 전 중단)

Cursor. 2026-10-28. 커밋·푸시·배포 없음. 기존 dirty·증거 보존.

1차 제품 구현은 `IMPLEMENTATION_READY`까지 끝났고, 긴 시험 도중에 Supervisor `04-task-review-fixes.md`가 들어와 이 파일은 **1차 패스의 중단 요약**이다. 감리 결함 수정은 `05-result-review-fixes.md`.

## 1차에서 넣은 것

HUD 3×2·폭≤50%, 계정 닉네임만, 좌우 `EdgePanelHandle` 반달 탭, 인터벌 왼쪽·순위 오른쪽, 설정 3프리셋+접힌 직접설정(초 단위·라운드 1–3), 응원 순수함수+`useRideMoments`(MapHud 자식), 효과음 기본 끔, 완주 시 진행 막대 숨김(부분주행 막대는 유지). 신규 증거만 이 묶음 `evidence/`.

## 1차 검증 (중단 시점)

| 명령 | 결과 |
|---|---|
| `node --test scripts/ride-interval/*.test.ts` | 인터벌 12/12, 응원 4/4 PASS |
| `npx tsc -b --noEmit` | PASS |
| eslint 제품 | 오류 0 / App 기존 경고 유지 |
| `verify-selectors.mjs` | 19/19 |
| `npm run build` | PASS (vite ~1.8s) |
| 127.0.0.1:5031 preview | HTTP 200, 미종료 |
| `e2e/ride-ui-moments.spec.ts` | 처음 3/6 FAIL → HUD 탭 가로채기·결과 저장 버튼 수정 후 6/6 PASS |
| `e2e/ride-interval.spec.ts` | PASS |
| `e2e/ride-interval-settings.spec.ts` | 3 FAIL(총시간 39:00, 접힌 필드, ArrowDown 1초) 후 helper/키보드 수정. 이어서 0초 총시간 10:54 1FAIL(configure가 준비/마무리를 300으로 되돌림) — **미해결 상태로 감리 재지시** |
| `e2e/ui-800x360.spec.ts` grep 순위/반원/에지/결과 | 3 FAIL: story-detail 10px vs 11, 에지 클릭이 탭을 열어 dialog 1, 탭 hit-test false. **미해결** |
| review-probes (감리, 구현 중) | 종료 1 PASS / 경고재개·점프완료·인터벌재시작·준비0초·AudioContext 5 FAIL |

## 1차 핵심 선택

응원 타이머는 App이 아니라 MapHud 훅. 순위는 TR 원형 칩이 아니라 오른쪽 반달. 인터벌 HUD는 `.map-hud__tl` 흐름. 완주 fixture만 막대 숨김.

## 1차가 남긴 실패·위험

- 펼친 순위판이 우상단 컨트롤과 겹침(감리 실측 800×360). 당시 e2e는 핸들 좌표만 봐 놓침.
- 응원: 종료 후 `ended`가 다음 주행을 막음, pause가 warnedStep을 지움, 점프 완료가 한 틱 늦음, 같은 주행 인터벌 재시작 불가, 준비 0초도 「준비부터」, AudioContext 생성 예외/느린 resume.
- 구형 ui-800x360·설정 e2e 잔여 FAIL을 이 파일 작성 전에 끝내지 못함.

새 캡처(1차): `evidence/interval-settings-custom-800x360.png`, `evidence/riding-*.png`(이후 감리 수정에서 덮어씀).

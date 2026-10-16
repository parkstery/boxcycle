# 지시 P6 — rider14 승격 (제품 기본 모델 전환 · 빌드)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 선행 | P5 감리 통과(G5 중 실기기 항목 제외) |
| 계획 | [01-plan.md §6 P6 · G6 · §9 롤백](01-plan.md) |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` (브랜치 `rider14-replace`) |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p6.md` |

## 1. 전환 (이 두 곳만이 "제품 모델"을 정한다)

1. `apps/web/src/lib/riderPrototype/config.ts`: `PRESERVED_RIDER_ACTIVE_MODEL` 을 `"rider14"` 로. 주석의 롤백 안내(이 한 줄을 `"s5"` 로)를 유지.
2. `apps/web/public/rider/preserved/candidates/20261015-212136-df8de090/candidate.json`: `status` → `"APP_APPROVED_PRODUCT_ACTIVE"`, `appApprovedAtKst` 추가(오늘 KST 날짜), `appApprovalTarget: "rider-perf-bench.html (P4 G4) + local app"`. 다른 필드·`rider.glb`·`guide-weights.json` 은 바이트 그대로(해시 재확인).
3. s5 후보 폴더 `20260921-041426-cd81398e/` 는 **어떤 파일도 바꾸지 않는다**(롤백 경로, 계획 §9). s5 프로필 코드도 그대로 둔다.

## 2. 계약 시험 갱신 (`scripts/rider-preserve/preserved-layer-contract.test.mjs`)

느슨하게 만들지 말고 새 구조에 맞게 바꾼다.

- 하드코딩된 `candidateId = "20260921-041426-cd81398e"` 를 없애고, `config.ts` 텍스트에서 `PRESERVED_RIDER_ACTIVE_MODEL` 값과 `PRESERVED_RIDER_MODELS` 의 해당 `candidateId` 를 정규식으로 읽어 **활성 후보**를 정한다. 그 값이 `rider14` / `20261015-212136-df8de090` 인지 단언.
- "approved candidate assets are staged byte-for-byte" 를 두 개로:
  - 활성 후보: `status === "APP_APPROVED_PRODUCT_ACTIVE"`, `rider.glb` SHA = `sourceGlbSha256` = `stagedGlbSha256`, 가이드 SHA = `guideRuntimeSha256`. `schemaVersion === 1` 이면 `pedalReportSha256` 형식 단언, `2` 이면 대신 `geometryEquivalentTo` 가 s5 ID 이고 `rider14-equivalence.test.ts` 파일이 존재함을 단언(동등성 근거).
  - 롤백 후보(s5): 폴더와 세 파일이 존재하고 `rider.glb` SHA = `1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb` 로 고정.
- 나머지 시험(제품 GLB 격리, MapView, 렌더 루프, 네임태그)은 그대로 통과해야 한다.

## 3. 빌드·검사 (PowerShell, `apps/web`)

1. `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm run test:rider-preserve`
2. **번들 크기 비교**: 먼저 `git stash` 없이 비교하려면 — 전환 전 상태로 한 번(`PRESERVED_RIDER_ACTIVE_MODEL="s5"`) `npm run build` 하고 `dist/assets` 의 JS 합계·가장 큰 청크 크기를 기록, 다시 `"rider14"` 로 바꿔 `npm run build` 후 같은 값 기록. 메모리 부족을 피하려고 빌드는 한 번에 하나, 다른 브라우저·측정과 동시에 돌리지 않는다. (meshopt 디코더는 P2a 부터 포함돼 있으므로 기준이 되는 `main2` 의 번들 크기는 Supervisor 가 따로 잰다 — 여기서는 두 빌드 값만)
3. **운영 빌드에서 `riderModel` 쿼리가 무시되는지**: 최종 `dist/assets/*.js` 에서 문자열 `riderModel` 검색 결과를 기록(0건이 기대값 — `import.meta.env.DEV` 분기가 제거됨). 남아 있으면 그 줄 앞뒤 200자를 결과에 붙인다.
4. `npm run build` 출력 경고 중 rider 관련(`riderPrototype`, `meshopt`, `rider-preserve`) 만 따로 옮겨 적는다.

## 4. 로컬 앱 확인 (브라우저 1개)

dev 서버 `http://localhost:5040` (Supervisor 가 띄워 둠, HMR 로 전환 반영됨)에서 **실제 앱 첫 화면**을 열어 라이더가 rider14 로 뜨는지 확인한다.

- 앱 진입·주행 흐름은 저장소 e2e 의 방식을 참고한다(`playwright.config.ts`, `e2e/` 의 `pacer-solo`·`camera-qc-lightlab`). 에뮬레이터가 필요한 경로라 무겁다면, **`npm run test:e2e:pacer` 1회**를 대신 실행해 통과 여부를 기록하고(본인 + 페이서가 preserved 레이어로 그려지는 경로), 같은 시험의 스크린샷·trace 가 남으면 경로를 적는다.
- 가능하면 `?lightlab=1` 로 조명 조절판이 뜨는 화면을 1장 캡처(rider14 상태).
- 네트워크 탭/`performance` 로 실제 로드된 라이더 자산 URL 이 `candidates/20261015-212136-df8de090/` 인지 기록.

## 결과 파일 `03-result-p6.md`

변경 파일 diff 요약, 시험·lint·tsc exit code, 두 빌드의 번들 수치, `riderModel` 검색 결과, 로컬 앱/e2e 결과와 캡처 경로, 롤백 절차 한 줄 재확인(“`config.ts` 한 줄 되돌리면 s5”), 이상 사항.

## 금지

commit · push · 배포 · `npm install`, s5 후보 파일 변경, 리그 수학 변경, 브라우저 2개 이상 동시, 백그라운드 잔류.

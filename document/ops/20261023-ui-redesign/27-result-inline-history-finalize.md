# 결과 27 — 인라인 기록 유지·첫 라이딩 카드 삭제 마감

2026-10-24 · Supervisor Codex · [지시26](26-task-inline-history-finalize.md) · [이전 결과25](25-result-entry-card-history.md)

## 구현

- Chief 결정: 현재 인라인 주행 기록 유지. 비교용 panel 연결·상태·props·CSS·모드 파일·의존 등록 제거. `UserInfoSheet.tsx/.css`와 `RideHistoryPanel.tsx`는 HEAD 대비 diff 0. 기존 기록별 지도 보기·이어 달리기·여기서 새 경로 행동 보존.
- 프리뷰 메모리 3건은 인라인 목록 검수에 재사용. Chief 고정10 펼침/접기·통계 유지·전용 판 없음 회귀 시험 추가.
- 지시24 A 카드 삭제 보존. 죽은 Ready Ride 전용 config·dev-tools 등록 및 카드에서만 쓰던 `clearLocalFirstRegion` 제거. 원래 정련 검사에서 미사용 export 186→187로 실패해 발견했으며 기준선은 변경하지 않음.
- Cursor CLI 2회 시작 실패(`uv_os_get_passwd returned ENOMEM`). Codex가 지시26 범위 직접 구현·검증. restore/clean/stash/worktree 사용 없음.
- 고정 목록10·결정 로그에 인라인 유지 결정, 묶음 README에 UI·UX 품질 개선 목적 기록. 비교 파일은 당시 검토 기록으로 보존하고 inline 채택을 표시.

## Supervisor 감리·증거

| 검증 | 명령·실행 위치 | 결과 |
|---|---|---|
| 타입 | `C:\20.HDev\boxcycle\apps\web` — `node ../../node_modules/typescript/bin/tsc -b --noEmit` | PASS |
| 변경 파일 lint | 같은 폴더 — `node ../../node_modules/eslint/bin/eslint.js src/App.tsx scripts/ui-800x360/preview.tsx e2e/ui-800x360.spec.ts` | 오류0·App 기존경고7 |
| selector | 같은 폴더 — `node scripts/ride-verify/verify-selectors.mjs` | 19/19 PASS |
| 단위 첫 실행 | 같은 폴더 — `npm run test:quick` | 1350 PASS / 4 FAIL. 성능 시험1(563ms, 실제 기준500ms)·Windows watchdog 종료시험3. 로그 `evidence/entry-card-history/supervisor-quick.log` |
| 단위 재검 | 같은 폴더 — `npm run test:quick`(일반 권한) | **1354 PASS / 0 FAIL**, 89.3초. watchdog 단독도4/4, 성능 단독32/32. 기대값·게이트 변경 없음. `supervisor-quick-unsandboxed.log`·`supervisor-watchdog.log` |
| 화면 | 같은 폴더 — `$env:RTW_DEV_PORT='5020'; $env:ROUTE_TOKEN_UI_LIVE='1'; node ../../node_modules/@playwright/test/cli.js test ui-800x360 ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --output=test-results --workers=1 --retries=0` | **24/24 PASS**. 종료 시 샌드박스의 자식 프로세스 종료 제한으로 서버 종료 대기, worker 종료 확인 후 이번 5020 서버 트리만 정리. `supervisor-ui.log` |
| 구조 | `C:\20.HDev\boxcycle` — `node scripts/check-dep-direction.mjs --check`, `node scripts/check-dev-tools.mjs --check`, `node scripts/check-document-system.mjs`, `git diff --check` | PASS(문서 누락0·의존 위반0·개발도구 경고0) |

직접 본 캡처: `evidence/inline-history/final-inline-800x360.png`·`final-inline-667x300.png`. 작은 화면에서도 통계와 펼침 목록이 함께 보임. 첫 방문 카드 before는 실앱, 기존 after는 ready fixture여서 동일 상태 비교가 아님. 실앱 idle 캡처·카드 부재 확인은 batch2-live에 추가하여 별도 검증.

## 최종 검증

- 정련 재검 PASS: 미사용 exports186·반복18줄·기준선 변경0. `supervisor-tidy-final.log`.
- 실앱 **8/8 PASS**, 전체258.6초. 실행 폴더 `C:\20.HDev\boxcycle\apps\web`: `$env:RTW_DEV_PORT='5017'; $env:BATCH2_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\inline-history'; node scripts/e2e/run-with-deadline.mjs --limit-sec 540 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry ui-redesign-batch2-live --workers=1 --retries=0'`. 로그 `supervisor-live.log`. 에뮬레이터 정상 종료.
- 실앱 idle 캡처 `evidence/inline-history/batch2-live-idle-no-first-card-800x360.png` 직접 확인. 카드 없음, 기존 RouteDock 유지. 지도 Style 로드 중 기존 overlay 경고가 있지만 8건 모두 통과. 기능·데이터 변경으로 확장하지 않고 기록.
- 보존 JSON SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F` 일치. `.out/`·`cdbox.bat`·기존3000/5000/5040 보존.

## 배포

감리 PASS. 커밋 **`3c3ba02c`**, origin/main2 푸시 완료. pre-push에서 단위1354/0(59.3초)·selector19·정련·의존·개발도구·타입·동행 간격 게이트 PASS. 첫 PowerShell 푸시는 고장 난 `~/bin/npm` 래퍼로 실패했고, 플레이북대로 Git Bash 내부 PATH를 `/c/Program Files/nodejs` 우선으로 지정해 정상 통과(게이트 우회0). 승인된 호스팅 배포·운영 번들 대조 진행 중. 묶음3(지시28) 제품 변경은 포함하지 않는다.

**10:13 KST 배포 완료.** 운영 `https://boxcycle-dc2df.web.app`의 HTML 자산 목록·JS/CSS 5개 SHA256이 로컬 빌드와 모두 일치. 메인 `index-BDb2hU8r.js`, CSS `index-Dx13Hjt3.css`. 증거 [배포 대조](evidence/inline-history/deploy-proof.json)·[검증 요약](evidence/inline-history/verification-summary.txt). 함수·Rules 배포 없음. 묶음3는 이 배포 이후 별도 로컬 작업으로 진행.

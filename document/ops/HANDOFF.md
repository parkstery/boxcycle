# HANDOFF — 지금 상태 한 장

| 항목 | 값 |
|---|---|
| 담당 | **Codex (2026-10-24 09:25 KST 인수)** |
| 갱신 | 2026-10-24 10:09 KST — 지시24·26 감리 PASS, 커밋·푸시·승인된 호스팅 배포 단계 |
| 브랜치 | `main2` |
| HEAD / 원격 | 배포 전 HEAD `0a9a3c07`, fetch 확인 origin/main2 `841b9540`(문서1개 앞섬). 다음 커밋에 카드 삭제·인라인 유지 마감 |
| 마지막 배포 | 10-24 Hosting `index-DmTMAA6G.js`(이전 묶음1·2·경로 목록·Chief 조작부). 함수 변경 없음 |

## 먼저 읽을 것

1. [Chief 지정 디자인 고정1~10](../reference/product/261024-RTW-Chief-지정-디자인-고정.md). 시안·규칙·수퍼바이저 판단보다 우선. **10: 주행 기록은 계정 패널 안 현재 인라인 유지.**
2. [묶음 README](20261023-ui-redesign/README.md)·[결과27](20261023-ui-redesign/27-result-inline-history-finalize.md).
3. [플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md).

## 현재 완료·진행

- 기존 묶음1·2, 경로 목록 흰 불투명 한 줄 행·이동수단 아이콘, Chief 지정 조작부는 이전 호스팅 배포 완료.
- 지시24 A 첫 라이딩 카드 삭제 구현, 카드 전용 Ready Ride·미사용 함수·시험 config·등록 정리.
- Chief 비교 결정: **인라인 스타일 유지**. panel 비교용 연결·상태·props·CSS·플래그 제거. UserInfoSheet.tsx/.css·RideHistoryPanel.tsx는 기존 HEAD 대비 diff0. 기존 기록별 지도 보기·이어달리기·새 경로 보존. 고정목록10·결정로그에 반영.
- 감리: 타입·변경lint오류0·selector19·단위1354·화면24·실앱8(ride-entry7+batch2-live1)·정련·의존·개발도구·문서 PASS. 직접 확인한 캡처 `evidence/inline-history/`. 전체 결과27 참고.
- 처음 sandbox 단위는 성능1·watchdog3 FAIL. 동일 전체를 일반 권한으로 재실행1354/0. 기대값·기준선 변경0. sandbox 화면 종료는 worker 종료 후 자신의5020 서버만 정리해24/24 exit0 확인.

## 다음 한 걸음

1. 지시24·26 커밋·푸시→`npm run deploy:hosting`(루트)→운영 번들 SHA256 대조. **Chief 10-24 「카드 삭제하면 푸시 배포도 다시」 승인 있음. 재승인 요청 불필요.**
2. Chief 「UI·UX 품질 개선 관점으로 다음 작업 계속해」에 따라 [지시28 묶음3](20261023-ui-redesign/28-task-batch3-summary-next.md) 작성. 카드 삭제 배포를 먼저 마치고 Cursor 구현→Supervisor 실제 diff/캡처 감리→로컬 비교. 주행 결과·다음 주행 화면의 정보 위계·밀도·버튼 일관성을 개선하고 기존 행동·데이터 정책은 유지. 새 화면 배포는 카드 삭제 승인과 섞지 않는다.
3. 결과29가 아직 없으면 묶음3 미착수. Cursor 실행자는 현재 없음. 이전 지시26 Cursor는 sandbox에서 uv_os_get_passwd ENOMEM로2회 시작 실패해 Codex가 직접 마감.

## 보존할 작업 트리

- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`: 기존 dirty. SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F` 확인. 커밋·변경하지 않는다.
- `.out/`·`cdbox.bat`: 비추적, 손대지 않는다. restore/clean/stash/worktree·일괄 되돌리기 금지.

## 서버·환경

- 기존3000(PID28472)=Chief imgman. 절대 종료 금지. 기존5000(PID40328)·5040(PID10096)도 인수 때 열림, 그대로 보존.
- 이번 시험5020·5017 및 Firebase 에뮬레이터는 종료. 실앱 시험8건 정상 exit0. openclaw18789는 인수 때 닫힘, 이 앱과 무관하니 재기동되어도 손대지 않는다.
- 5000 정상 앱은 운영 Firebase 연결, 시험 데이터 쓰기 금지. 데이터 시험은 에뮬레이터만.
- 실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 화면 프리뷰: `$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort`.
- 실앱: `$env:RTW_DEV_PORT='5017'; node scripts/e2e/run-with-deadline.mjs --limit-sec 540 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry --workers=1 --retries=0'`. Windows 전역 playwright 대신 위 node CLI 사용. 5001 비어 있는지 확인. 5분 무진전이면 로그·프로세스·포트 확인 후 경로 전환.

# Cursor 최종 UI 시험 정리 — 좁은 범위

Codex가 01/04 계획·감리를 담당했고 제품은1차와재작업 완료. 지금은 **남아있는 관련 UI 시험과 UI 마감만** 수행한다. Supervisor가 hooks/lib/MapHud 연결을 별도로 보완하므로 아래 소유범위를 지킨다. 다른 실행자의 수정은 보존하고 되돌리지 않는다.

읽기: AGENTS.md, 이 작업 README, 02-result-cursor.md,05-result-review-fixes.md. 승인시안 mockups/approved-v2.html. 상세 범위가 필요할 때만01/04를 읽고 리포전역재탐색금지. 5031서버 정상이며 재사용. 원래dirty와보호증거535개 보존. 새캡처 evidence/final-cursor/에만 작성.

## Cursor 소유

- e2e/ride-ui-moments.spec.ts,ride-interval.spec.ts,ride-interval-settings.spec.ts,ui-800x360.spec.ts,map-menu-consolidation.spec.ts 및 필요한 scripts/ui-800x360/preview.tsx. **제품 hooks/lib/ride/App.tsx/MapHud.tsx 수정금지**(Supervisor 동시 작업).
- src/components/leaderboard/LeaderboardGlance.tsx/.css, src/components/ui/EdgePanelHandle.tsx/.css, src/components/ride/RideIntervalSettingsSheet.tsx/.css, RideSummarySheet.tsx/.css 및 MapHud.css는 관련 실패의 제품버그가 있는 경우만 최소수정 허용. UI 승인과 직접 충돌하는 옛 시험만 변경, 타입·출력 기대를 무작정완화금지.
- 코드정리: 상단순위칩은 제거됐으므로 미사용 LeaderboardGlanceChip/RankChipIcon/관련폐기CSS를 지우고 쓰이는 Panel은 보존. 기존기능/앵커에영향없게.

## 해야 할 검증

실행폴더 C:\20.HDev\boxcycle\apps\web, `$env:RTW_DEV_PORT='5031'`. 먼저 `npx playwright test e2e/ride-ui-moments.spec.ts e2e/ride-interval.spec.ts e2e/ride-interval-settings.spec.ts e2e/ui-800x360.spec.ts e2e/map-menu-consolidation.spec.ts --workers=1 --retries=0`를 로그 파일에 저장해 실행. 끝없이 묶음 재실행 말고 실패항목만고친뒤해당시험재실행. 원래 known story-detail10px는Chief최소10px기준이정본이므로11px라는낡은기대는10px이상으로일치시켜도됨. 구형edge20px무클릭띠와새반달44×76클릭핸들은별개:띠안클릭/실제반달클릭을구분하고새승인에맞춰시험. 셀렉터/동작/비겹침확인삭제금지.

설정의 configure helper가 준비/마무리0을다시300으로덮는지 수정하고, 제품의0초건너뜀을실제검증. 계정약자삭제확인,양측클릭/drag,펼친순위rect비겹침4크기,설정3구성·초안취소·재진입/새로고침최근값·20:10라운드합계,완주/미완주결과동작확인.

현재 직접설정은 expanded를 접는버튼이없음. 작은행버튼(접기)을 넣어 다시간단요약으로돌아갈수있게하며초안값유지. 추가타입/코어변경없이가능. 스크롤시footer/닫기접근가능. 최소44px터치유지.

소유TS파일eslint. tsc/build/quick전체는Supervisor가최종실행하므로중복실행하지말것. 전체quick 이미1433PASS. 시험종료시결과 `07-result-test-closeout.md`에 명령/통과·실패·미실행/실패초기와최종/변경파일/캡처경로/남은위험을 간결히작성. 시험이5분무진전이면브라우저더기다리지말고로그·포트확인해종료·기록. git restore/clean/stash/worktree/브랜치전환/커밋푸시배포·functions/DB/규칙기준선완화·의존설정변경금지. 사용자 새지시:Supervisor가토큰8%중단요청하면곧바로현재결과기록후멈춘다.

# Codex 인수 첫 프롬프트 (2026-10-24, Claude Code → Codex)

아래 본문을 Codex 새 대화에 그대로 붙여 넣는다. (10-24 08:4x 갱신 — 배포·지시 24 반영)

```text
C:\20.HDev\boxcycle 의 다음 Supervisor 로 인수하라.

1. AGENTS.md → document/ops/HANDOFF.md → document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 순서로 읽어라. 고정 목록은 Chief 가 직접 정한 화면이며 시안·디자인 규칙·네 판단보다 우선한다. 지시서를 쓸 때 걸리는 항목을 「금지」에 옮기고, 감리에서 diff 가 목록 항목을 건드렸으면 다른 시험이 통과해도 FAIL 로 판정하라. Chief 가 화면을 새로 직접 지시하면 그 작업을 끝낼 때 목록에 한 줄 더하라.

2. HANDOFF 「담당」을 Codex 와 인수 시각(KST)으로 고치고 실제 상태를 대조하라: HEAD 와 origin/main2, git status, 보존 JSON(document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json) SHA256 4CAFA2A2…, 떠 있는 포트(3000 만 정상 — 이 앱 서버는 모두 꺼진 상태로 넘긴다). 다르면 그 차이부터 보고하라.

3. 현재 상태:
   - main2 에 묶음 1·2, 경로 목록(흰 박스·한 줄 행·이동수단 아이콘), Chief 지정 조작부 되돌리기가 커밋·푸시되고 10-24 호스팅 배포까지 끝났다(운영 번들 index-DmTMAA6G.js). 함수는 변경 없음.
   - 지시 24(document/ops/20261023-ui-redesign/24-task-entry-card-history.md)를 Cursor CLI 에 맡겼다: A 「어디에서 첫 라이딩을 할까요?」 카드(LocalFirstEntryCard) 삭제(Chief 결정), B 주행 기록 화면(RideHistoryPanel)을 계정 패널 「마지막 주행 ›」에 연결(Chief 가 지금 화면과 비교 후 유지/제거 결정, 플래그 ACCOUNT_HISTORY_MODE).
   - 결과 파일 25-result-entry-card-history.md 가 있으면 Cursor 가 끝난 것이다. 없으면 git status·git diff --stat 으로 어디까지 됐는지 보고, Cursor 가 아직 돌고 있는지(프로세스) 확인한 뒤 남은 것만 이어가라. 미커밋 변경은 지시 24 의 것이니 되돌리지 마라.

4. 지시 24 마감 순서(HANDOFF 「다음 한 걸음」 1번): 결과 25 감리(before/after 캡처 직접 확인, 사라진 기능 목록 확인, 고정 목록 미변경) → 실앱 에뮬레이터 ride-entry(기본 runner) → 커밋·푸시·호스팅 배포(Chief 승인 받음: 「카드 삭제하면 푸시 배포도 다시」). 배포할 때 B 는 ACCOUNT_HISTORY_MODE = "inline"(현재 운영 화면 그대로)으로 둔다 — Chief 가 B 를 아직 결정하지 않았다. 배포 후 운영 번들 해시를 로컬 빌드와 대조하고, Chief 에게 before/after 비교 경로와 「panel 모드를 로컬에서 보는 법」을 보고하라.

5. 그 밖의 일(묶음 3 등)은 Chief 의 새 지시가 있을 때만. 화면 수정은 document/ops/20261023-ui-redesign/ 에 다음 번호(26~) 지시서 → Cursor CLI 구현 → 네 감리(캡처 직접 확인) → 결과 파일 「감리」 절. 실행자 호출·감리 명령·배포 절차·환경 함정은 document/reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md.

6. 지킬 것: 15-entry-flight-metrics.json·.out/·cdbox.bat 보존, restore/clean/stash/worktree/일괄 되돌리기 금지, localhost:3000 끄지 말 것, 5000 은 운영 Firebase 라 시험 데이터 쓰기 금지(데이터 시험은 에뮬레이터만), 게이트 기준선·시험 기대값 완화 금지(특히 「Chief 고정」 잠금 시험), 띄운 dev 서버는 시험 끝나면 끈다. openclaw gateway 는 Chief 지시로 껐다 — 다시 켜져 있어도 이 앱과 무관하니 손대지 말고 보고만 하라.

7. Chief 와는 한국어 존댓말, 「chief」 호칭, 결론부터 쉬운 말로. 확인을 부탁할 땐 실행 폴더 전체 경로·복사 가능한 명령·주소·새로고침 여부를 함께 적어라. 작업 단위가 끝날 때마다, 그리고 끊기기 전에 HANDOFF.md·PROGRESS.md·묶음 결과 파일을 갱신하라.

인수 대조가 끝나면 현재 상태와 다음 할 일을 짧게 보고하라.
```

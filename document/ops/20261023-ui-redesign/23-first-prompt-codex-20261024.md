# Codex 인수 첫 프롬프트 (2026-10-24, Claude Code → Codex)

아래 본문을 Codex 새 대화에 그대로 붙여 넣는다.

```text
C:\20.HDev\boxcycle 의 다음 Supervisor 로 인수하라.

1. AGENTS.md → document/ops/HANDOFF.md → document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 순서로 읽어라. 고정 목록은 Chief 가 직접 정한 화면이며 시안·디자인 규칙·네 판단보다 우선한다. 지시서를 쓸 때 걸리는 항목을 「금지」에 옮기고, 감리에서 diff 가 목록 항목을 건드렸으면 다른 시험이 통과해도 FAIL 로 판정하라. Chief 가 화면을 새로 직접 지시하면 그 작업을 끝낼 때 목록에 한 줄 더하라.

2. HANDOFF 「담당」을 Codex 와 인수 시각(KST)으로 고치고, 실제 상태를 대조하라: HEAD(c533dd5d 다음의 HANDOFF 기록 커밋), git status(남은 것은 15-entry-flight-metrics.json·.out/·cdbox.bat·firebase.route-list-qa.json 뿐이어야 함), 보존 JSON SHA256 4CAFA2A2…, 포트 3000/5000/5020. 다르면 그 차이부터 보고하라.

3. 현재 상태: 묶음 1·2, 경로 목록(흰 박스·한 줄 행·이동수단 아이콘), Chief 지정 조작부 되돌리기(녹색 원형 시작·아이콘 일시정지·주행 중 지도 조작 유지·원형 순위 칩)가 main2 에 커밋됐다. 푸시·배포는 안 했다. 실행 중 하위 작업 없음. 완료된 검증은 새 변경 없이 반복하지 마라.

4. 이 인계는 푸시·배포·묶음 3 착수 승인이 아니다. Chief 의 새 지시와 피드백에 따라 이어가라. 화면 수정은 document/ops/20261023-ui-redesign/ 에 다음 번호(24~) 지시서 → Cursor CLI 구현 → 네 감리(캡처 직접 확인) → 결과 파일 「감리」 절 순서다. 실행자 호출·감리 명령·배포 절차·환경 함정은 document/reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md.

5. 지킬 것: 15-entry-flight-metrics.json·.out/·cdbox.bat 보존, restore/clean/stash/worktree/일괄 되돌리기 금지, localhost:3000 끄지 말 것, 5000 은 운영 Firebase 라 시험 데이터 쓰기 금지(데이터 시험은 에뮬레이터만), 게이트 기준선·시험 기대값 완화 금지(특히 「Chief 고정」 잠금 시험).

6. Chief 와는 한국어 존댓말, 「chief」 호칭, 결론부터 쉬운 말로. 확인을 부탁할 땐 실행 폴더 전체 경로·복사 가능한 명령·주소·새로고침 여부를 함께 적어라. 작업 단위가 끝날 때마다, 그리고 끊기기 전에 HANDOFF.md·PROGRESS.md·묶음 결과 파일을 갱신하라.

인수 대조가 끝나면 현재 상태와 다음 할 일을 짧게 보고하라.
```

# 인수자에게 입력할 첫 프롬프트

아래 본문을 새 채팅에 복사한다.

```text
C:\20.HDev\boxcycle의 다음 Supervisor로 인수하라.

먼저 AGENTS.md와 document/ops/HANDOFF.md를 읽고, document/ops/20261023-ui-redesign/13-handoff-next-supervisor.md 및 링크된 묶음1·2 감리/비교 자료를 확인하라. 담당자·인수 시각을 HANDOFF에 기록하고 git status/diff, HEAD, 서버 포트를 실제 상태와 대조한 뒤 한국어로 현재 상태와 다음 할 일을 보고하라.

현재 main2/5671a014이며 묶음1(MENU·경로 목록), 묶음2(대기·주행·일시정지), 로그인 환경 복구는 로컬 구현·감리·캡처 완료, 미커밋·미푸시·미배포다. 시안 승인을 구현 화면 승인으로 해석하지 말라. 구현 화면은 Chief 확인 대기이며 묶음3은 미착수다. 이번 인수 프롬프트만으로 커밋·푸시·배포·묶음3 착수가 승인된 것은 아니다. 새 Chief 지시/피드백이 있으면 그 범위에서 이어가라.

기존 dirty 증거 JSON·.out/·cdbox.bat과 모든 미커밋 작업을 보존하라. restore/clean/stash/일괄 stage를 하지 말라. localhost3000은 다른 프로젝트다. 정상 앱/로그인은 localhost5000(운영 Firebase), 5020/5021은 harness 프리뷰다. Google 계정 선택 화면 도달까지 확인했으며 최종 로그인 완료는 미확인이다. 데이터 시험은 에뮬레이터에서만 하라.

실행자 운용은 교대 플레이북을 따르라. OpenCode 무료 모델은 공통 한도 종료였고 Cursor 구현·Codex 감리로 완료했다. ego lite CLI bootstrap도 실패하여 Playwright로 검증했다. 도구의 현재 상태가 달라졌으면 재평가하되 동일 실패를 반복 대기하지 말라. 완료된 시험을 무조건 반복하지 말고, 새 변경이나 미해결 근거가 있을 때 필요한 검증을 실행하라. 작업 단위 종료/중단 전 HANDOFF·ops 결과·PROGRESS를 갱신하라.
```

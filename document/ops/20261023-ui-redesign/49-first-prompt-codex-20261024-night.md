# Codex 인수 첫 프롬프트 (2026-10-24 밤, Claude Code → Codex)

아래 본문을 Codex 새 대화에 그대로 붙여 넣는다.

```text
C:\20.HDev\boxcycle 의 다음 Supervisor 로 인수하라.

1. 읽는 순서: AGENTS.md → document/ops/HANDOFF.md → document/reference/product/261024-RTW-Chief-지정-디자인-고정.md(1~14). 고정 목록은 Chief 가 직접 정한 화면이며 시안·디자인 규칙·네 판단보다 우선한다. 지시서를 쓸 때 걸리는 항목을 「금지」에 옮기고, 감리에서 diff 가 목록 항목을 건드렸으면 다른 시험이 통과해도 FAIL. Chief 가 화면을 새로 직접 지시하면 끝낼 때 목록에 한 줄 더하라. 오늘 11~14가 더해지거나 바뀌었다(주행 중 주소창 접힘, 주소 카드 버튼·센서·접기 배치·폭, S·1·2·3·E 기호와 Start·+WP·End, 측면 메뉴 흰 반원 탭).

2. HANDOFF 「담당」을 Codex·인수 시각(KST)으로 고치고 실제 상태를 대조하라: HEAD = origin/main2(제품 코드 마지막 커밋 0b5b88ad, 그 뒤 HANDOFF 문서 커밋), git status(묶음3 미커밋분만 있어야 함), 보존 JSON document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json SHA256 4CAFA2A2…, 포트(3000·5000·5040 만 열림 — 이 앱 시험 서버는 모두 꺼서 넘긴다), 운영 https://boxcycle-dc2df.web.app 의 번들이 index-BX-8_B6d.js·index-qxhH-5Vd.css 인지. 다르면 그 차이부터 보고하라.

3. 현재 상태: 오늘 지시35~48 은 커밋·푸시·호스팅 배포까지 끝났다(Chief 가 배포 실행, 운영 SHA256 대조 PASS). 44~48 은 Chief 지시로 Supervisor 가 직접 구현했다 — Chief: 「외부 agent 가 구현해서 디자인과 동떨어졌다. 비슷한 상황이 또 생길 수 있으니 직접 하라」. 그래서 **디자인을 맞추는 화면 작업은 시안 먼저 → Chief 선택 → Supervisor 직접 구현**이 기본이다. 넓고 기계적인 작업만 실행자에게 넘겨라.

4. 남은 일(HANDOFF 「남은 일」):
   ① 묶음3(주행 결과·다음 주행)은 LOCAL_VERIFIED / Chief 화면 확인 대기, 미커밋이다(document/ops/20261023-ui-redesign/34-review-batch3-final.md). 묶음3은 오늘 주소 카드 변경 전에 만들어졌으니, Chief 에게 보여 주기 전에 오늘 변경 위에서 묶음3 화면 시험(ui-redesign-batch3*.spec.ts, ride-continuation 등)을 다시 돌려 충돌을 확인하라. 미커밋분을 되돌리거나 Chief 확인 없이 커밋·배포하지 마라.
   ② 실패 중인 시험 3건: e2e/ui-edge-live.spec.ts(10-21 기대값이 고정 목록 1·11·12와 어긋남 — 목록에 맞게 다시 쓰기), e2e/distance-direction-attention.spec.ts 29줄·e2e/route-ride-controls.spec.ts 20줄(묶음3 preview.tsx 미커밋 변경 영향 의심 — 묶음3 감리 때 확인). 기대값을 느슨하게 해서 통과시키지 말고, 고정 목록·Chief 지시 근거가 있을 때만 기대값을 바꿔라.
   ③ 그 밖의 일은 Chief 의 새 지시가 있을 때만.

5. 실행자: OpenCode 무료 모델(GLM·DeepSeek·Nemotron)은 한도가 다 찼다. Chief: 「cursor 를 활용해」. Cursor CLI 는 PowerShell 에서 이 문자열 그대로 `agent -p --force --trust --workspace C:\20.HDev\boxcycle "<지시>"`. Grok Bot 은 CLI 없는 데스크톱 앱이라 못 쓴다. 실행자에게 맡긴 결과는 실제 diff·캡처로 직접 감리하라(Cursor 가 CSS 를 0줄 고치고 PASS 라고 보고한 일, 증거를 엉뚱한 폴더에 저장한 일, 5020 을 켜 둔 채 껐다고 한 일이 오늘 있었다).

6. Chief 에게 보고할 때:
   - 한국어 존댓말, 「chief」 호칭, 결론부터 쉬운 말로.
   - **누가 작업했는지(구현·감리·캡처 각각, 예: Claude Code 직접 / Cursor CLI / Codex 직접)를 반드시 적어라**(Chief 10-24).
   - **링크를 주지 마라.** 마크다운 링크·file:/// ·평문 URL 모두 Chief 의 Windows Terminal 에서 열리지 않는다. 보여 줄 파일은 네가 직접 연다(PowerShell `Start-Process "<C:\ 부터 전체 경로>"`). 기록용으로 전체 경로는 함께 적는다. claude.ai 아티팩트(디자인 캔버스)는 Chief 가 그 창으로 보는 걸 좋아한다 — 네가 열 수 없으면 주소를 적고 Chief 와 여는 방법을 정하라.
   - 확인을 부탁할 땐 실행 폴더 전체 경로·복사 가능한 명령·주소·새로고침 여부를 함께 적어라.

7. 지킬 것: 15-entry-flight-metrics.json·.out/·cdbox.bat·묶음3 미커밋분 보존, restore/clean/stash/worktree/일괄 되돌리기 금지, localhost:3000 끄지 말 것, 5000 은 운영 Firebase 라 시험 데이터 쓰기 금지(데이터 시험은 에뮬레이터만), 게이트 기준선·시험 기대값 완화 금지(특히 「Chief 고정」 잠금 시험), 배포는 묶음3 을 뺀 커밋을 tmp/ 복제본에서 빌드해 Chief 가 실행(절차는 HANDOFF 「배포 방법」), 띄운 dev 서버는 시험 끝나면 끈다. 작업 단위가 끝날 때마다, 그리고 끊기기 전에 HANDOFF.md·PROGRESS.md·묶음 결과 파일을 갱신하라. 다음 지시서 번호는 50부터.

인수 대조가 끝나면 현재 상태와 다음 할 일을 짧게 보고하라.
```

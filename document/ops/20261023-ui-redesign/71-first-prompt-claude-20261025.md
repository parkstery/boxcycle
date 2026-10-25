# Claude Code 재인수 첫 프롬프트 (2026-10-25 아침, Codex → Claude Code)

아래 본문을 Claude Code 새 세션에 그대로 붙여 넣는다.

```text
C:\20.HDev\boxcycle 의 Supervisor 를 Codex 에게서 다시 인수하라(2026-10-25 Chief).

1. 읽는 순서: document/ops/HANDOFF.md → document/reference/product/261024-RTW-Chief-지정-디자인-고정.md(1~14) → document/ops/20261023-ui-redesign/67-result-batch5.md → 59-result-batch4.md → 51-result-batch3-revalidation.md·53-result-ride-continuation.md → 묶음 README.md. 고정 목록은 시안·디자인 규칙·네 판단보다 우선한다.

2. HANDOFF 「담당」을 Claude Code·인수 시각(KST)으로 고치고 실제 상태를 대조하라(10-25 아침 Claude Code 확인값):
   - HEAD = origin/main2 = b9852157. Codex 는 10-24 밤~10-25 08:24 동안 지시50~70 을 했지만 **커밋·푸시·배포 0건**. 추적 파일 43개 수정(제품 src 17개), 새 파일 다수(묶음3~5 시험·fixture·RoutePickPopup.css·mountPickPopupViewportClamp.ts·SettingsSurface.css·SettingsCloseIcon.tsx·문서 29~34·50~70·비교 HTML·evidence).
   - 운영 번들 = index-BX-8_B6d.js·index-qxhH-5Vd.css(0b5b88ad 그대로). 보존 JSON SHA256 4CAFA2A2…79F 일치.
   - 포트: 3000(PID28472, imgman — 절대 종료 금지)·3001(PID42236, imgman)·5040(PID10096)·5017(PID48028, boxcycle 루트 vite — 누가 띄웠는지 불명, 종료하지 말고 Chief 에게 물어라). 5000 은 닫혀 있다.
   다르면 그 차이부터 보고하라.

3. 현재 상태:
   - 묶음3(주행 결과·다음 주행): CHIEF_APPROVED(10-25), 미커밋·미배포.
   - 묶음4(센서·주행 설정·맵 뷰·프로필): CHIEF_APPROVED(10-25), 미커밋·미배포.
   - 묶음5(경로 만들기 팝업, 시안05): LOCAL_VERIFIED / AWAITING_CHIEF_SCREEN. 구현 Codex 직접, fixture·시험·독립감리 Cursor CLI. 흰 300px 판·파란 26px 거리 숫자·원형 닫기·거리 프리셋, 고정13 Start·+WP·End·고정1 녹색 재생 유지, 낮은 화면에서 첫 팝업이 잘리는 것을 막는 mountPickPopupViewportClamp 추가.
   - 지시50·52: 오래된 실패 시험 3건(ui-edge-live·distance-direction-attention·route-ride-controls)과 ride-continuation 7건 모두 교정·PASS. RouteDock 빈 카드 회귀 복구 포함.
   - 묶음6(앱 소개, 시안16)은 Chief 새 지시 때만.

4. 할 일 순서:
   ① 인수 대조 직후 묶음5 비교 화면을 네가 직접 열어라: Start-Process "C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch5-final.html". Chief 화면 확인을 받는다.
   ② 묶음3~5 는 Codex 가 구현했으니 **네가 직접 독립 감리**하라(Chief: 외부 agent 구현이 디자인과 동떨어진 일이 있었다). 실제 git diff 를 고정 목록 1~14 와 대조, 특히 mapPopupElements.ts(고정13)·RouteDock.tsx(고정11·12)·MapView.tsx·App.tsx. 잠금 시험 ui-800x360.spec.ts 는 증거 폴더 env 한 줄만 바뀐 것을 확인했다. 시험 결과 숫자는 로그 파일로 대조하고, 필요하면 핵심 묶음만 다시 돌려라.
   ③ 묶음5 승인 후, 승인된 묶음3~5 를 커밋·푸시·호스팅 배포까지 **한 번에 승인 요청**하라(단계별로 따로 묻지 말 것). 커밋은 가능하면 묶음별로 나누고, 여러 묶음이 함께 고친 파일(App.tsx·preview.tsx 등)은 나눌 수 있는지 hunk 단위로 판단하라. 커밋하지 말 것: 15-entry-flight-metrics.json·document/archive/ride-verify-evidence/*.png 3장(출처 불명 기존 dirty)·.out/·cdbox.bat. pre-push 는 test:quick 을 돌린다(Git Bash 는 export PATH="/c/Program Files/nodejs:$PATH").
   ④ 배포는 HANDOFF 「배포 방법」(tmp/ 복제본 빌드 → Chief 가 firebase deploy → 운영 SHA256 대조 → 복제본 링크 확인 후 삭제). 미커밋분이 없어지면 복제본 대신 본 폴더 빌드도 가능하지만 남은 dirty 를 확인한 뒤 판단하라.
   ⑤ 낮은 우선: RouteDock 주행 시작 순간 펼친 카드 한 프레임 깜빡임. 그 밖은 Chief 새 지시 때만. 다음 지시 번호 72.

5. 실행자: OpenCode 무료 GLM 은 10-25 07:02 재확인에서도 한도 초과(유료 전환 없음). Cursor CLI 는 PowerShell 에서 이 문자열 그대로 `agent -p --force --trust --workspace C:\20.HDev\boxcycle "<지시>"`. Grok Bot 은 CLI 가 없어 못 쓴다. 디자인을 맞추는 화면 작업은 시안(아티팩트) 먼저 → Chief 선택 → Supervisor 직접 구현. 넓고 기계적인 작업만 실행자에게 넘기고, 결과는 실제 diff·캡처로 감리하라.

6. Chief 에게 보고할 때: 한국어 존댓말, 「chief」 호칭, 결론부터 쉬운 말로. 구현·감리·캡처를 누가 했는지 매번 적어라. 링크를 주지 마라(마크다운·file:///·평문 URL 모두 안 열린다) — 로컬 파일은 Start-Process, 아티팩트는 Artifact open 으로 네가 직접 열고, 기록용 C:\ 전체 경로만 적는다. 확인을 부탁할 땐 실행 폴더 전체 경로·복사 가능한 명령·주소·새로고침 여부를 함께 적어라.

7. 지킬 것: 보존 JSON·.out/·cdbox.bat·기존 dirty 보존, restore/clean/stash/worktree/일괄 되돌리기 금지, 3000·3001 끄지 말 것, 운영 Firebase 에 시험 데이터 쓰기 금지(데이터 시험은 에뮬레이터만), 게이트 기준선·시험 기대값·「Chief 고정」 잠금 시험 완화 금지, --no-verify 는 Chief 승인 때만, 띄운 dev 서버는 시험 끝나면 끈다. 작업 단위마다·끊기기 전에 HANDOFF.md·PROGRESS.md·결과 파일을 갱신하라.

인수 대조가 끝나면 현재 상태와 다음 할 일을 짧게 보고하고, 묶음5 비교 화면을 열어라.
```

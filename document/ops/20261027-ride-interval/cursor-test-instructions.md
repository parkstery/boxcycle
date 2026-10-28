# Cursor 작업 지시 — 인터벌 기능 시험 마무리

Chief 최신 지시: 지금은 인터벌 기능 테스트 단계다. 운동 프리셋 5~10개, 고강도/저강도 시간과 반복 수 customizing은 테스트 후 미래 확장 방향이며 이번에 구현하지 않는다.

담당: 현재 인터벌 시험·결과 문서. 다른 작업자와 작업 트리를 공유한다. 기존 dirty·타인 변경·기존 증거를 되돌리거나 커밋/푸시/배포하지 않는다. Supervisor는 Codex이며 최종 감리는 Supervisor가 한다.

1. AGENTS.md, document/ops/HANDOFF.md, .agents/skills/ride-verify/SKILL.md를 읽는다. 현재 코드 변경은 App/useRideInterval/rideInterval/RideIntervalHud/설정 스위치 및 preview/e2e다. 이미 신규 인터벌 e2e6개 PASS, 타입/빌드 PASS, lint 오류0(기존 App 경고7), 진입 계약19 PASS. 승인 상단 중앙형 실제 캡처는 본 폴더 evidence/에 있다.
2. 기존 시험의 기본 증거 경로 실수로 inline-history PNG5장 재생성. Supervisor가 recovery-git-matches.json 원본 blob/SHA256 기준으로 복구한다. 이 파일들 및 기존 증거는 다시 쓰지 않는다. 모든 Playwright 실행 전 UI_REVALIDATION_EVIDENCE_DIR, ENTRY_CARD_HISTORY_EVIDENCE, BATCH2_EVIDENCE_DIR, BATCH4_EVIDENCE_DIR, INTERVAL_EVIDENCE_DIR를 이번 폴더 evidence의 각각 새 하위 폴더로 지정한다.
3. 현재 dev 서버는 Supervisor 소유 5027, 기존 서버/다른 포트 종료 금지. RTW_DEV_PORT=5027로 재사용한다. 필요시 서버 상태 확인. 신규 ride-interval.spec.ts와 ui-redesign-batch4.spec.ts를 실행한다. 설정 스위치 추가에 따라 batch4 count는 5로 갱신되어 있으니 확인한다. 신규 시험 제목은 주행 중 재설정까지 검사한다고 되어 있지만 실제로는 기본 선택/시작만 검사하므로, 기존 메뉴(주행 설정)를 통해 주행 중 끄기/다시 켜기→준비부터 재시작도 검증하라. 가능하면 종료→새 주행 준비 초기화도 검사. fixture 필요 변경은 최소로 한다. 기능 버그 발견 시 좁게 수정하고 알린다.
4. ui-800x360 첫 실행 23개 중 3개 실패: (a) 주행 시작 원44px 측정에서 펄스 도중46.7px (b) 결과 story-detail 기대11px/실제10px: Chief 지시92 이후 기존 CSS는10px, 이번 코드에서 미수정 (c) 이전 증거 캡처경로 쓰기 실패. 실패(a)(c)는 올바른 새 증거 경로로 재실행해 확인하고, (b)는 기존 HEAD 소스와 비교해 이번 변경과 무관함을 증거로 기록하라. 기대값 완화/다른 기능 수정 금지. 실패(a)가 애니메이션 경쟁이면 기존 assertion을 바꾸지 말고 재현/결과를 보고한다.
5. quick 전체 결과 1384 PASS/3 FAIL이며 모두 scripts/e2e/e2e-deadline-watchdog.test.mjs의 Windows taskkill/tasklist 권한 관련이다. 동일 도구 파일만 재실행해 결과 기록. 권한 없이 통과 불가하면 숨기거나 기준완화하지 말고 해당 제한 보고. 전체 quick 반복 불필요.
6. `npx tsc -b --noEmit`, 변경 파일 ESLint, 루트 `npm run check:dep`, `git diff --check` 등 필요한 최종 검사. 제품 수정 없으면 이미 통과한 빌드 재실행 불필요. 로그는 이번 폴더 evidence 안에 저장. 시험 파일 편집 후 새 관련시험만 재실행한다.
7. 이 작업 폴더 README.md에 구현 범위/사용 흐름/시험 명령·PASS/FAIL·제한·실행폴더·후속확장 보류를 기록한다. HANDOFF/디자인고정목록은 Supervisor 담당이니 수정하지 않는다. 미래 확장 구현 금지. 완료 후 변경파일·시험수·미해결결과·서버상태를 짧게 보고한다.

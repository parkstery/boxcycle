# TASK-02 — visibility 복귀 read fanout 재현·계측

Owner: Cursor CLI Developer. Supervisor: Codex. [03 검수](03-review-root-cause-audit.md)를 읽고 수행하라.

## 목적

Trailhead idle 화면에서 hidden→visible 반복이 만드는 Firestore operation proxy를 결정적으로 재현해, 구현 전 baseline을 만든다. 이 단계에서는 사용자 동작을 바꾸는 최적화는 하지 않는다.

## 허용 범위

- `apps/web/src/lib/debug/`의 DEV-only 계측 확장 또는 새 파일.
- 필요한 최소 호출 지점의 계측 배선. production 빌드에서는 no-op이어야 하고 네트워크 의미를 바꾸지 않는다.
- `apps/web/scripts/focus-read-spike/` 아래 순수/계약 테스트·하네스.
- 필요하면 `apps/web/e2e/focus-read-spike.spec.ts`와 `apps/web/package.json`의 focused script.
- 본 결과 `05-result-visibility-meter.md`와 이 묶음 상태 문서.

제품 데이터 모델·Rules·Functions·RTDB schema·기존 listener enable 정책·poll 주기·catalog 캐시 의미는 변경 금지. production Firebase 접속·write·deploy·commit·push 금지.

## 필수 계수

baseline visible settle 후 hidden→visible 10회를 시뮬레이션하고 다음을 경로별 delta로 남겨라.

- underlying Firestore listener open/close: listing, collection-group, Trail members, per-Trail live rides, users, economy, conquest.
- one-shot calls: Activity World summary/global/live IDs/batch, published catalog publications/labels, route geometry gap-fill 가능 시.
- Trail presence writes는 별도 proxy로 계수하되 read와 합치지 않는다.
- 각 delta가 앱 코드 재구독인지, 유지 리스너인지, SDK 동작 미계측인지 분류한다.

## 재현 요구

1. 가능한 최우선은 기존 Firebase Emulator + 단일 worker Playwright이며 5분 무진전 규칙을 지킨다.
2. 실제 브라우저 visibility 전환이 headless에서 결정적으로 안 되면, `useDocumentVisibility`에 DEV/test-only override seam을 최소 추가할 수 있다. 기본 production 경로와 값은 바뀌면 안 된다.
3. E2E가 환경 때문에 불가능하면 순수 lifecycle harness로 전환하되, 무엇을 실제로 검증하고 무엇을 추론했는지 구분한다.
4. 기존 `__rtwReadSubs` 계수와 hub refcount 테스트를 재사용하고, 중복 계측으로 실제 호출을 두 번 만들지 않는다.

## 완료 조건

- 동일 시나리오를 반복 실행해 같은 operation delta가 나온다.
- `hidden→visible 0회` 대조군과 10회 시나리오를 비교한다.
- focused tests PASS, 변경 파일 lint PASS, TypeScript/build 가능한 범위 PASS.
- baseline 표에서 가장 큰 앱 제어 가능 항목 1~3개를 확정한다.
- 다음 최소 수정안은 제안만 하고 구현하지 않는다.
- 결과 문서에 정확한 명령, PASS/FAIL/SKIP, 파일, 수치, 한계가 있다.

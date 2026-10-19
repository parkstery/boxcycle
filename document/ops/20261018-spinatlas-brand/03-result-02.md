# 결과02 — 소개 제목 셀렉터 계약과 조사 띄어쓰기

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 재작업 결과 |
| 작성 | 2026-10-18 |
| 상태 | DEVELOPMENT_DONE — 셀렉터 계약 19단계 통과 |
| 독자 | Chief · Supervisor |
| 담당 | OpenCode 별도 세션 / LongCat 2.5 Preview Free (`opencode/longcat-2.5-preview-free`) |
| 연결 문서 | [지시01](02-task-01.md) · [재지시02](02-task-02.md) · [결과01](03-result-01.md) |

## 실패 원인 정정

[결과01](03-result-01.md)에서 `verify-selectors.mjs` 실패를 기존 위치 진입 작업과 연결해 보고했다. **Supervisor 독립 검증으로 정정한다.** 실패는 기존 위치 변경 탓이 아니라 **이번 카피 변경으로 생긴 검증 계약 불일치**다.

- 실패 단계: `app-intro`
- 실패 앵커: `{ name: "소개 제목", re: /달린 길이,/ }`
- 원인: 지시01에서 제목을 `달린 길이, 내 도로망이 됩니다.` → `땀으로 그리는, / 나만의 지구 지도.`로 변경하면서, `entry-contract.mjs`의 앵커가 옛 제목을 가리키게 되었다. 즉 **UI 변경에 계약 미갱신**이다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `apps/web/scripts/ride-verify/entry-contract.mjs` | 소개 제목 앵커만 수정: `/달린 길이,/` → `/땀으로 그리는,/`. 검사 로직·다른 단계·셀렉터 문자열 유지. |
| `apps/web/src/components/RotateOverlay.tsx` | `Spinatlas 는` → `Spinatlas는` (자연스러운 조사 띄어쓰기). |

기존 위치 관련 미커밋 변경 보존. 실패 검사 삭제·약화 없음.

## e2e spec 확인 사실

`apps/web/e2e/ride-entry.spec.ts` 및 관련 spec/helper에서 옛 제목(`달린 길이`, `내 도로망이 됩니다`, `실제 지구의 도로를 달려보세요`, `RIDE THE WORLD`) 기대를 검색했다.

- **옛 제목 기대 없음** — 수정하지 않음.
- `ride-result-claim1-preview.test.ts`의 `이번에 달린 길이 내 도로망에 더해졌어요`는 주행 결과 메시지로 이번 인트로 카피와 무관.
- `rideSessionPreview.ts`의 동일 문구도 결과 메시지로 무관.
- `AppIntroScreen.tsx`의 `달린 길이 내 지도에 남습니다`는 이번 새 부제의 일부.

## 검증 명령·종료 코드

PowerShell, `Set-Location 'C:\20.HDev\boxcycle'` 후 실행:

| 명령 | 종료 코드 | 결과 |
|---|---|---|
| `node apps/web/scripts/ride-verify/verify-selectors.mjs` | 0 (PASS) | **19단계 전부 유효**. `app-intro` 포함 전 단계 `✓`. |
| `npx eslint apps/web/scripts/ride-verify/entry-contract.mjs apps/web/src/components/RotateOverlay.tsx` | 0 (PASS) | 수정 파일 린트 통과. |
| `git diff --check` | 0 (PASS) | LF→CRLF 경고만(기존 파일 포함), whitespace 오류 없음. |
| `node scripts/check-document-system.mjs` | 0 (PASS) | 225파일, 깨진 링크 0, 구조 오류 0. |

## 검증 한계

- 이번 수정은 셀렉터 앵커 정규식과 문자열 띄어쓰기만으로 **실행 동작을 바꾸지 않음**. 이미 통과한 build·전체 화면(Supervisor 4뷰포트·CTA 콜백·HUD 4상태)을 반복하지 않음.
- 전체 `npm run lint`는 [결과01](03-result-01.md)대로 기존 ride-result 시험 4파일 에러로 실패하나, 이번 변경 범위 외이며 반복 실행하지 않음.
- e2e(`ride-entry.spec.ts`) 미실행 — Firebase 에뮬레이터 미기동. 셀렉터 계약 정적 검증으로 대체.
- 실기기 미검증.

## 커밋·push·배포

커밋·push·배포 없음. ops 공용 색인·Supervisor 검수 파일 수정 없음.

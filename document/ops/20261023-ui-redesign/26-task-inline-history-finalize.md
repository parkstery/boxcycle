# 지시 26 — 인라인 주행 기록 확정·비교용 연결 정리

2026-10-24 Chief: 「주행 기록은 현재의 인라인 스타일을 유지하라. … 품질 낮은 UI, UX의 퀄리티를 높이는 … 관점에서 … 다음 작업 계속해.」

Supervisor Codex / Developer Cursor CLI. 지시 24 A(첫 라이딩 카드 삭제)는 보존한다. B의 panel 비교안은 채택하지 않는다. 결과: `27-result-inline-history-finalize.md`.

## 목표·소유 범위

- `UserInfoSheet.tsx/.css`의 panel 분기·전용 상태·프리뷰 props·전용 CSS를 제거하고 기존 인라인 펼침 목록으로 고정. 기존 통계·지도 보기·이어 달리기·여기서 새 경로·Escape 동작 보존. 새 UI를 발명하지 않는다.
- `lib/account/accountHistoryMode.ts` 비교 플래그와 dep-layers 등록 제거. 기존 미사용 `RideHistoryPanel` 자체는 이번에 일괄 삭제하지 말고 지시24에서 추가한 previewSessions 변경만 제거한다.
- 프리뷰에서 panel 전용 경로·props 제거. historyPreview 메모리 예시 목록은 인라인 검수에 재사용하고 세 건 모두 recentSessions로 전달. 운영 Firebase 쓰기 금지.
- `ui-800x360.spec.ts`의 새 panel 열림 시험을 Chief 고정10 인라인 펼침/접힘·계정 통계 유지·전용 판 없음 시험으로 교체. 기존 잠금시험1~4 및 다른 시험 기대값은 바꾸지 않는다. 667×300·800×360 캡처 `evidence/inline-history/final-inline-{size}.png`에 남긴다. 카드 없는 첫방문 캡처도 보존.
- 삭제된 `guest-demo-ready-ride.spec.ts`를 가리키는 전용 config·dev-tools 항목을 참조 검색 후 정리. 관련 없는 도구는 보존. 기준선 완화 금지.

## 금지 — Chief 고정 목록

1 녹색 원형 재생, 글자 없음 / 2 일시정지 아이콘 조작 / 3 주행·일시정지 중 지도 스타일·줌 표시 / 4 순위 원형 그래프 아이콘 / 5 경로당 한 줄·이동수단 아이콘 / 6 경로 목록 흰 불투명 판 / 7 지도 정보 바탕 없는 윤곽선 글자 / 8 소문자 km / 9 야외·위성 둘만 / 10 주행 기록은 계정 패널 안 인라인 펼침.

지시24 변경을 포함해 다른 작업자가 함께 쓰는 작업 트리다. 다른 변경을 되돌리지 않는다. git restore/checkout/clean/stash/worktree/commit/push 금지. 보존 JSON·`.out/`·`cdbox.bat` 금지. 3000·기존 5000·5040 서버 종료 금지. functions·인증·주행·데이터 정책 변경 금지.

## 검증·결과

`C:\20.HDev\boxcycle\apps\web`: `npx tsc -b --noEmit`, 변경파일 eslint, `node scripts/ride-verify/verify-selectors.mjs` 실행. 전체 quick·화면·실앱 시험은 Supervisor가 최종 트리에서 순차 실행한다. 서버를 띄우지 말고 캡처 경로가 동작하도록 spec을 구성한다. 결과에 변경파일·검증명령·통과/실패·미실행을 기록. HANDOFF/PROGRESS/Chief고정/결정로그는 Supervisor 소유, 수정하지 않는다.

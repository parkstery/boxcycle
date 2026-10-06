# 검수 02 — 공개 클릭 시 내 경로 닫기 · 취소 시 복귀

- Supervisor: Claude · 판정: **APPROVED (코드)** — 실기 확인은 Chief
- 근거: `git diff` App.tsx / PublicRouteRequestModal.tsx / RideRoutePanel.tsx / SavedRoutesModal.tsx 직접 확인

| 항목 | 판정 |
|---|---|
| 공개 → `panel.onOpenPublicRequest(route); onClose()`, prop 없으면 undefined 유지 | PASS |
| 취소 버튼·오버레이 → `onCancel ?? onClose`, 성공 경로는 `onClose` 그대로 | PASS |
| `reopenSavedSignal` 신설, `openSavedTabSignal`(대기 필터 강제) 재사용 안 함 | PASS |
| 이전값 비교 패턴(effect 없음) — 기존 코드 관례와 일치 | PASS |
| 허용 파일 밖 수정 없음 · tsc 0 · eslint 증가 0 · menu-a 1 passed | PASS (결과 보고 기준) |

- 촬영 생략(로그인+완주 경로 재현 불가) — 지시 허용 범위. Chief 실기 확인으로 대체.
- 참고: 등록 창에는 Esc/✕ 가 원래 없다(추가 안 함 — 범위 밖).

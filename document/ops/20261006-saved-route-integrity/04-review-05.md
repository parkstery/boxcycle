# 검수 05 — 고른 미완주 경로로 이어달리기 대상 교체

- Supervisor: Claude · 판정: **APPROVED**

| 항목 | 판정 | 근거 |
|---|---|---|
| 미완주 「이어 달리기」 → 대상 교체 후 RouteDock 「30% 지점부터 이어달리기」 | PASS | 캡처 03 |
| 활성 대상 카드 「이어달리기 중」 배지 | PASS | 캡처 04 |
| 교체 = 해제 성공 후 확보, 실패 시 로드 안 함·안내 | PASS | 결과 05 · `switchTo` |
| ad-hoc 저장은 빈 슬롯일 때만 확보 | PASS | `resolveAdhocSaveSlotAcquireAction` 단위 |
| tsc 0 · eslint 증가 0 · 단위 8/8 · menu-a pass | PASS | 결과 05 |
| `ride-continuation` 실패 | **기존 결함** | 헬퍼 `getByRole('button',{name:'열기'}).first()` 가 RouteDock 「센서 설정 열기」(cbfb0bf, 오늘 이전)에 부분 일치. 수정 전 재실행도 동일 실패 |
| `ride-continue-phase-c` 실패(Token 잔액 null) | 무관 | 온보딩 경로, 이번 변경 미접촉 |

## 후속 (범위 밖)
1. e2e 헬퍼 `열기` → `exact: true` 또는 모달 범위로 한정.
2. 대상 확보 시 서버는 `expiresAt=null` 로 TTL 을 지우지만(`firestoreRideResumeSlot.ts`) 로컬 목록이 갱신되지 않아 새로고침 전까지 「D-n」 이 남는다(캡처 04 「미완주 · D-1」). 기존 `ensureAcquired` 경로와 같은 동작 — 표시만 낡음, 데이터는 정상.

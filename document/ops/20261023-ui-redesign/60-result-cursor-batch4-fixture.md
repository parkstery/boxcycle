# 결과60 — Cursor 묶음4 fixture·시험 (지시58)

2026-10-25 06:40 KST · **Cursor CLI** · Codex 제품 구현과 분리.

## 변경 파일 (소유 범위만)

| 파일 | 내용 |
|---|---|
| `apps/web/scripts/ui-800x360/preview.tsx` | 묶음3·기존 state 유지. batch4 `profile*` / `sensor*` / `settings` / `map` fixture, `#batch4-fixture` data 속성, `ProfileEditSheet` mock User, 설정 4 switch·`onEditProfile`, `RideSettingsSheet` calorie 읽기 전용·setter 제거, 센서·맵 콜백 메모리 |
| `apps/web/e2e/ui-redesign-batch4.spec.ts` | 신규 — 3 뷰포트×4 패널 경계·글자, 센서/프로필/설정/맵·고정9·주행 자동 시작 없음 |
| `document/ops/20261023-ui-redesign/60-result-cursor-batch4-fixture.md` | 본 결과 |

## fixture state (`?state=`)

| state | 용도 |
|---|---|
| `profile` | 회원, 체중 64·`moderate`, 저장 콜백 관측 |
| `profile-guest` | 게스트 닉네임 불가 |
| `profile-locked` | 닉네임 30일 잠금 |
| `sensor` | 상호작용(연결→connecting, 센서 없음, 속도) |
| `sensor-connected` | 82 rpm, cadence-ready |
| `sensor-disconnected` | 단절·재연결 CTA |
| `sensor-riding-manual` | 주행+수동, 최초 센서 연결 버튼 없음 |
| `sensor-unsupported` | BLE 미지원 |
| `settings` | switch 4·칼로리 요약·프로필 수정 진입 |
| `map` | 맵 콜백; `&riding` 시 주행 카메라 거리 슬라이더 |

캡처: `BATCH4_EVIDENCE_DIR` 설정 시에만 PNG 저장.

## 검증 (미실행 — Codex 최종 실행)

| 항목 | 상태 |
|---|---|
| `npx playwright test ui-redesign-batch4` | **미실행** (지시58) |
| `npm run test:quick` / `tsc` / eslint | **미실행** |
| 제품 TSX/CSS | **미수정** |
| 기존 e2e | **미수정** |
| 커밋·푸시·서버 | **없음** |

## 정적 확인

- `preview.tsx`: 묶음3 `nextride-*`·`glance-*` 블록 diff 없음(구조만 panel 해석·batch4 분기 추가).
- `RideSettingsSheet`에 `onCalorieWeightKg` / `onCalorieIntensityId` 미전달(현재 제품 타입 optional과 일치).
- aria 계약: `케이던스 센서`, `센서 없음`, `센서 설정 닫기`, `속도 km/h` 시험에 명시.

## 다음

Codex: 제품 시트 12~15·`App` 결선 후 Playwright·타입·기존 잠금 시험 실행. 캡처는 `document/ops/20261023-ui-redesign/evidence/instruction58/` 등 지시 경로.

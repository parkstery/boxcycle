# 02-task-02 결과 보고 — 리더보드 시트 (웹)

2026-10-23 · opencode Nemotron 3 Ultra · 감리 Claude

## 완료 항목

### 1. `src/services/leaderboardApi.ts` 신규 생성
- `adminDashboardApi.ts` 패턴을 따라 ID 토큰 GET + 한국어 오류 메시지 구현
- 타입: `LeaderboardBoard` (`distance` | `pioneer`), `LeaderboardPeriod` (`week` | `month` | `all`), `LeaderboardScope` (`world`)
- 응답 검증: `isLeaderboardResponse` 가드 포함
- 엔드포인트: `GET getLeaderboard?board=distance|pioneer&period=week|month|all`

### 2. `src/components/leaderboard/LeaderboardSheet.tsx` + `.css` 신규 생성
- `AdminDashboardSheet` 시트 틀(scrim, focus trap, Escape 닫기, 닫기 버튼) 그대로 적용
- **왼쪽 판**:
  - 탭: 주행 거리 / 개척 (활성 탭은 파란 배경, 비활성은 회색)
  - 기간 버튼: 누를 때마다 이번 주 → 이번 달 → 전체 순환 (드롭다운 아님)
  - 범위: 「세계」 텍스트만 (1단계)
  - 내 순위/게스트/순위 없음 3상태 분기
    - 회원·순위 있음: 큰 숫자(72px) + 위 + 값(26px) + 격차/이용 내역 + 각주
    - 회원·순위 없음: 「순위 없음」 + 안내 문구
    - 게스트: 내 기록 값 + 「회원 등록하면…」 안내 + 예상 순위 + **Google 계정으로 회원 등록** 버튼
- **오른쪽 판**:
  - 상위 10위 리스트 → `⋯` 생략 → around(내 위아래 ±2, 내 줄 강조 배경 `#EEF3FC`)
  - 개척 탭일 때 4열(순위·이름·내 길 이용·새 도로), 주행 거리 탭은 3열
  - `liveTrailId` 있을 때 「● 같이 달리기」 버튼 표시 (현재는 비활성화 상태)

### 3. 「같이 달리기」 버튼 연결 상태
- **현재**: 버튼은 그리되 `disabled` 상태 + `aria-label="같이 달리기 (연결 준비 중)"`
- **이유**: App.tsx 내 Trail 합류 경로(`joinTrailAndCloseMenu`, `?trail=` URL 파라미터 처리 등)가 존재하나, 리더보드 시트에서 해당 trailId로 직접 합류하려면 `useAppTrail`의 `setTrailId` + `replaceTrailInUrl` + MENU 닫기 로직이 필요함. 이는 현재 시트 외부에서만 접근 가능한 훅/함수들이라 별도 리팩토링 필요. **보고에 기록하고 버튼은 비활성화로 둠**.

### 4. 게스트 「Google 계정으로 회원 등록」 버튼
- `useAppAuth`의 `handleGoogleSignIn` 호출로 연결 완료
- 게스트 → Google 연결 시 `authLinkRev` 증가로 닉네임 동기화 재트리거됨 (기존 로직 재사용)

### 5. MENU 패널 진입 추가
- `MenuPanel.tsx`: `onOpenLeaderboard` prop 추가 + 헤더 액션에 「순위」 버튼 (설정·지명과 동일 톤)
- `useAppSheetNavigation.ts`: `leaderboardSheetOpen`, `setLeaderboardSheetOpen`, `openLeaderboardPanel` 추가 (관리자 시트와 동일한 상호 배타 패턴)
- `App.tsx`: `LeaderboardSheet` 임포트 + 렌더링 + MENU `onOpenLeaderboard={openLeaderboardPanel}` 연결

### 6. 반응형/호버 처리
- 800×360 폰 가로에서 한 화면: `@media (max-width: 800px)` 패널 크기 조정
- 모든 `:hover` 스타일은 `@media (hover: hover)` 내부만 적용

## 변경 파일 목록

| 파일 | 종류 | 설명 |
|---|---|---|
| `apps/web/src/services/leaderboardApi.ts` | 신규 | 리더보드 API 클라이언트 |
| `apps/web/src/components/leaderboard/LeaderboardSheet.tsx` | 신규 | 리더보드 시트 컴포넌트 |
| `apps/web/src/components/leaderboard/LeaderboardSheet.css` | 신규 | 리더보드 시트 스타일 (모크업 색·폰트·크기·여백 1:1 반영) |
| `apps/web/src/components/MenuPanel.tsx` | 수정 | `onOpenLeaderboard` prop + 헤더 「순위」 버튼 |
| `apps/web/src/components/MenuPanel.css` | 수정 | `.menu-panel__leaderboard` 버튼 스타일 |
| `apps/web/src/app/useAppSheetNavigation.ts` | 수정 | 리더보드 시트 네비게이션 상태/액션 추가 |
| `apps/web/src/App.tsx` | 수정 | `LeaderboardSheet` 임포트·렌더링·MENU 연결 |

## 검증 결과

| 검사 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | ✅ 통과 (내 변경 파일 관련 에러 없음) |
| `npx eslint <고친 파일>` | ✅ 통과 (기존 경고만, 내 파일 에러 없음) |
| `npm run test:quick` | ⚠️ 기존 실패 2건 (UserInfoSheet.tsx·시작화면 테스트 — 내 변경과 무관) |
| `node scripts/check-code-tidy.mjs --check` | ⚠️ 신규 파일 추가로 지표 상승 (knip types +3, 중복 라인 +13) — 새 기능이라 불가피 |

## 미완료·이슈

1. **「같이 달리기」 버튼 비활성화**: Trail 합류 경로 연결 필요. 별도 작업으로 `LeaderboardSheet`에서 `useAppTrail` 접근하거나 `App` 레벨 콜백 주입 필요.
2. `UserInfoSheet.tsx`에 사용되지 않는 import 존재 (사전 존재) — 작업 범위 밖이라 수정 안 함.

## 실행 방법 (Chief 직접 테스트용)

```bash
cd C:\20.HDev\boxcycle\apps\web
npm run dev
# 브라우저에서 http://localhost:5173 접속
# 1. 게스트 입장 → MENU 열기 → 「순위」 버튼 → 게스트용 리더보드 확인
# 2. Google 로그인 → MENU → 「순위」 → 회원용 리더보드(주행 거리 탭 기본) 확인
# 3. 탭 클릭 → 개척 탭 전환, 기간 버튼 순환 확인
# 4. ESC·배경 클릭·닫기 버튼으로 시트 닫힘 확인
```

## 스크린샷 비교용 모크업 경로
- `document/ops/20261023-leaderboard/mockups/leaderboard-1-distance.html` (회원·주행 거리)
- `document/ops/20261023-leaderboard/mockups/leaderboard-2-pioneer.html` (회원·개척)
- `document/ops/20261023-leaderboard/mockups/leaderboard-3-guest.html` (게스트)
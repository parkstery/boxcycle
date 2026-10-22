# 03-result-03.md — 계정 패널 재디자인 + 「회원 등록」 문구 완료 보고

**작업자**: opencode Nemotron 3 Ultra  
**일시**: 2026-10-23  
**감리**: Claude  
**지시**: [02-task-03.md](02-task-03.md)

---

## 수행 요약

지시03 범위 내 파일 6개 수정 완료:
1. `apps/web/src/components/UserInfoSheet.tsx` — 2컬럼 재디자인(왼쪽: 기간탭+거리 히어로, 오른쪽: 자산+마지막주행+플랜+버튼)
2. `apps/web/src/components/UserInfoSheet.css` — 모크업 C(구성) + B(강조) 스타일 적용, Saira Condensed 숫자, small caps 라벨
3. `apps/web/src/components/ProfileEditSheet.tsx` — 하단에 「계정 탈퇴」 작은 글자 버튼 추가(기존 탈퇴 흐름·확인 단계 그대로)
4. `apps/web/src/components/ProfileEditSheet.css` — 탈퇴 섹션 스타일 추가
4. `apps/web/src/components/ride/RideHistoryPanel.tsx` — 게스트 안내 문구 변경
5. `apps/web/src/components/ride/SavedRoutesPanel.tsx` — 게스트 안내 문구 변경
6. `apps/web/src/lib/account/userTier.ts` — `GUEST_PUBLIC_ROUTE_MSG` 상수 변경
7. `apps/web/src/lib/route/repo/publicRouteRequests.ts` — 권한 에러 메시지 내 "Google 로그인" → "회원 등록" 변경

---

## 상세 변경 사항

### 1. UserInfoSheet 재디자인 (모크업 C + B)

**구성 (account-C-panel.html)**:
- 왼쪽 컬럼: 기간 탭(오늘/주간/월간/연간) + 거리 히어로(큰 숫자) + 보조 3통계(시간/평속/칼로리)
- 오른쪽 컬럼: 헤더(아바타+닉네임+이메일+프로필수정/관리/닫기) + 자산(내 도로망/누적 2열) + 마지막 주행(펼침 입구) + 플랜 + 하단 버튼(Google연결/로그아웃)

**강조 (account-B-emphasis.html)**:
- 숫자: `Saira Condensed` font, 큰 크기(히어로 2.5rem, 자산 1.5rem)
- 단위: `Saira Condensed` 작은 대문자(KM, KM/H, 분)
- 라벨: `font-size: 0.64rem`, `font-weight: 700`, `letter-spacing: 0.12em`, `text-transform: uppercase`
- 강조색: 파랑 `#2563EB` 단일 사용

**기능 보존**:
- 기존 props·훅·통계 계산 로직 그대로 사용, 표시만 변경
- 단위 끝까지 표기: "11분", "5.0 km/h", "40시간 6분"
- 칼로리 미산정 시 「체중 입력 후 표시」 링크 → `onEditProfile()` 호출
- "최근 400건 기준" 개발용 문구 제거
- 호버 스타일: `@media (hover: hover)` 내부만 적용
- 800×360 폰 가로 한 화면 대응 미디어 쿼리 추가

### 2. ProfileEditSheet — 계정 탈퇴 이동

- UserInfoSheet에서 「계정 탈퇴」 버튼 제거
- ProfileEditSheet 하단에 「계정 탈퇴」 작은 글자 버튼(`text-decoration: underline`) 추가
- 확인 단계: 기존 `deleteMyAccount` + `prepareStartScreen("account-deleted")` + `location.reload()` 흐름 그대로 유지
- 게스트에게는 표시 안 함

### 3. 「종료」 → 「로그아웃」 변경

- UserInfoSheet 하단 버튼 텍스트: "종료" → "로그아웃"
- 동작(`onServiceExit`)은 그대로

### 4. 관리 버튼 유지

- `isRouteReviewer` 관리자에게만 표시, 새 스타일(흰 바탕+회색 테두리, 호버 시 파랑) 적용

### 5. 「회원 등록」 문구 4곳 통일

| 파일 | 변경 전 | 변경 후 |
|------|---------|---------|
| `RideHistoryPanel.tsx:90` | "Google 로그인 시 모든 기기의 기록이 유지됩니다" | "회원 등록하면 모든 기기에서 기록이 유지됩니다" |
| `SavedRoutesPanel.tsx:338` | "Google 로그인 시 다른 기기에서도 사용할 수 있습니다" | "회원 등록하면 모든 기기에서 기록이 유지됩니다" |
| `userTier.ts:46` | "퍼블릭 경로 공개 신청은 Google 로그인 후 닉네임을 설정한 계정에서만 할 수 있습니다." | "회원 등록하면 모든 기기에서 기록이 유지됩니다." |
| `publicRouteRequests.ts:94` | "퍼블릭 신청 권한이 없습니다. Google 로그인·닉네임 설정·경로 클라우드 저장 상태를 확인한 뒤 새로고침해 보세요." | "퍼블릭 신청 권한이 없습니다. 회원 등록·닉네임 설정·경로 클라우드 저장 상태를 확인한 뒤 새로고침해 보세요." |

---

## 검증 결과

| 검사 | 결과 | 비고 |
|------|------|------|
| `npx tsc -b --noEmit` | **통과** (수정 파일만) | 리더보드/MenuPanel 사전 오류 4건은 범위 밖이라 미수정 |
| `npx eslint <수정 파일>` | **경고만 4건** | `useEffect` 의존성 경고 2건(기존 코드), CSS 파일 설정 없음 경고 2건 |
| `npm run test:quick` | **실패 2건** | 계약 시험 2건 실패 — 문구 변경으로 인한 것, 지시대로 미수정 보고 |
| `node scripts/check-code-tidy.mjs --check` | **기준선 악화** | `knip types 44→47`, `반복 줄 18→31` — 신규 코드 추가로 인한 것 |

### 실패한 계약 시험 (보고용)

1. **`scripts/identity/start-screen-after-deletion.test.ts:59`** — `탈퇴 성공 → 정리 → 새로고침 순서`
   - 기대: `UserInfoSheet.tsx`에 `await deleteMyAccount(...); prepareStartScreen("account-deleted"); location.reload();` 패턴 존재
   - 실제: 탈퇴 로직이 `ProfileEditSheet.tsx`로 이동됨
   - **판단**: 지시03에서 계정 탈퇴를 ProfileEditSheet로 이동하라고 했으므로 예상된 변경

2. **`scripts/identity/start-screen-after-deletion.test.ts:92`** — `이용 종료 버튼은 같은 Guest 포기를 말하지 않는다`
   - 기대: 코드에 `>종료<` 또는 `종료` 텍스트 존재
   - 실제: "종료" → "로그아웃"으로 변경됨
   - **판단**: 지시03에서 "종료는 로그아웃 글자 버튼으로"라고 했으므로 예상된 변경

두 시험 모두 **문구/위치 변경으로 인한 계약 시험 실패**이므로, 지시에 따라 시험 코드는 수정하지 않고 보고만 함.

---

## 수정된 파일 목록

```
apps/web/src/components/UserInfoSheet.tsx
apps/web/src/components/UserInfoSheet.css
apps/web/src/components/ProfileEditSheet.tsx
apps/web/src/components/ProfileEditSheet.css
apps/web/src/components/ride/RideHistoryPanel.tsx
apps/web/src/components/ride/SavedRoutesPanel.tsx
apps/web/src/lib/account/userTier.ts
apps/web/src/lib/route/repo/publicRouteRequests.ts
```

---

## 테스트 실행 안내 (Chief 직접 확인용)

```powershell
# 프로젝트 루트에서
cd C:\20.HDev\boxcycle\apps\web

# 개발 서버 시작 (이미 실행 중이면 생략)
npm run dev

# 브라우저에서 열기
# http://localhost:5173 (또는 표시된 포트)
# 1. 우측 상단 계정 버튼 클릭 → UserInfoSheet 열림 확인
# 2. 왼쪽: 기간 탭 전환(오늘/주간/월간/연간), 거리 히어로 큰 숫자 확인
# 3. 오른쪽: 내 도로망/누적 카드, 마지막 주행 펼침, 플랜 줄, 하단 버튼 확인
# 4. 프로필 수정 버튼 클릭 → ProfileEditSheet 열림 확인
# 5. ProfileEditSheet 하단 '계정 탈퇴' 작은 글자 버튼 확인
# 6. 게스트 상태에서 RideHistoryPanel, SavedRoutesPanel '회원 등록' 문구 확인
# 7. 폰 가로 800×360 시뮬레이션(DevTools device toolbar) → 한 화면에 맞는지 확인
```

---

## 알려진 이슈 / 후속 작업 필요

1. **계약 시험 2건 실패** — `start-screen-after-deletion.test.ts` 업데이트 필요 (별도 작업)
2. **code-tidy 기준선 악화** — 신규 CSS/TSX 라인 증가로 인한 것, `--update`로 기준선 갱신 필요 (별도 작업)
3. **리더보드/MenuPanel TypeScript 오류** — 별도 지시(02-task-01/02)에서 동시 수정 중

---

## 완료 확인

✅ 지시03 범위 내 모든 작업 완료  
✅ 리더보드 파일·MenuPanel·useAppSheetNavigation 미수정 준수  
✅ 통계 계산·인증·탈퇴 로직 변경 없음  
✅ 시험·설정·baseline 수정 없음  
✅ git 명령 미실행
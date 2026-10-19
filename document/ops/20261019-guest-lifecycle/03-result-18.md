# Task18 결과 — GLM 실제SDK 종료/동일 Guest 복귀 E2E spec

- 수행: OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`), 2026-10-19
- 지시: [02-task-18.md](02-task-18.md) / Chief 결정: [02-task-17.md](02-task-17.md)
- 소유(변경한 파일만): `apps/web/e2e/guest-lifecycle.spec.ts`, `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts`
- 그 외 제품 코드·서버·Rules·Supervisor scripts·rideEntryHelpers 등 전부 미변경. 운영/인증정보/private/evidence 접근 없음. 에뮬레이터 기동·커밋·배포 없음.

## 구현 요약 — 기존 3시험을 새 종료 계약에 맞춰 4동작으로 집중

1. **최초 진입**(기존 유지): 명시 Guest 1명, 새로고침해도 같은 UID.
2. **종료 반복**(기존 logout 시험 교체): UserInfoSheet 「종료」(signOut 없음) → 시작 메뉴 → 3회 반복에서
   같은 UID · Auth +1 한 명 · `userPrivate` fixture 보존.
   - 종료 중 상태에서 `page.reload()`와 새 탭(`context().newPage()`)도 시작 메뉴만 노출하고 계정을 만들지 않는다.
   - 종료 뒤 서버 수신 상태를 demo REST로 결정본 검증: members collection group runQuery에 uid 소유 문서 0,
     trails shallow 목록별 `trails/{trailId}/motion/{uid}` 0, `livePresence/{uid}` 문서 0,
     `guestLifecycle/{uid}.lastActivityAtMs` soak 8s×2 샘플 동일(수신 활동 핑 증가 0).
3. **삭제된 Guest 재접속**(기존 유지·시작 메뉴 계약만 보강): Auth `accounts:delete` + users/userPrivate 삭제 +
   marker `status:'deleted'` + RTDB `guestLifecycle/{uid}/blocked` PUT → 재접속은 만료 안내, 자동 계정생성 0,
   옛 문서 재생성 0, 다른 UID cache(`boxcycle_calorie_profile_v1_google-other`) 보존, 새 탭도 동일.
   명시 「게스트로 시작」 클릭에서만 새 UID 1명.
4. **offline 게스트 시작**(신규): 유휴 Guest의 종료 → `context().setOffline(true)`로 실제 network 차단 후
   「게스트로 시작」 클릭 → REST 계정 목록(확정 응답)으로 생성 0을 soak 폴링 → 복구(`setOffline(false)`) 후
   같은 UID 재사용·계정 그대로 1명.
- forceclick/fixme/skip 없음. UI 임의 추측 기다림 없음(시작 메뉴는 버튼 visible 기대만, 확정은 서버 REST).

## Cursor 요구 selector/UI 계약 (rideEntryHelpers 변경 없음 — spec 로컬로만 사용)

| 화면 | 계약 |
|---|---|
| 앱 소개 | region name `앱 소개` + `게스트로 시작` 버튼(기존 진입 경로 유지) |
| 사용자 정보 시트 | 버튼 `사용자 정보` → dialog name `사용자 정보`; **종료 버튼 role button name `'종료'` exact** (옛 2단계 로그아웃 확인 계약 삭제) |
| 시작 메뉴(종료 뒤·만료 뒤·종료 중 새로고침/새 탭) | 버튼 2개: `게스트로 시작`, `로그인`(exact). 문구 `로그아웃되었습니다.`는 존재 금지 |
| 재시작 결과 | 명시 시작 뒤 `사용자 정보` 버튼 visible(게이트 `시작` dialog/연결 대기는 기존 `guestStart` 헬퍼가 처리) |
| 만료 | 텍스트 `게스트 체험이 만료되었습니다` visible, `연결 중…`/`로그인 중…` pending 문구 없음 |

제품이 아직 「종료」/두 버튼 이름을 미반영이면 spec이 이 기대로 실패해 계약을 강제한다(지시대로 대기 없이 작성).

## 정적 시험 등록 갱신

- 시험 목록 4개 타이틀 고정, 신규 계약 정적 검사 추가: `종료', exact: true` 존재, 옛 계약(`name: '로그아웃'`,
  `로그아웃 확인`) 부재, `round <= 3`, 종료중 reload/newPage, `lastActivityAtMs`+`ACTIVITY_SOAK_MS`,
  members group query(`collectionId: 'members', allDescendants: true`), RTDB `trails.json?shallow=true`,
  offline `setOffline(true/false)`, 확정 REST(`listLocalIds`) — 기존 금지 목록(console./SDK 모킹/auth=owner 등) 유지.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

명령(복사 실행용):

```
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts
npx playwright test guest-lifecycle.spec.ts --list
npm run lint
```

| 명령 | exit | 결과 |
|---|---|---|
| 정적 시험 | 0 | 6 tests / 6 pass / 0 fail |
| `playwright --list` | 0 | Total: 4 tests in 1 file (4타이틀 전부) |
| `npm run lint` | 0 | guest-lifecycle 2파일 관련 지적 0 (남는 경고는 기존 App.tsx 등 타인 소유) |

**실제 e2e 실행(에뮬레이터+SDK)은 미실행 — Supervisor가 `apps/web/e2e/guest-lifecycle.spec.ts`를 실행한다.**
할 수 있는 등록·목록·lint만 실행했고, Slot 미시험 사유는 이 미실행 한 건뿐이다.

## 한계·노트

-Offline 시험의 확정은 REST 계정 목록으로만 한다(지시의 "확정응답필요"). UI 텍스트 기대는 두지 않았다.
- 활동 핑 종료 검증은 실측 soak(8s×2) 이다. 핑 주기가 5분이라 "증가 0" 단정은 이 soak 범위에서만 유효하다.
- members/motion/livePresence 결핍 검증은 이용 중 생성 방지 회귀용이다(짧은 시험에서는 원래 없을 수 있어, 늦은 잔여 생성/핑 증가를 잡는 계층이다).
- 기존 REST 방식(accounts:batchGet/accounts:delete + Bearer owner + RTDB `?ns=` 헤더 대신 쿼리)은 기존 E2E 계약 그대로 유지했다.

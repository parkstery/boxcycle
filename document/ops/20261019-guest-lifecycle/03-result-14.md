# 구현14 결과 — RTDB fixture 인증

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto. 세션: Task13을 이은 같은 Cursor 대화.
- 결과13은 보존했다. 서버·Rules·Supervisor 시험 파일은 수정하지 않았다. 운영 Firebase·인증·`.out/private-guest-lifecycle`·evidence는 읽지 않았다. 커밋·푸시·배포 없음. 에뮬레이터는 기동하지 않았다. Playwright 시험 본문은 실행하지 않았다.

## 1. 수정

`apps/web/e2e/guest-lifecycle.spec.ts`의 `markBlocked`만 바꿨다.

RTDB URL은 `guestLifecycle/{uid}/blocked.json?ns=demo-boxcycle-guest-default-rtdb`만 둔다. `auth=owner` 쿼리는 뺐다. PUT 헤더는 `ownerHeaders()`라서 `Authorization: Bearer owner`이다. 401이면 그대로 `marker blocked ${status}`로 실패한다. Rules와 skip은 건드리지 않았다.

`open-meteo-stub`는 `Page` 타입을 내보낸다. spec의 `import { test, expect, type Page } from './open-meteo-stub'`는 그대로 둔다.

localhost·`demo-boxcycle-guest` 게이트는 그대로다.

## 2. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts` | 0 | PASS 4. `auth=owner` 없음, `blocked.json?ns=`와 `ownerHeaders()` |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npx playwright test guest-lifecycle.spec.ts --list` | 0 | PASS. Total 3 tests in 1 file |
| Playwright `guest-lifecycle.spec.ts` 본문 | 미실행 | 에뮬레이터 재실행은 Supervisor 몫 |

`--list`에 등록된 3시험은 최초 진입, 로그아웃, 삭제 후 만료이다.

## 3. 바꾼 파일

- `apps/web/e2e/guest-lifecycle.spec.ts`
- `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts`
- 이 결과 파일

## 4. 한계

- 헤더 변경 뒤 RTDB PUT은 에뮬레이터에서 호출하지 않았다. 이 헤더로도 401이면 Supervisor가 로컬 Admin SDK bridge로 `guestLifecycle/{uid}/blocked`를 쓰면 된다. 그 bridge는 이번 범위에 넣지 않았다.
- 앱 재접속 단정은 아직 이 실행에 없다. Supervisor가 보고한 첫 2건 PASS는 유지된 기록이다.

## 5. Chief 확인

```
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts
npx playwright test guest-lifecycle.spec.ts --list
```

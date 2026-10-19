# 결과04 — GLM 병렬 HTTP 검증 (Task04)

- 수행자: OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`), 2026-10-19
- 쓰기 산출물: `functions/src/guestLifecycleHandlers.test.ts` + 이 문서.
- 제품 소스·package.json·타인 시험 수정 없음. 커밋·푸시·배포·운영 변경 없음. 운영 데이터·인증 파일·`.out/private-guest-lifecycle`·evidence 미접근.
- 참고 읽기: 이 묶음 README, `02-task-03.md`, `functions/src/guestLifecycleHandlers.ts`, `functions/src/guestLifecycleCore.ts`. Supervisor 시험 파일·감리 문서는 의도적으로 읽지 않았다(그 내용이 내 시험 설계와 결과 문서에 사전 판단으로 끼어들지 않게 하기 위해서다).

## 실행 증거

| 명령 (위치 `C:/20.HDev/boxcycle/functions`) | exit | 결과 |
|---|---|---|
| `npm run build` (`tsc`) | 2 | 컴파일 오류 2건(아래 발견 #3). lib JS 출력은 정상 생성돼 시험 실행 가능 |
| `node --test lib/guestLifecycleHandlers.test.js` | 1 | **tests 19 / pass 18 / fail 1** (fail은 결함 재현용 감리 시험, 발견 #1) |
| `npx eslint src/guestLifecycleHandlers.test.ts` | 0 | 내 시험 파일 lint clean |

실행 폴더 전체 절대 경로: `C:\20.HDev\boxcycle\functions`

```
cd C:\20.HDev\boxcycle\functions
npm run build
node --test lib/guestLifecycleHandlers.test.js
```

## 시험 커버리지 (19)

활동 handler: 405(POST 아님) / 401(bearer 없음·헤더 형식 아님·검증 null·상태 무변경) / 200 게스트 활동을 `deps.nowMs` 서버시각으로 기록(doc 반영) / 200 linking 유지·활동 연장 / 409 삭제예약(deletion-pending, 마커 불변) / 412 Google 계정(not-anonymous, 문서 생성 안 함·다른 게스트 기록 불변) / 감리: 일시 네트워크 실패시 verifyToken throw 전파 현재 계약 고정.

연결 handler: 405 / 401 / 400 알 수 없는 action / 400 leaseToken 결손·8자 미만 / 200 begin(2분 lease·토큰 8자 이상·서버 활동 갱신) / 409 삭제예약 begin / 412 Google 계정 begin(already-registered, 데이터 불변) / 200 cancel(lease 해제) / 200 cancel 토큰 불일치시 lease 유지(타인 lease 보호) / 412 still-anonymous(이후 lease 회수·active 회귀는 관찰값 주석과 고정) / 200 등록 계정 complete(exempt 기록·Auth 재허용·RTDB 차단 해제까지 확인) / **감리 FAIL** 등록 계정 complete lease 토큰 불일치는 반드시 거절해야 함 412(현재 200 exempt).

미실행(사유): 실제 Firebase/HTTP 왕복 — 운영·emulator·인증 접근 금지라 Memory 포트로 대체 검증만 수행. sweep·삭제 pipeline 본문(CAS 등)은 Task04 범위 밖(HTTP 계약만). 전체 lint 스윕은 미실행 — 빌드 실패 상태에서 타인 파일 오류까지 섞이는 것을 피하려고 내 파일 단독 실행했다.

## 발견 (제품 결함 — core·HTTP 부는 남의 소유라 수정하지 않고 보고만)

1. **[P2 — 시험 FAIL로 고정] complete 가 lease 토큰 불일치를 검증하지 않는다.** `guestLifecycleCore.ts` `completeGuestLink` 의 `if (!tokenMatches && !doc.disabledByLifecycle && guestMarkerBlocksClientWrite(doc.status)) return;` 에서 status `linking` 은 차단 대상이 아니어서, 등록(=익명 아님) 계정 + 8자 이상 임의 토큰으로도 `exempt` 기록·200 면책이 성공한다. HTTP 계약상 412 거절이 기대(시험 `[감리 FAIL]` 항목에서 FAIL 고정). 완화 요인: complete 은 같은 uid 의 bearer 를 요구하므로 남 uid 를 면책하려면 그 uid 의 유효 토큰이 필요해 악용 조건은 좁다. 그러나 "token 검증" 계약 자체가 무의미해지므로 core 소유자(Cursor)가 겸검토 권고.
2. **[P2] 만료 401 과 일시 네트워크 실패가 구분되지 않는다.** handler 층은 `verifyToken` 결과가 `null` 이든 `throw` 든 구분하지 않고 throw 는 handler 밖으로 전파된다(시험 `[감리]` 항목이 현재 계약 고정). `guestLifecycleHttp.ts` 의 verifyToken 은 catch-all 로 `getAuth().verifyIdToken` 실패 전부 null 처리 → 일시 네트워크 실패(예: 인증서 취득 실패)까지 401 "유효하지 않은 인증 토큰" 이 되어 클라이언트가 정상 세션을 강제 로그아웃할 수 있다. 기대: 일시 실패는 5xx/재시도 가능으로 유지, 실제 만료만 401. HTTP 부 소유자(Cursor) 수정 권고, core 가 아니므로 미수정.
3. **[빌드 게이트] `npm run build` exit 2 — core 타입 오류 2건** (`guestLifecycleCore.ts` L631 TS2367, L650 TS2339). 모두 런타임 동작에는 무해한 TS narrowing 한계(non-armed kind 유니온 문자열 묶음을 개별 check 로 좁히지 못하는)이지만 빌드가 막혀 내 시험 빌드도 게이트로 실패한다. core 소유자가 손대는 것이 가장 빠르다. 1회차 빌드에서 본 `guestLifecycleAdmin.ts` 오류(내보내기 미정의 + implicit any 5건)는 최종 빌드 시점 Cursor 진행으로 사라졌다.
4. **[관찰 — 결함 아님으로 분류, 의도 여부는 소유자 확인] still-anonymous complete 시 lease 회수.** 여전히 익명이면 complete 시도가 `412` + 문서 `active` 회귀·lease 토큰 제거. 클라이언트는 재 begin 이 필요하지만 UX 훼손은 작다. 시험은 관찰값을 주석과 함께 고정해 두었다.

## 다음 일

- Cursor(제품 소유자): 발견 #1 core 조건 보강, #2 HTTP verifyToken 구분, #3 core TS 오류 정리 → 필요시 내 시험 FAIL 항목이 PASS 로 전환되는지 재검.
- Supervisor: 위 발견을 감리 통합과 06-supervisor-findings-02 중복 정리에 반영.
- 나는 시험·결과 이상으로 기여 끝. 추가 운영 변경 없음.

# 게스트 전부 삭제 (2026-11-03)

상태: **완료·검증됨** (Claude Code). Chief 11-03 「현재 게스트는 불필요한 계정들이니 모두 제거한 후 게스트는 모두 원문자 g 로 시작하게」 → 승인 「승인한다」.

## 결과

| 항목 | 값 |
|---|---|
| 삭제 전 Auth | 67 (게스트 62 · Google 5) |
| 삭제한 게스트 | 62 / 실패 0 / 건너뜀 0 |
| 게스트 문서(조사 시) | 623 |
| 보호한 Google 계정 문서 | 2879 — 없어짐 0 · 바뀜 0 |
| 삭제 후 | Auth 5(Google 5) · 게스트 0 · 되살아난 개인 문서 0 · 남은 RTDB motion 0 |

증거: [test-reset-summary.json](evidence/test-reset-summary.json) · [test-reset-verification.json](evidence/test-reset-verification.json).
새 게스트 이름은 같은 날 배포(fd0ef880)부터 `ⓖ` + uid 앞 4자.

## 절차

도구 `scripts/guest-test-reset-supervisor.mjs`(10-19 묶음과 같은 것). 루트 `C:\20.HDev\boxcycle` 에서:

```
node scripts/guest-test-reset-supervisor.mjs --baseline=.out/private-guest-lifecycle/auth-before-20261103.json --google=5
node scripts/guest-test-reset-supervisor.mjs --apply --project=boxcycle-dc2df --max=62 --baseline=.out/private-guest-lifecycle/auth-before-20261103.json --google=5
node scripts/guest-test-reset-supervisor.mjs --verify --baseline=.out/private-guest-lifecycle/auth-before-20261103.json --google=5
```

1. 기본 기준(10-19, Google 4)으로 조사하자 **Google protection mismatch 로 정지** — 10-23 에 가입한 Google 계정 1개(uid `MVkq…`)가 기준에 없었다.
2. 현재 비익명 계정 5개(모두 Google)로 이번 기준 파일을 만들고, 도구에 `--baseline=`·`--google=` 인자를 더했다. 새 기준이 10-19 보호 계정을 하나라도 빠뜨리면 멈춘다(보호는 넓힐 수만 있음). 인자가 없으면 종전 동작.
3. 조사 단계가 운영 전체 스냅샷(`firestore-before.json`·`rtdb-before.json`)을 로컬 `.out/private-guest-lifecycle/test-reset/` 에 남겼다 — Firestore 백업이 꺼져 있어 이것이 유일한 복구 자료. 10-19 스냅샷은 `test-reset-20261019/` 로 먼저 복사.
4. 도구가 요약을 10-19 묶음 evidence 자리에 쓰므로, 이번 결과는 이 묶음으로 옮기고 10-19 파일은 커밋된 내용으로 되돌렸다.

다음에 쓸 때: 도구의 요약 출력 경로가 10-19 묶음에 고정돼 있다 — 실행 뒤 이번처럼 옮기거나, 출력 경로 인자를 더한다.

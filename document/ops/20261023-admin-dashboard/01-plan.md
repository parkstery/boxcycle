# 관리자 화면 1차 — 사용자 지표·최근 현황·점검 숫자

2026-10-23 · plan · Supervisor(Claude) · Chief 「진행」 승인

## 목적

`admin:ride-metrics` 는 이 PC 터미널에서만 돌아 Chief 가 직접 볼 수 없다. 앱 안에 관리자만 보이는 화면을 만들어 폰·PC 어디서든 본다.

## 범위

| 넣는다 | 넣지 않는다 |
|---|---|
| 사용자 지표(첫 주행 완료율·72h 재주행·다른 날 재사용·새 도로 비율, 전체/게스트/Google) | 공개 경로 심사(자동 심사 중 — 기존 수동 화면은 비상구로 그대로) |
| 최근 현황(오늘·최근 7일: 가입·주행·거리, KST) | 데이터를 고치거나 지우는 명령(터미널에 남긴다 — 백업 꺼짐) |
| 점검: 처리 안 된 공개 경로 신청 수(평소 0) | |
| 내부 계정 제외(관리자 목록 + `config/adminDashboard.excludeUids`) | |

## 권한

관리자 = 기존 `config/routeReviewers.uids`. 서버는 Bearer ID 토큰 검증 후 목록 대조(기존 `adminPromoteSavedRoute` 와 같은 방식). 화면은 기존 `isRouteReviewer(user)` 로 메뉴 노출만 결정한다 — 숫자는 서버가 다시 확인해야 내준다.

## 계약 — `GET {functionsHttpUrl("getAdminDashboard")}` · `Authorization: Bearer <idToken>`

401 토큰 없음/무효 · 403 관리자 아님 · 200:

```json
{
  "generatedAt": "2026-10-23T12:00:00.000Z",
  "excludedAccounts": 5,
  "rule": { "minRideDistanceMeters": 100, "minRideDurationSec": 5 },
  "metrics": {
    "all": { "accounts": 0, "accountsWithValidRide": 0, "firstRideCompletionRatePct": null, "secondRideWithin72hRatePct": null, "otherDayReuseRatePct": null, "newRoadClaimRatio": null, "validRides": 0, "totalDistanceKm": 0 },
    "guest": { "...": "같은 모양" },
    "provider": { "...": "같은 모양" }
  },
  "recent": {
    "today": { "signups": 0, "rides": 0, "distanceKm": 0 },
    "last7Days": { "signups": 0, "rides": 0, "distanceKm": 0 }
  },
  "health": { "pendingPublicRouteRequests": 0 }
}
```

비율은 분모 0 이면 `null`(화면은 「—」). 날짜 경계는 KST. 내부 계정은 metrics·recent 모두에서 뺀다.

## 실행

| 지시 | 범위 | 실행 |
|---|---|---|
| [02-task-01](02-task-01.md) | 서버: 계산 코어 분리·함수·시험 | Claude impl-standard |
| [02-task-02](02-task-02.md) | 화면: API·관리자 시트·메뉴 진입 | Claude impl-standard |

동시 실행(파일 겹침 없음). 감리·배포는 Claude. 배포는 규칙 변경 없음, functions(신규 1) → hosting 순.

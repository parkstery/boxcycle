# 리더보드 1단계 + 계정 패널 재디자인

2026-10-23 · plan · Supervisor(Claude) · Chief 「시안 맘에 든다. 진행하자. 이런 스타일로 계정 패널도」

- 시안: 리더보드 https://claude.ai/artifact/1YvLHt4nD5xYy6FhLwYb1s · 계정 패널(C 패널 + B 강조) https://claude.ai/artifact/7Mn8TiLhRaTi7iNnUFzd7D
- 사실 조사: [00-facts.md](00-facts.md) (Nemotron) — 감리 확인: `conquestResult.tier` 기록 ✅, 사용자 지역 정보 **없음** → 「나라」 순위는 2단계로.

## 결정 (Chief 10-23)

1. 첫 탭 = **주행 거리**, 바로 옆 = **개척**(새 도로 km + 내 퍼블릭 길을 남이 달린 사람·거리).
2. 순위 반영 = **케이던스 센서 주행만**(`rides.conquestResult.tier == "t1"`). 체험 속도 주행은 기록·내 도로망에는 남지만 순위 제외.
3. 게스트는 순위 제외. 문구는 「로그인」이 아니라 **「회원 등록」**(기록이 그대로 이어지므로).
4. 표는 한 번에 하나: 순위·이름·값(+개척 탭은 「내 길 이용」) — 엑셀식 행렬 금지.
5. 지금 달리는 사람에게 「같이 달리기」 → 그 사람의 Trail 로 합류.

## 1단계 범위

| 넣는다 | 2단계로 |
|---|---|
| 범위: **세계** | 나라·시도·시군구(지역 판정 선행) |
| 기간: 주행 거리 = 이번 주(월 0시 KST)·이번 달·전체 / 개척 = 이번 달·이번 주·전체 | 지난 기간 대비 등락(▲2) — 기간 마감 기록 저장 선행 |
| 상위 10 + 내 위치 ±2, 내 줄 강조 | 리그·경로별 순위 |
| 게스트: 순위 목록은 보고, 왼쪽 판은 「회원 등록하면 …」+ 예상 순위 | |

## 서버 계약 — `GET getLeaderboard?board=distance|pioneer&period=week|month|all`

인증: 로그인(게스트 포함) Bearer ID 토큰 필수 — 공개 긁어가기 방지. 응답에 **uid 를 넣지 않는다**(닉네임만).

```json
{
  "generatedAt": "ISO", "board": "distance", "period": "week", "scope": "world",
  "periodStartKst": "2026-10-20",
  "rule": { "sensorOnly": true },
  "top": [ { "rank": 1, "nickname": "…", "valueKm": 182.0, "uses": null, "liveTrailId": "abc" | null, "isMe": false } ],
  "me": {
    "status": "ranked" | "unranked" | "guest",
    "rank": 14 | null, "valueKm": 38.4,
    "gapToNextKm": 4.2 | null,
    "projectedRank": 14 | null,
    "uses": { "riders": 7, "km": 42.0 } | null,
    "around": [ /* top 와 같은 모양, 내 위·아래 2명 — top 과 겹치면 생략 */ ]
  }
}
```

- `distance`: 기간 안 t1 주행의 `distanceMeters` 합. `pioneer`: 기간 안 t1 주행의 `conquestResult.newMeters` 합, `uses` = 그 사람이 `applicantUid` 인 퍼블릭(`rides.publicationId`)을 **다른 사람**이 기간 안에 달린 사람 수·거리.
- 회원 = Auth 가 익명이 아님. 게스트 본인은 `status: "guest"` + `projectedRank`(회원이었다면 등수).
- `unranked` = 회원인데 기간 안 t1 주행 없음.
- `liveTrailId` = `trails/{trailId}/livePublicationRides/{uid}` 의 `lastSeenAt` 이 30초 안인 사람의 trailId(collectionGroup). 없으면 null.
- 캐시: 전체 순위(uid·값)를 `leaderboardCache/{board}_{period}` 에 저장, 5분 지나면 다시 계산. 클라이언트는 이 컬렉션을 못 읽는다(규칙 기본 거부 유지 — 규칙 변경 없음 확인).
- 접근 로그는 남기지 않는다(일반 사용자 기능).

## 실행

| 지시 | 내용 | 실행 |
|---|---|---|
| [02-task-01](02-task-01.md) | 서버 `getLeaderboard` + 집계 코어·시험 | Claude impl-standard (권한·집계 정확성) |
| [02-task-02](02-task-02.md) | 리더보드 시트(시안 1·2·3) + MENU 진입 | opencode Nemotron 3 Ultra |
| [02-task-03](02-task-03.md) | 계정 패널 재디자인(C 패널 + B 강조) + 탈퇴를 프로필 수정 안으로 + 「회원 등록」 문구 4곳 | opencode Nemotron 3 Ultra |

01·02 는 계약만 공유해 동시 실행, 03 은 02 와 파일이 겹치지 않게(02 = 새 시트·MENU, 03 = UserInfoSheet·ProfileEditSheet). Cursor 는 자동 권한 검사가 막아 이번에도 제외. 검증·배포는 Claude.

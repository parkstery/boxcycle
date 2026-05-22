# Tier Quota 정책 (D5)

| 항목 | 내용 |
|------|------|
| 문서 유형 | **product** — tier별 생성·저장 한도 |
| 작성일 | 2026-05-19 |
| 상태 | **채택(1차)** — CF `assertTierQuotaHttp` + onCreate 강제 |
| 상위 | [사용자 tier 및 진입 정책](260519-사용자-tier-및-진입-정책.md) §2.5, §6 D5 |
| 시드 | [config-tierQuotas.seed.json](config-tierQuotas.seed.json) (코드 기본값과 동일) |

---

## 1. 원칙

- **잠금 UI보다 월간·보유 한도(quota)** 로 Guest / Free / Paid 를 구분한다.
- 검증은 **Cloud Functions** 가 단일 진실 — 클라이언트 선검사 + `savedRoutes`·`publicRouteRequests` onCreate 롤백.
- **admin** (`config/routeReviewers` uid) 은 한도 없음.

---

## 2. 한도 표 (KST 월 기준)

| tier | 경로 **신규 저장**/월 | 경로 **보유** 상한 | **공개 신청**/월 | 이벤트 생성/월 |
|------|----------------------|-------------------|------------------|----------------|
| `anonymous` (Guest) | 3 | 5 | **0** (계정 연동 필요) | 0 |
| `registered_free` | 15 | 30 | 2 | 0 (후속) |
| `registered_paid` | 50 | 100 | 10 | 5 (후속) |
| `admin` | 무제한 | 무제한 | 무제한 | 무제한 |

- **신규 저장/월:** `savedRoutes` `createdAt` 이 해당 KST 월인 문서 수.
- **보유 상한:** 해당 `userId` 의 `savedRoutes` 전체 문서 수(만료·완주 포함).
- **공개 신청/월:** `publicRouteRequests` `createdAt` (상태 무관, 취소·거절도 카운트).

---

## 3. API

### `assertTierQuotaHttp` (POST, Bearer)

요청 본문:

```json
{ "action": "save_route" | "public_route_request" | "create_event" }
```

응답:

```json
{
  "result": {
    "allowed": true,
    "tier": "anonymous",
    "action": "save_route",
    "usage": { "saveRouteCreatedThisMonth": 1, "saveRouteActiveTotal": 4 },
    "limits": { "saveRoutePerMonth": 3, "saveRouteMaxActive": 5 }
  }
}
```

거부 시 HTTP 429, `error.message` 에 한국어 안내.

---

## 4. 구현 위치

| 계층 | 파일 |
|------|------|
| CF 코어 | `functions/src/tierQuotaCore.ts` |
| CF HTTP | `functions/src/tierQuotaHttp.ts` |
| CF 강제 | `functions/src/tierQuotaEnforcement.ts` |
| 웹 | `apps/web/src/lib/tierQuota.ts` |
| 저장 전 | `saveRouteToFirestore` · `submitPublicRouteRequest` |

---

## 5. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-19 | D5 1차 — 표 채택, CF·웹·onCreate |

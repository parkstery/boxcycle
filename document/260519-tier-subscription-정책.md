# Tier Subscription 정책 (D6)

| 항목 | 내용 |
|------|------|
| 문서 유형 | **product** — Stripe 구독 → `registered_paid` |
| 작성일 | 2026-05-19 |
| 상태 | **채택(1차)** — Checkout·Webhook·포털·만료 스윕 |
| 상위 | [사용자 tier 및 진입 정책](260519-사용자-tier-및-진입-정책.md) §2.4, §6 D6 |
| quota | [tier quota 정책](260519-tier-quota-정책.md) — `registered_paid` 한도 적용 |
| 시드 | [config-subscription.seed.json](config-subscription.seed.json) |

---

## 1. 원칙

- **`users.tier`·`subscription*`** 는 **Cloud Functions(Webhook)만** 갱신 — 클라이언트·Rules 직접 쓰기 금지.
- Checkout·포털은 **Google 로그인 + 닉네임(`registered_free`)** 이후만 (`assertUserCanSubscribe`).
- Guest(`anonymous`)·admin 은 구독 대상 아님.
- Stripe 이벤트는 `billingProcessedEvents/{eventId}` 로 **멱등** 처리.

---

## 2. Firestore 필드 (`users/{uid}`)

| 필드 | 설명 |
|------|------|
| `tier` | Webhook 후 `registered_paid` 또는 만료 시 `registered_free` |
| `subscriptionStatus` | `none` \| `active` \| `past_due` \| `canceled` |
| `subscriptionExpiresAt` | Stripe `current_period_end` (UTC Timestamp) |
| `stripeCustomerId` | Stripe Customer id (CF 전용) |
| `stripeSubscriptionId` | Stripe Subscription id (CF 전용) |

---

## 3. Cloud Functions

| 함수 | 용도 |
|------|------|
| `getSubscriptionMeHttp` | GET/POST + Bearer — 플랜·구독 상태 |
| `createSubscriptionCheckoutHttp` | POST `{ successUrl, cancelUrl }` → Checkout URL |
| `createSubscriptionPortalHttp` | POST `{ returnUrl }` → Billing Portal URL |
| `stripeSubscriptionWebhookHttp` | Stripe Webhook (raw body 서명) |
| `subscriptionExpireSweep` | 매일 UTC 19:00 — 만료 `registered_paid` 강등 |
| `subscriptionDevApplyHttp` | **에뮬레이터만** — tier 시뮬레이션 |

### Secrets (Firebase)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` — 월 구독 Price id

### Webhook 이벤트

- `checkout.session.completed` (mode=subscription)
- `customer.subscription.updated` / `deleted`
- `invoice.payment_failed` → `past_due` (grace, 기간 내 `registered_paid` 유지)

---

## 4. 웹

- `apps/web/src/lib/subscription.ts` — HTTP 클라이언트
- `UserInfoSheet` — 플랜 배지·「유료 플랜 구독」·「구독 관리」
- Checkout 복귀: `?subscription=success|cancel` → URL 정리 + 안내

---

## 5. 배포 체크리스트

1. Stripe Dashboard — Product/Price, Webhook endpoint → `stripeSubscriptionWebhookHttp` URL
2. `firebase functions:secrets:set STRIPE_*`
3. `firebase deploy --only functions:getSubscriptionMeHttp,functions:createSubscriptionCheckoutHttp,functions:createSubscriptionPortalHttp,functions:stripeSubscriptionWebhookHttp,functions:subscriptionExpireSweep,firestore:indexes`
4. Hosting 빌드 후 `firebase deploy --only hosting`

---

## 6. 잔여 (D6 이후)

- Route Token·마일리지와 **번들 SKU** 정합
- 연간 플랜·프로모션·영수증
- `create_event` quota 와 유료 플랜 UI 연동
- App Store / Play 인앱 (네이티브) — 별도 트랙

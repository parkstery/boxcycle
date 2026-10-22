# 감리 P3 — 반복 코드 통합 (지시05~08)

2026-10-22 · review · Claude · **APPROVED**

## 결과

| 지표 | 기준선 | P3 후 |
|---|---:|---:|
| 반복 쌍 (jscpd 8줄·70토큰) | 33 | **1** (`rideResumeSlotLocal.ts` 안 9줄) |
| 반복 줄 | 549 (0.75%) | **8 (0.01%)** |
| 운영 기본 번들 `index-*.js` | 3,741.63 kB | **3,738.29 kB** |

## 실행자

opencode 무료 한도·Cursor `--force` 권한 거부로 **4건 모두 Claude impl-standard** 가 수행, 감리는 Claude 직접.

| 지시 | 합친 것 | 커밋 |
|---|---|---|
| 05 | `trail/keyedSubscriptionHub`(구독 허브) · `peerMotion/publishFlightCore`(발행 비행) · `trail/repo/trailDocParse` | `79ddc8e0` |
| 06 | `services/routeFunctionsWire` · 기존 `decodeLineStringCoordsJson` 재사용 · `conquest/conquestPathGeometry` · `identity/functionsHttpJson` · `account/functionsErrorMessage` · `ride/sanitizeLngLat` · 파일 안 2건 | `79ddc8e0` |
| 07 | `hooks/loadPublicationGeometries` · `storage/storageEntrySubscription` · `ui/useEscapeKeyClose` · 파일 안 3건 | `8f0fedd6` |
| 08 | `components/labPanel/*`(Lab 공통 틀, 여전히 별도 청크) · `skinVertexDQInto` · `disposeRiderObject` · `camera/cameraProbeMath` | `5ab5a2cf` |

05·06 은 `dep-layers.json` 을 같이 고쳐 한 커밋으로 묶었다. 07 커밋에 08 의 `cameraProbeMath.ts` 배정 한 줄이 먼저 들어갔다(08 커밋에서 파일이 들어와 해소).

## 감리가 직접 본 위험 지점

- **발행 비행 정리 순서:** `inFlight === 0 && !isEpochLive` 에서만 보류 정리를 실행하는 분기가 각 호출처 `finally` 에 그대로 있고, 공통부 `requestCleanup(req, idle)` 은 예전처럼 「한가하면 즉시, 아니면 보류」.
- **재개 슬롯:** 락 실패·TTL 실패·CAS 충돌·쓰기 실패의 이유 문자열과 순서가 원본과 같다.
- **토큰 차감 보고 중복 방지:** 공통 팩토리로 바꾸며 호출처마다 상태를 따로 가진다(예전 모듈 변수 2개와 같은 동작).
- **진입 화면 버튼:** `AuthSessionGate` 의 두 버튼 DOM·클래스·문구 동일, 같은 파일 안 컴포넌트라 소스를 읽는 계약도 그대로 겨눈다.
- **Lab 패널:** 운영 기본 번들에 `cam-lab`·`light-lab` 0회, Lab 청크 2개 + 공통 청크 1개 분리 유지.

## 검증 (감리 직접)

| 검사 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | 오류 0 |
| `check-dep-direction --check` | 위반 0 · 순환 0 |
| `npx eslint .` | 오류 0 |
| `npm run test:quick` | 1,341 통과 · 실패 0 |
| `test:peer-spacing` | requiredFail 0 (게이트·전이 7·잔여) |
| `test:rtdb-rules` | 통과 |
| `npm run build` | 성공 |
| `test:e2e:ride` (`RTW_DEV_PORT=5012`) | **7/7 통과** |

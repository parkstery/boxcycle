# 지시08 STEP1 — Claim 데이터 확인 (D1–D5)

구현 전 보고. 코드 SoT: `conquestOnRideCreated.ts` · `firestoreConquest.ts` · `conquestTiles.ts`.

## D1 — `conquest/{uid}` 구조

| 경로 | 내용 | 규모 |
|---|---|---|
| `conquest/{uid}` | 요약: `totalMeters`, `totalCells`, `daily{day,usedSec,usedMeters}` | 문서 1 |
| `conquest/{uid}/chunks/{z12}` | `{ cells: { "<z20Id>": <dayKey> } }` — Claim 단위는 **z20 도로 셀**(`20_x_y`, ~30m). 청크 키는 z12(`12_x_y`, 서울 위도 ~7.8km) | 사용자당 청크 수 ∝ 달린 면적 |
| `conquest/{uid}/traces/{rideId}` | `{ path: [lng,lat,...] 평탄, newMeters, day }` — 「내 도로망」 마젠타 렌더용 | 주행 1회당 1 |

## D2 — 경로가 「이미 달린 길」인지 판정 단위

**z20 셀**과 비교한다. Claim 저장·인정 단위가 셀이고, 경로 geometry를 ~12–30m 간격으로 샘플 → `conquestCellIdAt` → claimed Set 조회가 정확하다.
traces 폴리라인 거리 비교는 렌더용이며 셀 경계와 어긋날 수 있어 스코어 입력으로는 쓰지 않는다.

신규 도로 비율 = (Claim 되지 않은 샘플 구간 길이) / 전체 길이.

## D3 — 출발점 주변만 읽기

**가능.** 전체 `chunks` 컬렉션 스캔 금지.

1. 출발점 기준 반경 `1.5 × targetDistance` bbox 계산
2. bbox 모서리를 z12 타일 XY로 변환 → `12_x_y` ID 집합(통상 1–9개)
3. Admin SDK `doc.get()` 병렬 — 있는 청크만 병합해 `Set<z20Id>`

→ **전체 스캔 불필요. 구현 진행.**

## D4 — 읽기 지연 예상

청크 1–9건 `get` ≈ 수십~200ms(리전 asia-northeast3). Mapbox 방위 탐색(수 초)에 비해 작다. STEP2 실측 시 `claimReadMs` 로 보고.

## D5 — Claim 없는 사용자

claimed Set 비어 있음 → 신규 도로 비율 = 1.0(가산 항 동일) → **거리 오차 조기채택(종전) 경로 유지**. Claim 읽기 miss/empty 도 동일. 첫 사용자가 느려지거나 실패하면 안 된다.

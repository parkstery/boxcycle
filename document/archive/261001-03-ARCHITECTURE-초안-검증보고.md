# 03_ARCHITECTURE 초안 검증 보고

| 항목 | 내용 |
|------|------|
| 문서 유형 | **보고서** — 외부 초안 `03_ARCHITECTURE.md`와 저장소 SoT·코드 대조 |
| 작성일 | 2026-10-01 |
| 검증 기준 | `document/reference/architecture/260925-RTW-lib-도메인-경계와-의존-방향.md` · `apps/web/dep-layers.json` · `document/reference/product/260714-RTW-Ontology.md` · `origin/main` / 로컬 트리 · README · `.env.example` |
| 상태 | **완료** — 초안을 SoT로 채택하기 전 수정 필수 |
| 범위 | **앱 코드 미수정.** 문서·코드 읽기만 |

---

## 0. 한 줄 요약

초안의 **제품 개념 구분**(Route≠Ride, Trail≠Ride 하위, Firestore≠RTDB, 제품관계≠import)은 기존 SoT와 **대체로 일치**한다.  
그러나 **스택·배포·환경변수·도메인 목록·Public Trail 현재 수치·검증 범위**에 **사실 오류·과단정·누락**이 있어, 그대로 Architecture SoT로 쓰기엔 부적합하다.

---

## 1. 판정 기호

| 기호 | 의미 |
|------|------|
| ❌ | 저장소 사실과 **틀림** — 수정 필수 |
| ⚠ | **부분 맞음 / 과단순 / 브랜치·시점 미명시** — 문장 교정 필요 |
| ✅ | 기존 SoT·코드와 **일치** |
| ? | 저장소만으로 **확정 불가**(외부 콘솔 필요) |

---

## 2. 치명·높은 우선 오류

### ❌ §32 Vercel 프로젝트명 `dmv2`

- 초안: 「현재 Vercel 프로젝트: `dmv2`」
- 저장소·실측: 프로젝트/도메인은 **`boxcycle`** / [boxcycle.vercel.app](https://boxcycle.vercel.app/). 리포 전역에 `dmv2` **0건**.
- 중간점검 보고도 Production ≈ `main` · `boxcycle.vercel.app`로 기록.

### ❌ §32 Production 환경변수 `VITE_MAPBOX_TOKEN`

- 초안: `VITE_MAPBOX_TOKEN`
- 실제: **`VITE_MAPBOX_ACCESS_TOKEN`** (`apps/web/.env.example`).  
  또한 Production에는 Firebase `VITE_FIREBASE_*` 일식도 필요하다. Mapbox 한 줄만으로는 앱이 구성되지 않는다.

### ❌ §28~§35 「핵심 도메인 = Geo·Route·Ride·Trail·Conquest」만 제시

- 기계 SoT [`dep-layers.json`](../apps/web/dep-layers.json) 도메인에는 최소 다음이 **동등한 레이어**로 존재한다:  
  `firebase`, `map`, `peerMotion`, `activity`, `account`, `identity`, `sensor`, `camera`, `rider`, `coach`, `weather`, `debug`, `terms`, `storage` 등.
- 초안이 다섯만 “핵심”으로 고정하면, **표현 계층(`map`)·동행 전송(`peerMotion`)·Activity World(`activity`)·경제(`account`)**가 아키텍처 밖에서 임의 구현되는 오해를 낳는다.
- 기존 SoT: [260925-RTW-lib-도메인-경계와-의존-방향.md](../reference/architecture/260925-RTW-lib-도메인-경계와-의존-방향.md) §2~§3.

### ❌ Ontology 핵심 개념 **Publication** 누락

- [260714-RTW-Ontology.md](../reference/product/260714-RTW-Ontology.md): Route → **Publication**, Ride는 Publication/Route를 따를 수 있음, Activity World red dot은 publication 단위.
- 초안은 Route/Ride/Trail/Claim만 말하고 **Publication·Route Token·Trailhead**를 구조도에 넣지 않음. UI·Firestore 경로(`livePublicationRides`, `publicationId`)와 불일치.

### ❌ §32 배포를 Vercel만으로 단정

- README·`package.json` `deploy:hosting`: **Firebase Hosting**(`boxcycle-dc2df`)이 공식 배포 경로로 살아 있다.
- 중간점검: Hosting **과** Vercel **병존**.  
  「웹 배포 = Vercel만」은 사실 축소.

---

## 3. 과단정·브랜치 혼동

### ⚠ §24 Peer motion 「현재 5Hz」

| 기준 | `PEER_MOTION_PUBLISH_INTERVAL_MS` | FS heartbeat |
|------|-----------------------------------|--------------|
| **`origin/main` (배포 tip)** | **200 ms (5Hz)** | **4000 ms** |
| **로컬 `main2` 작업 트리** | **100 ms (10Hz)** | **1000 ms** |

- 초안 서술은 production/`main` 기준이면 ✅에 가깝다.
- 「현재」를 저장소 기본 개발 브랜치 `main2`로 읽으면 ❌.
- **반드시 기준 브랜치·배포 SHA를 명시**해야 한다. (2026-10-01 traffic 묶음은 `main`에만 병합됨.)

### ⚠ §23 Listing = join/leave만

- `origin/main`의 listing CF: live-ride는 **Created/Deleted**, members도 Created/Deleted — 초안 방향과 **일치**.
- 로컬 `main2`의 `openTrailListingProjection.ts`는 live-ride **`onDocumentWritten` 전체 update** 경로가 아직 남아 있을 수 있음(미병합).
- 또한 `trails/{id}` **Written** 트리거·`lastActivityAt` 경로는 여전히 listing 재계산과 연결될 수 있다. 「join/leave만」은 **목표·live-ride 경로**에 가깝고 **전 트리거 집합의 완전 서술**은 아니다.

### ⚠ §22 「실시간 motion을 Firestore에 저장하지 않는다」

- ✅ RTDB가 peer **motion** 주 채널인 점은 맞다.
- ⚠ 주행 중 Firestore `livePublicationRides` **진행·속도 heartbeat**(main: 4s)는 여전히 존재한다.  
  「고빈도 motion 전부 FS 금지」와 「FS에 주기 live 문서 없음」을 혼동하면 안 된다.

### ⚠ §27 「2·5·10인 traffic 비교 가능해야 한다」

- 제품·검증 **목표**로는 타당.
- 2026-10-01 Public Trail traffic 묶음은 **1·2인만** 게이트했고 **3명+는 범위 밖**으로 명시됨.  
  「현재 검증 구조가 이미 5·10인을 지원한다」로 읽히면 과대.

### ⚠ §33 「기본 개발 기준 = main2」만

- 개발 워크플로상 `main2` 사용은 관례적으로 ✅.
- Production / Vercel Production / traffic 배포 tip은 **`main`**.  
  Architecture SoT가 브랜치 역할을 쓸 때는 **개발 base vs 배포 base**를 분리해야 한다.

---

## 4. 대체로 맞는 부분 (유지 권장)

| 절 | 판정 | 근거 |
|----|------|------|
| Route ≠ Ride | ✅ | Ontology · 260925 §2 |
| Trail ≠ Ride 하위 | ✅ | 260925 §4 · `trail→ride` import 0 정책 |
| Conquest ≠ Route 하위 · ClaimReader 포트 | ✅ | `ClaimReader` in `distanceAutoRouteCore` · `conquestClaimRead` |
| 제품 관계 ≠ 코드 import | ✅ | 260925 §2 동일 원칙 |
| Firestore 영속 / RTDB 실시간 motion | ✅ (단 §22 보정 필요) | peerMotion RTDB path |
| Functions region `asia-northeast3` | ✅ | `functions/src/region.ts` |
| 스택 React 19 · Vite 8 · mapbox-gl 3.23 · firebase 12.13 | ✅ | `apps/web/package.json` (`^` 범위) |
| Port/Adapter 지향 | ⚠→대체로 ✅ | 목표·게이트와 일치. 단 모든 호출이 Port인 것은 아님 — `*/repo`가 Firestore SDK를 직접 쓰는 구조가 **의도된 도메인 저장소**임 |

---

## 5. 빠진 아키텍처 사실 (초안에 없음)

1. **의존 방향의 기계 SoT**는 산문 다이어그램이 아니라 **`apps/web/dep-layers.json` + `check-dep-direction`** 이다.
2. **`map`은 전 도메인을 볼 수 있는 표현 계층**, 아무도 `map`을 올리면 안 된다.
3. **`peerMotion`은 Ride 하위 전송 계층**이며 Trail repo를 직접 찌르지 않는 계약이 있다.
4. **Activity World / presence / openTrailListings / livePublicationRides** 컬렉션 역할이 데이터 절에 거의 없다.
5. **Guest(익명 Auth)** vs 미인증 — Ontology 용어.
6. 배포: **Firebase projectId `boxcycle-dc2df`**, Hosting + Functions + (선택) Vercel.

---

## 6. 섹션별 빠른 체크리스트

| § | 제목 요약 | 판정 |
|---|-----------|------|
| 1–3 | 역할·큰 그림·5도메인 | ⚠ 5도메인만 고정 ❌에 가깝게 위험 |
| 4–9 | Geo~Claim 서술 | ✅ 개념적으로 대체로 맞음 · Publication 누락 |
| 10–12 | 제품관계 vs import | ✅ |
| 13–18 | Port/Adapter · ClaimReader | ✅ 방향 · ⚠ 「모든 Domain이 Firebase 미직접」은 과장 |
| 19–22 | FS / RTDB | ⚠ motion vs live heartbeat 혼동 위험 |
| 23–27 | Listing · 5Hz · N명 | ⚠ main 기준 / 검증 범위 명시 필요 |
| 28–31 | 스택·Mapbox·Auth·CF | ✅ 리전·스택 · Auth 분리는 ✅ |
| 32 | Vercel · env | ❌ `dmv2` · ❌ `VITE_MAPBOX_TOKEN` · ⚠ Hosting 누락 |
| 33–34 | main2 · Codex | ⚠ 배포 base 누락 · 역할 서술은 현행에 가깝 |
| 35–42 | 요약·검증 기준 | ⚠ 도메인 축소 요약 반복 |

---

## 7. 권고 (문서만 · 코드 변경 없음)

초안을 RTW Architecture SoT로 쓰려면 최소 다음을 고친다.

1. **외부 사실 교정:** Vercel 프로젝트명, Mapbox env 키, Hosting 병존, Firebase projectId.
2. **도메인 목록:** 260925 / `dep-layers.json`과 정렬. “제품 판타지 5영역”과 “코드 레이어 전체”를 **두 표로 분리**.
3. **Ontology 정렬:** Publication · Trailhead · Route Token을 개념도에 추가.
4. **수치·트리거:** “현재”에 `origin/main` SHA 또는 “Production 배포 기준”을 붙이고, FS live heartbeat·listing Created/Deleted를 정확히 기술.
5. **중복 SoT 방지:** 이미 [260925](../reference/architecture/260925-RTW-lib-도메인-경계와-의존-방향.md)가 lib 의존 SoT이다. 초안은 그 문서를 **링크+요약**하고, 스택·배포·데이터 채널만 보강하는 편이 지침 §2(이중 기술 금지)에 맞다.

---

## 8. 검증에 쓴 증거

| 증거 | 용도 |
|------|------|
| `apps/web/package.json` | React/Vite/Mapbox/Firebase 버전 |
| `apps/web/.env.example` | `VITE_MAPBOX_ACCESS_TOKEN` · Functions region |
| `functions/src/region.ts` | `asia-northeast3` |
| `apps/web/dep-layers.json` | 실제 도메인 레이어 목록 |
| `document/260925-…`, `260714-Ontology` | 경계·용어 SoT |
| `git show origin/main:…rideSyncPolicy.ts` | 5Hz · 4s heartbeat |
| `git show origin/main:…openTrailListingProjection.ts` | Created/Deleted listing |
| README · `deploy:hosting` · archive 중간점검 | Hosting + Vercel |

---

## 9. 결론

초안은 **좋은 개념 스케치**이나, 제목처럼 “현재 구조의 Source of Truth”로 단정하기에는 **사실 오류(특히 §32)와 도메인·배포·수치의 과단정**이 있다.  
채택 전 위 §7 교정이 필요하다.

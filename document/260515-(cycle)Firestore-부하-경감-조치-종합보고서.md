# Firestore 부하 경감 조치 — 종합 보고서

**작성일:** 2026-05-15  
**범위:** 웹 앱(`apps/web`) 클라이언트 + `firestore.rules`  
**상태:** **1차 일단락** — 추가 튜닝·서버 집계·모니터링은 향후 과제로 분리

---

## 1. 목적과 배경

### 1.1 문제 인식

- Blaze 요금제 하에서 **일일 Firestore 읽기·쓰기**가 무료 한도 근처까지 사용되는 현상이 관측됨.
- 앱 특성상 **실시간 로비·코스 동행·진행률 공유** 등이 Firestore와 맞물려 있어, 사용자·탭 수가 늘면 **선형 이상**으로 비용이 커질 수 있는 구조였음.
- 자문단·시니어 공통 의견: **Firestore를 “초당 위치 스트리밍 서버”처럼 쓰지 말 것** — **LOD·상태·가시성**에 따라 데이터 품질과 동기화 빈도를 나눌 것.

### 1.2 목표

1. **기능을 없애는 최적화가 아님** — 주행 중 필요한 동기화는 유지.
2. **일시정지·백그라운드·저배율 LOD**에서는 쓰기·구독·읽기를 줄일 것.
3. **Presence(생존·소속)**와 **Live(좌표·진행률)**를 분리해 설계할 것.
4. **자문·시니어 검토 사항**을 코드와 정책에 반영하고, **남은 리스크와 향후 과제**를 문서로 고정할 것.

---

## 2. 자문단·시니어 의견 요지 (반영 기준)

| 주제 | 핵심 메시지 | 본 조치에서의 반영 |
|------|-------------|---------------------|
| Firestore 역할 | 세션·메타·느린 동기에 적합. 초당 위치·RPM류는 비효율 | `running` 전용 라이브 쓰기, 이동·시간 트리거, coarse 좌표 |
| Presence vs Live | 한 문서에 실시간 좌표까지 묶지 말 것 | 코스: 하트비트와 `mergeCourseMemberLiveLocation` 분리, 정책별 주기 |
| LOD | “사람이 있다” vs “정확히 어디” 분리 | 월드 힌트 단일 문서 + 줌 기준 HUD, 동행은 진행률·거친 좌표 |
| Listener | 컬렉션 전체 스냅샷 + 백그라운드 구독이 읽기 폭증의 주범 | `visibility` 시 **구독 해제** 유지 |
| delete / recreate | 탭 전환마다 delete·재생성은 **쓰기 churn·UX 깜빡임** | **가시성 ≠ 이탈**로 분리 후, **실제 이탈 시에만 delete** |
| 월드 집계 | 단일 집계 문서 + 저빈도 폴링은 적합, 집계 **생성은 서버**가 담당하는 것이 정석 | 클라이언트는 `getDoc` 폴링만 — **집계 파이프라인은 미구현(향후 과제)** |
| 장기 | 동접·초고빈도는 RTDB·Redis·WS 등 **비영속 레이어** 검토 | 문서화만 — 구현 범위 밖 |

---

## 3. 진행 과정 (요약 타임라인)

1. **현황 분석**  
   - Blaze 사용량, 자문 Q&A 기준으로 **의심 패턴**(주기 쓰기, presence, `onSnapshot` 범위, pause 시에도 쓰기 지속 등)을 코드와 대조.
2. **1차 구현 (LOD·상태·가시성·트리거)**  
   - `rideSyncPolicy.ts`에 상수·거리·진행률·시간 임계값·coarse 좌표 정책 집약.  
   - `running`일 때만 라이브 코스 진행률·동행 좌표 동기화.  
   - `useDocumentVisibility`로 백그라운드 시 **리스너·주기 쓰기** 완화.  
   - `firestoreWorldPresence.ts` + `appMeta/worldPresence` 읽기 전용 규칙 + 줌 조건 HUD.  
   - 로그아웃 후 **맵 유지·선택 로그인**(세션 UX) 등 별도 제품 요청 반영(부하와 직접 무관하나 동일 기간 작업).
3. **자문·시니어 점검 반영**  
   - 1초 타이머가 **로컬 판단만**인지 확인 → **Firestore read 없음** 확인.  
   - **visibility 시 delete**의 부작용(churn·깜빡임) 지적 → **구독만 해제·문서 유지**, **delete는 room/course 변경·비활성·언마운트**로 한정하는 패치로 2차 수정.
4. **일단락**  
   - 본 문서로 범위·성과·한계·향후 과제를 고정.  
   - 실제 비용 감소는 **콘솔 Usage 그래프**로 사후 검증 필요(운영 과제).

---

## 4. 구현 요약 (정책·계층)

### 4.1 계층별 동작 (시니어 정리표와 정합)

| 계층 | 동작 요약 |
|------|-----------|
| **Presence** | 코스/로비 멤버 문서는 **이탈 시에만 삭제**. 백그라운드에서는 **유지** + 하트비트는 포그라운드에서만(로비). 코스는 주행/일시정지에 따라 하트비트 주기 차등. |
| **Live position** | **`rideStatus === "running"`** 이고 포그라운드일 때만 Firestore 반영. **이동·진행률·최대 간격** 조건 충족 시에만 `setDoc`/`merge`. |
| **Background** | **`onSnapshot` 해제**로 읽기 유입 차단. 라이브 좌표는 `merge … null`로 제거. **문서 delete는 하지 않음**(2차 수정). |
| **World summary** | `appMeta/worldPresence` **단건 `getDoc`**, 줌 이하일 때만 **90초 폴링** — `onSnapshot` 없음. |
| **Coordinate** | 동행 라이브 저장 시 **소수점 3자리**로 반올림(coarse). |
| **Write trigger** | 거리(약 50m)·진행률(약 1%p)·시간 상한(최대 10초 등) 조합 + 로비 진행률은 별도 Δ·최소·최대 간격. |
| **Delete** | **실제 이탈**(방/코스/uid 변경, 로비 비활성, 컴포넌트 언마운트, 명시적 로비 나가기/로그아웃)에서만 `deleteDoc`. |

### 4.2 주요 코드 위치 (참고용)

| 파일 | 역할 |
|------|------|
| `apps/web/src/lib/rideSyncPolicy.ts` | 간격·임계값·coarse 좌표·줌·월드 폴링 상수 |
| `apps/web/src/hooks/useDocumentVisibility.ts` | `document.visibilityState` |
| `apps/web/src/components/CourseSharedPresence.tsx` | 코스 멤버 구독·하트비트·라이브 좌표·이탈 시에만 delete |
| `apps/web/src/hooks/useLobbyRoomSession.ts` | 로비 구독·하트비트 vs 이탈 시 delete 분리 |
| `apps/web/src/hooks/useLobbyLiveCourseRidePublisher.ts` | 로비 `liveCourseRides` 진행률 — `running` + 가시성 + Δ 기반 |
| `apps/web/src/lib/firestoreWorldPresence.ts` | 월드 집계 문서 읽기·HUD 문구 포맷 |
| `apps/web/src/App.tsx` | `pageVisible` 전달, 줌·월드 힌트, `courseLiveProgressRatio` 등 조합 |
| `apps/web/src/components/maphud/MapHud.tsx` | 월드 힌트 한 줄 표시 |
| `firestore.rules` | `appMeta/worldPresence` 읽기 전용 |

---

## 5. 개선 효과 (기대) 및 검증 방법

### 5.1 기대 효과

- **쓰기**: pause/백그라운드에서의 불필요한 진행률·좌표 반복 제거 + 이동 기반 스킵 + delete churn 제거.
- **읽기**: 백그라운드에서 리스너 해제로 **스냅샷 유입 차단**; 월드는 저빈도 단건 읽기.
- **UX**: 탭 전환 시 **문서 삭제로 인한 깜빡임·재참가 비용** 완화.

### 5.2 반드시 할 운영 검증 (당장 중요 — 시니어 지적)

1. Firebase Console → **Firestore → Usage**에서 **read/write 추이** 확인(배포 전후 비교).
2. **같은 room**에서 소수 사용자·다수 사용자(가능 시) 시나리오로 **스냅샷 read** 체감.
3. **백그라운드 4분(`LOBBY_STALE_MS`)** 경과 후 타인 화면에서의 표시(비활동 처리)가 제품 기대와 맞는지 확인.

---

## 6. 남아 있는 리스크 (인지된 한계)

1. **`rooms/{roomId}/members` 전체 `onSnapshot`**  
   - 방 단위로는 한정되어 있으나, **멤버 수 증가 시** “한 명 변경 → 타인 리스너 비용” 패턴은 남음.  
2. **`coursePresence/{courseId}/members` 전체 스냅샷**  
   - 동일 구조. 코스별로 분리된 것은 완화 요인.  
3. **백그라운드에서 하트비트 중단**  
   - `lastSeen` 갱신이 멈춰 **최대 약 4분** 후 비활동으로 보일 수 있음 — “잠깐 전환”에 대한 **표현(회색·background 상태)** 은 아직 없음.  
4. **`mergeCourseMemberLiveLocation(null)`**  
   - 백그라운드 전환 시 **소규모 쓰기**는 남음. delete 대비 안전하지만, **완전 0은 아님**.  
5. **`appMeta/worldPresence`**  
   - **집계 데이터 생성 파이프라인 없음** — 수동/배치 없으면 HUD는 기본 문구·0 카운트에 가깝게 동작.

---

## 7. 향후 과제 (우선순위 가이드)

### 7.1 단기 (운영·제품)

| 과제 | 설명 |
|------|------|
| **Usage 모니터링** | read/write 그래프로 본 조치의 실제 절감 확인. |
| **presenceState 세분화** | `foreground` / `background` / `idle` / `running` 등 필드 또는 표현 규칙 — **UX(회색 아바타 등)** 와 stale 정책 정합. |
| **백그라운드 1회 touch** | 삭제 없이 `lastSeen`만 갱신할지, debounce할지 — **쓰기 1회 vs stale 체감** 트레이드오프 검토. |

### 7.2 중기 (스키마·서버)

| 과제 | 설명 |
|------|------|
| **worldPresence 서버 집계** | Cloud Functions + Scheduler 등으로 `regions[].activeCount` 갱신. 클라는 **읽기만** 유지. |
| **room / listener 분할** | `viewport`·`grid`·`activeNearby` 단위 쿼리로 **스냅샷 fan-out** 완화(규칙·인덱스·데이터 모델 설계 필요). |
| **merge null 빈도** | 탭 빈번 전환 시 중복 방지를 위한 **debounce** 또는 “이미 null이면 스킵” 클라이언트 가드. |

### 7.3 장기 (아키텍처)

| 과제 | 설명 |
|------|------|
| **Ephemeral realtime layer** | 고동접·초고빈도 위치·RPM 등은 **RTDB / Redis / WebSocket** 등으로 이전하고, Firestore는 **세션·요약·감사**에 집중. |
| **Oracle 등 이전 시** | 동일하게 **고빈도 스트림 vs 집계** 분리 원칙 유지. |

---

## 8. 일단락 선언

- **클라이언트 측 Firestore 부하 경감 1차 조치**는 본 보고서 범위까지 **일단락**으로 한다.  
- 추가 최적화는 **콘솔 지표 검토 후** 우선순위를 정해 **§7 향후 과제**에서 이어간다.  
- 자문단·시니어 의견 중 **반영 완료**(running 전용, movement+time, coarse, visibility unsubscribe, 월드 단건 폴링, delete churn 제거)와 **미반영·보류**(서버 집계, room 스냅샷 구조 개편, 비영속 레이어)를 위 표와 구분해 관리한다.

---

## 9. 참고

- 관련 구현 커밋은 저장소 `main` 브랜치 히스토리에서 `feat(sync)`, `fix(presence)` 등 메시지로 추적 가능.  
- Rules 배포: `firebase deploy --only firestore` — `appMeta/worldPresence` 문서는 콘솔 또는 배치로 시드 후 HUD가 의미 있는 숫자를 표시할 수 있음.

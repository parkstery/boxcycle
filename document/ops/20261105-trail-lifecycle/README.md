# 20261105-trail-lifecycle — Trail 진입·주행·나가기·찾기

| 항목 | 내용 |
|---|---|
| 상태 | LOCAL_VERIFIED(P1~P4)·미배포 — F5 지도에서 찾기는 남음. Chief 11-05 「승인한다. 구현하라」 |
| Supervisor | Claude Code (클라우드 세션, PR [parkstery/boxcycle#22](https://github.com/parkstery/boxcycle/pull/22) 브랜치 `claude/charming-johnson-1y9stx`) |
| 시안 | Design 캔버스 「Trail 진입·주행·나가기 시안」 ①~⑨ (Chief 승인) |

## 결정 (Chief 11-04~05)

| # | 결정 |
|---|---|
| D1 | 상태 넷: **Trailhead · Trail 대기 · 주행 중 · 일시정지**. 「주행 종료」와 「Trail 나가기」를 분리한다 |
| D2 | 주행 종료(완주 포함) 후 Trailhead 로 내보내지 않고 **같은 Trail 대기**로 남는다. 결과 창: 「Trail 나가기」 / 「닫기」 |
| D3 | 나가기는 대기에서. 주행 중·일시정지에서 누르면 「주행을 끝내고 나갈까요?」 → 종료하고 나가기 |
| D4 | 재진입 시 **이어 달리기 기본**(「N km부터 이어 달리기」/「처음부터」). 완주한 Trail 은 「처음부터 다시」 |
| D5 | 빈 Trail 유예 **10분**: 아무도 달리지 않는 Trail 은 참여했던 사람의 「최근 내가 달린 Trail」 에 10분 남는다(나만 보임) |
| D6 | 대기 중인 사람은 목록 인원·동행에 **세지 않는다** — 목록 인원 = 주행 중(live ride) 인원 |
| D7 | 일시정지 **10분** 지속 시 자동 주행 종료 → 대기 |
| D8 | 개설자 특권 없음(공개 전환만). 개설자가 나가도 Trail 은 닫히지 않는다(09-27 결정 유지) |
| F1 | Trail 찾기: 기본 = **내 대표 국가 · 사람 많은 순 · 5개**, 「Trail 찾기 · 전 세계 N개 ›」 로 전체 |
| F2 | 같은 경로 Trail 은 한 줄로 묶는다(펼치면 Trail 별 인원·지점·합류) |
| F3 | 거리 구간 ~5 / 5–15 / 15–40 / 40+ km, 예상 시간 ~20 / 20–45 / 45분+ (내 평균 속도 기준) |
| F4 | 범위: 세계 › 대륙 › 국가(순위 범위와 같은 결), 장소 검색, 대륙·국가별 Trail 수 |
| F5 | 지도에서 찾기(지역 묶음) 포함 |

## 단계

| 단계 | 내용 | 데이터 변경 |
|---|---|---|
| P1 | D1·D2·D3·D7 + 상태 표시(메뉴·지도) | 없음 |
| P2 | D4·D5 — Trail 별 내 진행 저장, 이어 달리기, 최근 내가 달린 Trail(10분) | `trails/{id}/members/{uid}` 진행 필드(Rules 확인) |
| P3 | D6 — 목록 인원 = live ride | functions `openTrailListingCore` + 웹 재계산 동일 |
| P4 | F1~F5 — Trail 찾기 | 목록 문서 지역 필드(G4, 배포됨 004e4261) 사용 |

배포는 별도 Chief 승인(functions 포함 시 대상 함수 명시).

## 구현 (2026-11-05, Claude Code 클라우드)

| 단계 | 파일 | 내용 |
|---|---|---|
| P1 | `src/app/useTrailLifecycle.ts`, `App.tsx`, `TrailHubPanel`, `RideSummarySheet` | 종료 후 공개 Trail 대기 잔류·결과 창 「Trail 나가기」, 메뉴 상태 칩(대기·주행 중·일시정지)·「나가기」 확인, 일시정지 10분 자동 종료, Trail 진입 검증 Trail 당 1회, 대기 중 경로가 바뀌면 Trail 에서만 나감 |
| P2 | `lib/trail/recentTrails.ts`, `src/app/useTrailRecent.ts`, `TrailStartChoice`, `TrailGlanceList` | Trail 별 내 진행·최근 목록(기기 저장), 「N분 남음」·「다시 들어가기」, 이어서/처음부터·완주 「처음부터 다시」 |
| P3 | `functions/src/openTrailListingCore.ts`, `firestoreOpenTrailListings.ts` | 목록 인원 = live ride 만(서버·웹 재계산 같게). 웹 재계산의 members 읽기도 빠진다 |
| P4 | `lib/trail/trailFinder.ts`, `lib/trail/repo/trailFinderListings.ts`, `TrailFinderSheet`, `useTrailGlanceTab` | 오른쪽 목록 = 대표 국가·사람 많은 순 5개 + 「Trail 찾기 ›」. 찾기 판: 범위(세계·대륙·국가, 나라 이름 검색, 대륙 버튼 수, 대륙 → 나라 순위), 거리·예상 시간 구간, 같은 경로 묶음, 정렬, 더 보기. 색인 4개(`geoContinent|geoCountry` × `riderCount|createdAt`) |

### 해석·차이 (Chief 확인 필요 시 알림)

- **D2 는 공개 Trail 에만**: 비공개 Trail(내 경로·임시 경로 혼자 주행)은 종전대로 종료 후 Trailhead — 「여기에서 계속」 카드 흐름이 그 위에 있다.
- **최근 목록·진행은 기기 저장**(localStorage, 사용자별): 참가자 문서는 presence 라 나갈 때 지워진다. 10분 창구라 서버 문서·Rules 변경 없이 간다. 다른 기기에서는 안 보인다.
- **「지금 달리는 사람이 있는 Trail 만」 체크 생략**: D6 로 목록 자체가 주행 중 Trail 만이라 의미가 없다.
- **장소 검색은 나라 이름까지**: 도시·경로 이름 검색(지명 검색 재사용·G2 제목)은 다음.
- **F5 지도에서 찾기 미구현**: 지도 묶음 표시는 MapView 쪽 작업 — 다음 단계.

### 시험

- 단위: `scripts/trail/recent-trails.test.ts` 7, `trail-finder.test.ts` 6.
- 실앱+에뮬레이터 `e2e/trail-join-leave-menu.spec.ts`(`npm run test:e2e:trail-join`) 5건: 합류·나가기, 종료 후 대기·재시작·결과 창 나가기, 주행 중 나가기 확인, 최근 목록·이어 달리기, Trail 찾기.
- 사보타주: 줄 클릭 합류·경로 해제(앞 커밋), 「종료하고 나가기」 의 메뉴 닫기 누락이 결과 창을 덮던 결함을 시험이 잡았다.
- 기존 실패(변경 전 main2 동일 확인): `ride-continuation` RC1·RC2·RC3·RC13 — 주행 중 5초 버튼 숨김 뒤 「주행 종료」 를 못 누름.
- 미검증: 일시정지 10분 자동 종료(타이머만, 실시간 시험 없음), 색인 배포 전 운영 쿼리.

### 배포(Chief 승인 필요)

`firebase deploy --only firestore:indexes,functions:openTrailListingOnTrailWritten,functions:openTrailListingOnMemberCreated,functions:openTrailListingOnMemberDeleted,functions:openTrailListingOnLiveCourseRideCreated,functions:openTrailListingOnLiveCourseRideDeleted` 뒤 Hosting. 색인이 만들어지기 전에는 Trail 찾기 범위 조회가 실패한다(세계 범위는 단일 필드라 동작).

## 기록

- 2026-11-05 착수 · P1~P4 구현.

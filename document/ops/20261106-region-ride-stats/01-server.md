# 01 서버 지시서 — 지역별 주행 거리 기록 (impl-standard)

작업 폴더 `C:\20.HDev\boxcycle\functions` (Bash 는 `export PATH="/c/Program Files/nodejs:$PATH"`). 공통 계약 [README](README.md) 를 먼저 읽어라.

금지: git commit/push/restore/stash/worktree/clean·checkout -- 경로, `.out/` 수정, **운영 Firestore 실행**(소급 CLI 는 에뮬레이터·코드·합성 시험까지만), 배포, apps/web 수정. 비추적 파일 삭제 금지. 한국어 보고.

## 구현

1. **계산 순수 모듈** `src/rideRegionDistances.ts`(신규, Firestore import 금지): 주행 문서의 `conquest.cells`(`[{id:"20_x_y", m}]`)에서 묶음(z12, `conquestOnRideCreated.ts` 의 `chunkIdOfCellId`·`sanitizeCells` 와 같은 규칙 — 중복 구현 금지, 필요하면 export 해서 재사용) → 묶음별 거리 합 → `conquestRegion.ts` 의 `chunkCenterLngLat`·판정기(`resolveGeoRegion`, 인자로 주입)로 지역 → `[{country, admin1, meters}]`(같은 쌍 합침). 정수 반올림은 합계가 round(셀 거리 합)과 같도록 `splitMetersByWeight` 류 최대잉여법. 상한(묶음 160·국가 6·행정구역 20)과 판정 예외 격리는 `conquestRegion.ts` 의 `REGION_MAX_*`·`planRegionAccounting` 패턴을 따라 `planRideRegionDistances(cells, resolve)` → `{ regionDistances: RegionDistance[] | null, skipped }` (null = 필드를 쓰지 않음). 바다(country null)는 regionDistances 에는 남기되 rideRegions 에는 쓰지 않는다. 또 시간 배분 함수 `secByRegion(elapsedSec, regionDistances, distanceMeters)`(합계 보존).
2. **트리거** `src/mileageOnRideCreated.ts` 의 `applyMileageInTransaction`: 기존 `tx.update(rideRef, { mileageApplied: true })` 와 **같은 update 한 번**에 `regionDistances`(null 이면 키 생략)를 넣고, 같은 트랜잭션에서 `conquest/{uid}/rideRegions/{scopeCode}` 를 `set(..., {merge:true})`: `{ scopeType, meters: increment, sec: increment, rideCount: increment(1) }`. 국가 문서와 행정구역 문서 둘 다(`toScopeTotals` 와 같은 규칙, 단 meters·sec 는 지역 거리 기준). 기존 `mileageApplied` 멱등 가드 안에서만 쓴다(재시도 중복 방지). 거리 0 또는 셀 없음이면 지역 쓰기 없음. 기존 마일리지 누적(users)·guestLifecycle 게이트 동작은 그대로 — 지역 계산 실패가 마일리지를 막으면 안 된다.
3. **Rules** `../firestore.rules` 의 `match /conquest/{userId}` 안에 `rideRegions/{scopeCode}` 본인 읽기·쓰기 불가를 추가(`regions` 와 같은 꼴, 주석 한 줄). 에뮬레이터 시험 `apps/web/scripts/conquest/regions-rules.emulator.mjs` 에 rideRegions 케이스 3개(본인 읽기 허용·남의 읽기 거절·본인 쓰기 거절) 추가하되 **apps/web 의 이 파일만** 수정 허용. 실행: 폴더 `C:\20.HDev\boxcycle\apps\web` 에서 `npm run test:conquest-regions:rules`(npm 이 안 되면 `node` 로 emulators:exec 직접 — PATH 앞에 nodejs).
4. **계정 삭제·게스트 정리 등록**: `src/accountDeletionCore.ts` 의 `ACCOUNT_DELETION_SUBCOLLECTIONS` 에 `"conquest/{uid}/rideRegions"`, `src/purgeGuestUsersCore.ts` 의 `deleteGuestUidFirestoreData` 에 같은 컬렉션을 `regions` 와 같은 방식으로 추가, `guestLifecycleDelete.test.ts` 가짜 DB 에 `/rideRegions` 케이스 추가.
5. **소급 CLI** `src/cliBackfillRideRegionDistances.ts` + 순수 계획 모듈(필요 시 `rideRegionDistances.ts` 재사용): 기존 `cliBackfillConquestRegions.ts` 의 안전장치(기본 dry-run, `--apply`, 운영은 `--confirm-prod`, `--uid=`, `--limit=`, 요약 JSON)를 그대로 따른다. 사용자별: `rides` 에서 `userId==uid` 주행을 읽어 `regionDistances` 없는 것은 계산해 주행 문서에 `update`(필드만), 그다음 그 사용자의 `rideRegions` 를 **전체 재계산해 set(덮어쓰기)** — 모든 주행의 `regionDistances`(방금 계산한 것+이미 있던 것) 합으로 meters·sec·rideCount. 라이브 트리거와의 경합은 `cliBackfillConquestRegions.ts` 가 쓴 방식(요약 문서 `updateTime` 확인 후 재시도, 최대 3회)을 같게 적용하되 요약 문서는 `conquest/{uid}`. 멱등(두 번 돌려도 같은 결과). 요약: 대상 사용자 수·주행 수·계산한 주행 수·셀 없어 건너뛴 주행 수·상한으로 건너뛴 주행 수·쓴 문서 수·합계 검산(사용자별 국가 meters 합 ≤ 주행 거리 합, 바다 제외 차이만 허용) 불일치 수. `package.json` 에 `admin:backfill-ride-region-distances` 스크립트(기존 admin:backfill-conquest-regions 꼴) 추가. **운영 실행 금지** — 에뮬레이터 합성 시험(가능하면)과 dry-run 인자 파싱까지.
6. **시험(npm test 목록 `package.json` 에 등록)**: 순수 모듈(서울+파리 셀 → 지역 합계=거리 합·바다 처리·상한 초과 null·판정 예외 null·시간 배분 합계·멱등), 트리거 가짜 tx(분명히 regionDistances 가 mileageApplied 와 같은 update 에 들어가고 rideRegions 4건이 increment 로 set, 지역 계산 실패 시 마일리지 쓰기는 그대로·regionDistances 키 없음), 소급 계획 순수 시험. 사보타주 3종(합계 깨기·상한 제거·try/catch 제거)이 FAIL 하는지 확인 후 복원.
7. 검증: `npx tsc` 0, `npm test` 전부 통과(현재 282), 변경 파일 eslint 0.

## 보고

변경 파일, 명령별 통과 수, 사보타주 결과, 에뮬레이터 시험 여부, 계획과 달라진 점, 막힌 점. 계약(README)과 다르게 만든 곳이 있으면 반드시 적어라.

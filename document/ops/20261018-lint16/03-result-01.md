# 결과01 — 기존 시험 lint 오류16건 수정

| 항목 | 내용 |
|---|---|
| 문서 유형 | result — 구현·검증 결과 |
| 작성 | 2026-10-18 |
| 상태 | DEVELOPMENT_DONE |
| 독자 | chief · Supervisor |
| 연결 문서 | [묶음](README.md) · [지시01](02-task-01.md) |

## 실행 환경

| 항목 | 값 |
|---|---|
| 모델 | OpenCode LongCat (`opencode/longcat-2.5-preview-free`) |
| cwd | `C:\20.HDev\boxcycle` |
| branch | `main2` |
| HEAD | `0936cfe910c4a826c9b829a529478a2f9950d5f2` |
| 시작 시 dirty | entry-location 브랜딩 관련 수정·신규 파일 다수(본 작업 4파일 제외 모두 보존) |

## 변경 파일별 의미 보존

### 1. `ride-result-f2-boundary.test.ts` (2오류)

- **`resumeMeters`**: 세 번째 테스트(0.97 cap)에서 `resumeMeters`를 assertion에 추가(`assert.equal(resumeMeters, 970, "resume 970m (capped)")`). 0.97 cap·970m 검증 강화.
- **`geometryLength`**: 두 번째 테스트(Dual-length)에서 `geometryLength` 검증 추가(`assert.equal(geometryLength, 1200)` + `assert.notEqual(geometryLength, routeDistanceMeters)`). 두 길이 fixture 실제 검증.

### 2. `ride-result-f2-card-resume.test.ts` (1오류)

- **`geoLen`**: CP1 Dual-length 테스트에서 `geoLen` 검증 추가(`assert.ok(Math.abs(geoLen - 1200) < 100)` + `assert.notEqual(geoLen, routeDistanceMeters)`). 실제 geometry 길이와 routeDistance 다름 검증. card/Go 동등성 assertion 유지.

### 3. `ride-result-s1-timers.test.ts` (11오류)

- **`subscribeCount`**: 첫 번째 테스트에서 `subscribeCount` assertion 추가(`assert.equal(subscribeCount, 1, "subscribe called once on activate")`). 구독 호출1회 검증.
- **`mockRideWriter`**: 불필요 선언 제거. 기존 assertion·구독·재조회 경로 보존.
- **`as any` 9곳**: `fakeFirestore()`·`fakeSnapshot()` helper로 정리. `unknown` 경유 cast 사용(`as unknown as Firestore`, `as unknown as DocumentSnapshot`). Firebase 타입 활용, lint disable 없음.

### 4. `ride-result-s2-end-snapshot.test.ts` (2오류)

- **`persistedData`**: 첫 번째 테스트를 async로 변경하고 `await new Promise(...)` 후 `persistedData` assertion 추가. 캡처된 저장값(1000m·600s) 검증. 타이머 유지.
- **`asyncSave`**: 두 번째 테스트를 async로 변경하고 `await asyncSave()` 후 `savedRatio` assertion 추가. 비동기 저장 경로 실제 await.
- **세 번째 테스트**: async로 변경하고 `await new Promise(...)` 후 `progressToSave` 불변 추가 검증. 타이머 유지.

## 검증 결과

| 명령 | 종료코드 | 결과 |
|---|---|---|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test (4개 파일)` | 0 | **17시험·4suite·17 PASS·0 FAIL** |
| `npm run lint` | 0 | **0 errors, 40 warnings** (기존 경고 그대로) |
| `npm run build` | 0 | 통과 (chunk size·undefined import 경고는 기존과 동일) |
| `node scripts/check-document-system.mjs` | 0 | 231 files checked, 0 broken links, 0 errors |
| `git diff --check` | 0 | 통과 (LF/CRLF 경고는 기존 파일들의 것) |

## 잔여 경고

lint 경고 40건은 모두 기존 항목(react-hooks/exhaustive-deps, unused eslint-disable directive 등)이며, 이번 작업 범위 외입니다. 지시문에서 경고 정리는 범위 외로 지정되었습니다.

## 미완/한계

없음. 모든 필수 검증 통과, 제품 소스·설정·의존성 변경 없음, 다른 작업 변경 보존됨.

## 재현 명령

```powershell
# 관련 시험 17개
Set-Location 'C:\20.HDev\boxcycle\apps\web'
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-result/ride-result-f2-boundary.test.ts scripts/ride-result/ride-result-f2-card-resume.test.ts scripts/ride-result/ride-result-s1-timers.test.ts scripts/ride-result/ride-result-s2-end-snapshot.test.ts

# 전체 lint
Set-Location 'C:\20.HDev\boxcycle'
npm run lint

# build
npm run build

# 문서 시스템 검사
node scripts/check-document-system.mjs

# diff 체크
git diff --check
```

## 변경 diff 요약

```
 ride-result-f2-boundary.test.ts    |  3 ++
 ride-result-f2-card-resume.test.ts |  4 ++
 ride-result-s1-timers.test.ts      | 61 +++++++++++++---------
 ride-result-s2-end-snapshot.test.ts| 30 ++++++++---
 4 files changed, 65 insertions(+), 33 deletions(-)
```

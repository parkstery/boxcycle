# 퍼블릭 코스 4개 공개 등록·릴리스

수행: Codex · 2026-11-19. Chief: 「공개등록해. 커밋 푸시 배포해」.

## 등록 완료

기존 관리자 입문 코스 seed와 같은 `routePublications` 스냅샷 계약으로 운영 Firebase `boxcycle-dc2df`에4개를 신규 생성했다. 관리자 카탈로그이므로 `applicantUid`·`sourcePublicRouteRequestId`는 빈 문자열이며 사용자 계정·가짜 주행·완주 기록을 만들지 않았다. 소유자 없는 운영 코스의 기존 방식이다. 새 스키마·Rules 변경 없음.

| 국가 | 공개 코스 | 등록 거리km(좌표 합산) | publicationId |
|---|---|---:|---|
| KR | 여의도 한강 · 양화대교에서 여의도 동쪽 | 6.409 | public-kr-yeouido-hangang-20261119 |
| GB | 리치먼드 파크 · 도로 순환 | 10.915 | public-gb-richmond-park-20261119 |
| TW | 일월담 · 호수 순환 | 27.814 | public-tw-sun-moon-lake-20261119 |
| FR | 안시 호수 · 시계방향 순환 | 40.497 | public-fr-lake-annecy-20261119 |

Directions 계산값6.416/10.927/27.845/40.542km와 구분한다. 등록 snapshotDistanceMeters는 서버와 같은 haversine 좌표 합산값이다. geometry SHA256·지문·duration·국가/광역지역은 `publication-plan.json`·`publication-result.json`에 있다.

현실 공사·통행 제한은 Chief 지시대로 제외/보류 조건에서 뺐다. 아라는 광역지역 코드, 암스텔은 강변 경로 품질 때문에 이번 등록에서 제외했다.

## 보호·검증

- `publish.cjs`는 기본 dry-run이며 적용 시 검토한 plan hash가 필수다. 기존 동일 ID의 데이터가 다르면 중단하고 덮어쓰지 않는다. 신규4개만 하나의 Firestore transaction으로 create했다. 삭제·기존 문서 변경 없음.
- 적용 직전 공개39개·심사 대기0개 전수 재조회 후 동일 profile 유사도90% 차단을 적용했다. 길이·좌표·밀도·bbox·제목/소개 구조·금칙어·개인정보·국가·검수 geometry hash를 확인했다.
- 서버의 기존 listing 트리거가4개 요약을 생성한 뒤 원본/목록을 재조회했다. **공개43개·목록43개·총 원본48개, 국가9개**. KR32 / JP2 / US2 / KP1 / NL1 / FR2 / GB1 / TW1 / CA1.
- 기존44개 문서의 geometry·제목·거리·status 모두 보존. 신규4개 geometry hash·국가·등록 거리·목록 거리·ID 일치. 증거: `publication-verification.json`.
- 관리자 인증 없이 Firestore REST로 원본4개·목록4개 **8/8 HTTP200** 및 제목 일치 확인. 목록이 관리자에게만 보이는 상태가 아님을 검증했다.
- 등록 전 오프라인106검사, 실제 Mapbox/제품 카메라60관측·DEM432점은 검증 문서 참조. `verify-publications.cjs`는 운영 읽기 전용 재검사다.

## Git·배포

- 등록·검증 소스 커밋: `ecf600c717e294fed136d9fbab6336fac55849e7`. 추천 기록 `1ecd0258`과 함께 origin/main2에 푸시 완료.
- 이번 후보 묶음·검수 도구와 이 작업의 HANDOFF 항목만 선별했다. 공용 HANDOFF의 타 작업 미커밋 내용은 작업 트리에 보존하고 index에는 기존 커밋 내용에 이번 항목만 반영했다. 오래된 완료 기록을 원본 묶음 링크로 압축해 커밋 사본도8KB 이내로 유지했다.
- Git 원본 pre-commit ESLint 통과. 원본 pre-push를 커밋 사본에서 실행해 의존성·DB 통로·도구 등록·tsc·동행 회귀·진입 셀렉터21·정련·전체quick **1567/0** 통과. 커밋 사본 오프라인106검사도 통과. 기존 도구 만료 경고8개 유지. 전체quick 제외5파일은 기존 에뮬레이터·하네스다.
- 사본: `C:\20.HDev\boxcycle\tmp\public-route-release-20261119\snapshot`. `git archive HEAD` 추출의 정규 파일 **7,173개**를 아카이브와 바이트 단위로 대조했다. 설치된 node_modules와 변경 없는 functions/lib는 junction으로 재사용하고 production env만 출력 없이 복사했다. 타 작업 미커밋 제품 코드는 사본에 없다.
- 이 사본에서 `npm run deploy:hosting` 성공. **Hosting release complete** 확인. 함수·Rules 배포 없음. tsc·Vite build 통과, 기존 큰 chunk 경고 유지.
- 운영 HTTP200·HTML 및 에셋17개가 빌드와 바이트 단위 일치. HTML no-cache 확인. 진입 번들 `assets/index-3GBKEZ_r.js`는 직전4c1f2ef0 배포와 같다. 이번 변경은 카탈로그 데이터·검수 도구·문서이며 제품 실행 코드는 바꾸지 않았다.
- 운영 Ego 브라우저: `Spinatlas` React root·지도/canvas 초기화, 브라우저 안에서 신규4개 공개 목록을 읽어 국가·거리·제목 확인. 로그인·주행·센서 조작 없음. 물리 폰·실센서 주행은 미실행.
- 증거 사본: 이 묶음의 `source-verification.json`·`hosting-verification.json`·`browser-verification.json`. 배포 소스는 위 ecf600c7이며 이후 릴리스 결과 문서 커밋은 제품 빌드에 영향을 주지 않는다.

증거: `tmp/public-route-release-20261119/source-verification.json`, `push.log`, `hosting-deploy.log`. 사본에 junction이 있으므로 재귀 삭제하지 않는다.

## 실행·확인

```powershell
Set-Location C:\20.HDev\boxcycle
node document/ops/20261119-public-route-candidates/verify-artifacts.cjs
node document/ops/20261119-public-route-candidates/verify-publications.cjs
```

운영: https://boxcycle-dc2df.web.app/ → 새로고침 → 퍼블릭 목록 → 세계 또는 국가 KR/GB/TW/FR → 위4개 이름·등록 거리 확인 → 코스 불러오기. 실제 센서 주행을 이번 확인에 포함하지 않는다.

배포 재현 명령(실행 폴더는 위 커밋 사본):

```powershell
Set-Location C:\20.HDev\boxcycle\tmp\public-route-release-20261119\snapshot
& 'C:\Program Files\nodejs\npm.cmd' run deploy:hosting
```

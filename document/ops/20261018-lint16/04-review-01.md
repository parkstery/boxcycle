# 감리01 — 기존 lint16 오류 제거

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — Supervisor 독립 감리 |
| 최초 작성 | 2026-10-18 |
| 상태 | APPROVED — 요청 범위 구현·검증 완료 |
| 독자 | chief · Developer |
| 연결 문서 | [결과01](03-result-01.md) · [지시01](02-task-01.md) · [묶음](README.md) |

## 판정

OpenCode LongCat(`opencode/longcat-2.5-preview-free`, 세션 `ses_eb339a99dffe6PUzsfMa2Wa4nr`)이 지정한 시험4파일만 수정했다. Codex는 지시·실제 diff·독립 시험/lint/build·기존 변경 보존 여부를 감리했다. 전체 lint 오류16건은 0건으로 줄었고 종료0이다. 기존 경고40건은 유지했다. 제품 소스·설정·의존성·규칙 억제 변경 없음. 커밋·push·배포 없음.

## 구현 검수

- F2 boundary: 미사용 재개 거리970m와 두 길이 fixture를 assertion에 사용했다. cap·기존 진행률/좌표 검증 유지.
- F2 card-resume: 실제 geometry 길이가 routeDistance와 다름을 확인하며 기존 card/Go 좌표 동등성 검증 유지.
- S1 timer: 실제 구독1회 assertion 추가. 명시적 any9곳을 test-local fakeFirestore/fakeSnapshot helper로 모으고 Firebase 타입에 대한 unknown 경계 cast로 한정했다. 반환 객체의 기존 exists/data/id 값과 fake clock 동작 유지. 호출되지 않던 mockRideWriter 선언만 제거하고 const로 정리. 이 read-only 시험은 기존의 모의 sentinel 검증이며 실제 Firestore 쓰기 차단 검증으로 확대 해석하지 않는다.
- S2 snapshot: 타이머/기존 assertion 유지, 비동기 저장 이후 persistedData를 확인하고 asyncSave 결과를 await했다. 뒤늦은 ref 변경 이후에도 캡처 값 유지 확인. 새로운 실행경로나 제품 동작 변경은 없다.

결과01의 '두 번째 테스트(Dual-length)'는 설명의 순번 오타로 실제 boundary 파일 네 번째 시나리오다. 실제 diff와 시험 이름을 기준으로 검수했다. 시험 이름·개수17개 유지, assertion 호출52→63개(파일별11→14,10→12,26→27,5→10). skip·eslint-disable·ts-ignore·ts-nocheck 추가 없음. [시험 보존 증거](evidence/test-coverage-preservation.json).

## 독립 실행

| 검증 | 결과 |
|---|---|
| 수정 전 대상4파일 ESLint | 종료1, 오류16/경고0. [JSON 원본](evidence/before-eslint.json) |
| 수정 전 관련 시험 | 종료0, 17시험·4suite·17PASS·0FAIL |
| 수정 후 관련 시험(동일 명령) | 종료0, 17시험·4suite·17PASS·0FAIL |
| 루트 npm run lint | 최종 종료0, 오류0/경고40. 개발 중 unused writer 제거로 prefer-const 오류1이 드러났고 LongCat이 const로 수정한 뒤 독립 재실행 PASS |
| 루트 npm run build | 종료0. 기존 chunk 크기·riderRig SADDLE/PELVIS export 경고 유지 |
| node scripts/check-document-system.mjs | 종료0, 깨진링크·구조오류0 |
| git diff --check | 최종 종료0. 중간 S2 신규 빈 줄 공백2건은 LongCat이 제거 후 PASS |

관련 시험은 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test`에 지정4파일을 전달했다. 전체 lint·빌드가 완료된 뒤 수정은 공백 제거뿐이어서 동일 lint/build를 추가 반복하지 않았다. 실제 실행 명령은 아래 재현 절에 있다. 시험만 수정하므로 브라우저·실주행·실기기·Firebase 에뮬레이터는 필요하지 않아 실행하지 않았다.

## 다른 변경 보존

시작 시 미커밋/미추가 파일74개를 SHA-256으로 기록했다. Supervisor 담당 공용 색인 README/PROGRESS 두 파일만 제외하고 **72파일 모두 해시 동일**. Spinatlas·위치 작업의 제품소스/시험/문서/그림도 포함한다. 새 tracked diff는 지정 시험4파일만 추가됐고 다른 tracked 파일 변경 추가 없음. 공용 색인은 이 묶음 상태 한 줄/행만 더했다. [보존 결과](evidence/preservation.json). 실행 전 해시·diff 원본은 폐기 가능한 로컬 산출물에 보관하며 문서는 그 경로에 링크하지 않는다.

## Chief 재현

실행 폴더 전체 경로: `C:\20.HDev\boxcycle`. 오류0과 기존 경고40건 확인:

```powershell
Set-Location 'C:\20.HDev\boxcycle'
npm run lint
npm run build
Set-Location 'C:\20.HDev\boxcycle\apps\web'
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-result/ride-result-f2-boundary.test.ts scripts/ride-result/ride-result-f2-card-resume.test.ts scripts/ride-result/ride-result-s1-timers.test.ts scripts/ride-result/ride-result-s2-end-snapshot.test.ts
```

화면 변경이 없으므로 이번 작업에 별도 접속 주소·UI 확인 절차는 필요하지 않다. 이전 브랜딩·위치 작업의 Chief 확인 상태나 운영 배포 상태는 이번 lint 합격으로 변경하지 않는다.

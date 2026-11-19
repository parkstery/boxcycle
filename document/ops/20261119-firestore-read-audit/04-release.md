# read 절감 1·2차 릴리스

2026-11-20, Codex. Chief 「완성분은 커밋, 푸시, 배포해」 승인.

상태: **DEPLOYED**. 소스 커밋 `112131aa46635f61ff74f4c86d7aa152d90a4ec4`, origin/main2 푸시·Functions/Hosting 배포 완료. 시험 격리·도로망 초기 중복 제거·영속 캐시/변경분 동기화만 선별했다. 서버 대상은 `conquestOnRideCreated`, 웹은 Hosting이다. Rules/색인·운영 데이터 마이그레이션·Guest 정리·동행 전송 구조는 이번 배포 대상이 아니다.

다른 작업의 App/UI·표고/인터벌·도구 변경과 운영 원시 조사 자료는 로컬에 보존한다. 공용 HANDOFF/ops 색인은 기존 커밋에서 이번 작업 부분만 index에 반영한다. 원본 pre-commit/pre-push를 우회하지 않는다. 빌드/배포는 선별 커밋의 별도 사본에서 수행한다.

## 소스 분리·게이트

- 29파일 선별. App.tsx/UI·표고/인터벌·별도 개발 도구/미결정 동행 설계·원시 운영 자료는 포함하지 않았다. HANDOFF의 지난 비용 기록만 원본 묶음 링크로 압축하고 이번 작업 항목을 추가해 커밋 사본도 8KB 이내로 유지했다.
- 사본: `C:\20.HDev\boxcycle\tmp\read-cost-release-20261120\snapshot-3`. Git tree `d65c2dd758dc4cd2b7a2529ec0a67e9beae95855`의 **7,189개 파일을 Git blob과 바이트 단위 대조**했다. 의존성만 junction으로 재사용하고 서버 lib는 사본에서 새로 컴파일했다. production env 파일명만 기록하고 값은 출력하지 않았다. Firebase project=boxcycle-dc2df·emulator 비활성 확인.
- 원본 pre-commit ESLint 통과. 원본 pre-push를 위 사본을 GIT_WORK_TREE로 지정해 실제 push에서 실행했다. lock·의존 방향/순환·DB 통로·부산물·타입·동행 간격/소스 전환·진입 셀렉터21·정련·서버 **305/0**·웹 전체 **1584/0** 통과. 웹 quick은 111.4초, 기존 별도 emulator/하네스 6파일 제외. 이전 작업 트리 1598/0과 달리 타 작업의 미커밋 시험이 제외된 사본 수치다. 기존 도구 만료 WARN 11개.
- 코드 정련 검사는 exports186·types43·반복18로 기준선 이내. 기준선/허용 규칙 변경 없음. 새 시험 격리 설정을 Knip도 평가하므로 **정적 분석 자식에만 loopback emulator env**를 전달하도록 호환 수정했다. 구형 전체 조회 헬퍼와 불필요한 export를 정리했다. 실제 Playwright의 config/globalSetup 차단은 유지한다.
- 실제 FS emulator에서 제품 서버 transaction·제품 쿼리·본인 Rules **1/0**: 최초411 / 동일 버전0 / 변경2+요약확인1. 다른 uid 거부·이전 epoch 제외·구형 writer 감지도 통과했다. production에 가짜 계정/주행/도로망을 만들지 않았다.
- 빌드: 서버 tsc, 웹 tsc/Vite 모두 PASS. 기존 큰 chunk 경고. main bundle `assets/index-CbwdPGWW.js`.

초기 환경 실패는 해결 후 재검했다. Windows tar의 한글 경로 문제는 Python 추출로, core.autocrlf의 archive 줄바꿈 차이는 archive 명령 한 번의 core.autocrlf=false로 해결했다(전역 Git 설정 유지). 첫 push는 사용자 npm shim이 runtime을 찾지 못해 원본 훅이 거부했다. Git Bash 자식의 PATH 앞에 정상 Node.js를 두어 원본 훅을 전부 재실행하고 정상 push했다. `--no-verify`·훅 비활성화·전역 npm 수정 없음.

## 서버·Hosting 운영 확인

- 사본에서 `functions:conquestOnRideCreated`만 배포 성공, Node.js24/2nd Gen/asia-northeast3. 관리 API **ACTIVE**, 새 revision `conquestonridecreated-00036-tuh`, 새 build/source generation 확인. 이전 revision은 00035-cec다. **다른 38개 함수의 updateTime 동일**, 총39개 유지. Firestore 트리거이므로 가짜 이벤트를 만들거나 HTTP 호출로 주행을 흉내내지 않았다.
- 이어서 사본의 Hosting 배포 성공(261개 정적 파일, 신규 업로드11개). Rules·색인·DB·RTDB 배포 없음.
- `https://boxcycle-dc2df.web.app/` HTTP200. HTML 1,372B SHA256 `0d4e584577cc501dc427313d671b5733cd63b5465bb759d1cb78157a3a14d73e`, 로컬 빌드와 동일. no-cache/max-age=0/must-revalidate 확인.
- JS/CSS **17개 전부 HTTP200·bytes·SHA256 일치**. 실제 운영 main bundle에 roadSyncCursor·spinatlas-conquest-cache-v1 존재 확인. 운영 앱 자동 라이딩은 실행하지 않았다.
- 공개 증거: `evidence/release-source-verification.json`, `function-release-verification.json`, `hosting-release-verification.json`. 상세 로컬 로그는 위 사본의 부모 폴더에 `push.log`, `functions-deploy.log`, `hosting-deploy.log`, `emulator.log`로 보존한다. 사본에 junction이 있으므로 재귀 삭제하지 않는다.

부가 정리에서 실패한 임시 사본 폴더·archive의 재귀 삭제 명령은 자동 승인 검토가 정책상 거부해 보존했다. 배포 결과와 무관하며 다른 삭제 경로로 우회하지 않았다.

## 적용 시점·다음 업무

기존 계정은 **배포 후 첫 정상 집계에서 버전 생성 → 최초 전체 캐시 저장 → 이후 재방문/증분 절감** 순서로 활성화된다. 최초 전체 다운로드와 요약/Rules 읽기가 없어지는 것은 아니다. 운영 청구 절감률·실폰 IndexedDB 성능은 아직 미측정이다. Guest 전수 스캔·다인 비용은 이번에 바꾸지 않았다.

Chief 확인: 아래 주소를 새로고침한다. 가짜 주행·반복 시험을 운영에서 실행할 필요는 없다.

```powershell
cd C:\20.HDev\boxcycle
Start-Process 'https://boxcycle-dc2df.web.app/'
```

재현 배포 명령(위 커밋 사본에서 실행, Chief 승인 범위):

```powershell
cd C:\20.HDev\boxcycle\tmp\read-cost-release-20261120\snapshot-3
& 'C:\Users\kdrea\AppData\Roaming\npm\firebase.cmd' deploy --only functions:conquestOnRideCreated --project boxcycle-dc2df --non-interactive
& 'C:\Users\kdrea\AppData\Roaming\npm\firebase.cmd' deploy --only hosting --project boxcycle-dc2df --non-interactive
```

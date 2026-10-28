# 2026-10-29 커밋·배포 및 개발 코드 잔류 점검

담당: Codex 직접 조사·검증·배포. Chief 요청: 커밋·푸시·배포, 개발 브랜치/워크트리/댕글링 코드 확인.

## 배포 범위

최근 검증된 계정/체험 속도 창 축소, 주행 결과 경로명, 경로 생성 창 재배치·출발 안내, 센서 없는 주행의 임시 순위 포함. Hosting과 functions:getLeaderboard만 배포하며 Rules·인덱스는 변경하지 않는다. 순위 출시 전 LEADERBOARD_SENSOR_ONLY=true 복구 필요.

## 조사

- 원격 fetch 완료. main2는 시작 시 origin/main2보다 검증기록 c743b4b9 한 커밋 앞섰다.
- 로컬 브랜치 7개. main은 안정선이므로 유지. distance-direction-refinements/new-road-display-release/ride-interval-release/pre-ui-release는 모두 main2의 조상. 원격 전용 개발 브랜치 2개 역시 main2 조상으로 코드 미병합 없음.
- backup/main2-before-align-20261029의 3개 커밋은 0b9b5abf에 합쳐진 이력. 두 tip의 제품·도구 차이 없음. 전체 차이는 190MB zip 2개 제외뿐이며 zip은 디스크에 보존 중.
- 워크트리 2개: 현재 main2와 .out/pre-ui-release-20261020. 후자는 main2 조상이며 추적 파일 수정 없음, 비추적 과거 evidence 폴더만 존재. 삭제하지 않음.
- stash 1개: 2026-10-20 UI 병합 전 보존본. 미니맵/도크 배치·접기 등 변경은 현재 구현에 존재. 과거 시험·ops 기록 포함하므로 적용/삭제하지 않음.
- git fsck --full --no-reflogs --unreachable: unreachable 객체 2644개, 커밋 51개. 상세 제품 blob 대조는 unreachable-commits.json. fsck는 읽기 전용이며 gc/prune/clean 실행 없음. 오래된 실험 및 stash를 자동 병합하지 않음.
- .out, claude-headless.err, 두 대형 baseline zip은 배포·커밋에서 제외하고 원위치 보존.

## 검증·배포

실행 폴더 C:\20.HDev\boxcycle. npm run build PASS(기존 번들 크기 경고). 최초 문서 검사에서 sensor-dock README 상대 링크 1건 발견하여 수정. pre-commit/pre-push와 배포 결과는 완료 시 아래 추가 기록.

## 댕글링 코드 상세 판정

51개 중 제품 변경이 있는 커밋 11개를 reachable Git object와 대조했으며, 8개는 제품 blob이 모두 현재 참조 이력에 존재한다. 나머지 3개:

- 781e0c5b: 10-03 focus-read 초기 WIP, 제품 파일 7개. 당시 21-review-final-approval.md가 명시적으로 merge 대상에서 제외했고 최종 e2a49e2c 및 후속 승인·통합 기록이 있다. 채택하지 않은 실험본이며 기능 누락 판정 대상이 아님.
- cf8c5c82: 10-20 UI WIP, 제품 파일 4개. 옛 토큰색·계기판 크기·시작/재개 글자 변경. 이후 Chief UI 재설계로 대체된 구형 화면이라 현행 고정 목록을 거슬러 복원하지 않음.
- dfd325da: Guest HTTP 함수 파일 1개. 현재 파일과 diff를 직접 확인한 결과 주석 끝 공백 1개만 다름. 실행 로직 누락 없음.

결론: 댕글링 객체는 실제 존재하지만 이번 배포에 추가할 누락 기능은 발견하지 못했다. 오래된 WIP 원본은 SHA로 조회 가능하며 삭제·자동 복구·병합하지 않았다. stash는 최신 파일과 동일하다고 단정하지 않으며 과거 미니맵 구현·시험·ops 보존본으로 유지한다.

재현 명령(실행 위치 C:\20.HDev\boxcycle):

```powershell
Set-Location C:\20.HDev\boxcycle
git worktree list
git branch -avv
git stash list
git fsck --full --no-reflogs --unreachable
npm run build
node scripts/check-document-system.mjs
```

초기 조사 보조 명령은 root stash commit의 부모가 없어 한 차례 실패했고 root 대응 후 51개 전수 완료. Git fetch/CLI는 기본 sandbox의 config 접근 제한으로 실패 후 승인된 권한 범위에서 재실행. 문서 검사 링크 수정 후 PASS(429파일, brokenLinks0).

## 최종 결과 — DEPLOYED

- 제품 커밋 36d0e0ed, 구형 계약 시험 보정 dd5611e7. origin/main2 정상 훅 푸시 완료. main 안정선은 변경하지 않음.
- 웹 build PASS, pre-commit eslint 오류0(기존 App hook 경고7), 의존 방향·개발 부산물·타입·동행 간격·셀렉터20·정련 PASS.
- functions 시험171 PASS. 최종 test:quick 1440 PASS / 실패0 / 71.1초, 에뮬레이터·하네스 전용3파일 제외.
- 실패 이력: 첫 push는 Git Bash의 Kimi npm 래퍼로 검증명령 실행불가. Git Bash 내부 PATH 수정 후 해결. 다음 full quick1439PASS/1FAIL(구형 탭줄 삭제 버튼 기대값) → 승인된 하단 배치로 시험 수정. 이후 1439PASS/1FAIL(도로망 DOM fixture 초기화30초 초과) → 단독6.6초PASS, 제품 수정 없이 최종 전체1440PASS.
- 명령: `npx firebase deploy --only "functions:getLeaderboard,hosting" --project boxcycle-dc2df --non-interactive` PASS. getLeaderboard(asia-northeast3) Successful update operation, Hosting release complete.
- 운영 https://boxcycle-dc2df.web.app index.html 및 연결 JS/CSS5개 모두 로컬 dist와 byte/SHA256 일치. hosting-verification.json 참조.
- 실폰·실센서·인증된 운영 순위 주행 통합은 이번에 미실행. 센서 없는 순위 포함은 Chief 테스트 요청으로 유지, 출시전 true 복구 필요.
- 진행 중 다른 작업이 공용 현황판·상태보드·결정로그·HANDOFF·PROGRESS·ops README를 수정했다. 그 변경은 이번 마감 커밋에서 제외하고 보존한다.

확인: C:\20.HDev\boxcycle에서 아래 실행 후 운영 페이지 새로고침 → 경로창 제목/삭제 위치 → 계정·체험 속도 창 → 주행 결과 경로명 확인. 순위는 회원 주행 종료 후 새로고침(캐시최대5분).

```powershell
Set-Location C:\20.HDev\boxcycle
git log -4 --oneline
git status --short --branch
Start-Process 'https://boxcycle-dc2df.web.app'
```

상세 로그는 .out/release-push-pass-20261029.log 및 .out/release-deploy-20261029.log에 보존한다.

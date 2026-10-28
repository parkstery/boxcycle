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

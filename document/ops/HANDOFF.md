# HANDOFF — 지금 상태 한 장

| 항목 | 값 |
|---|---|
| 담당 | **Claude Code** |
| 갱신 | 11-25 6단계 푸시. |
| 브랜치 | `main2` · 지형 기본1배 |
| 마지막 배포 | 11-27 Hosting `eee3d1e4`(rider15 V3.0·Hoods). |

## 진행 중

**11-27 푸시·Hosting(Codex)**: Chief 커밋/푸시/배포 명시 승인. 대상: 바퀴840afc0c·테이퍼a1a6c0dd·후속 반경/전신 롤 제한(현재6파일). 서버/Rules 변경 없음.
다음 명령: git commit→git push(게이트 우회 없음)→npm run deploy:hosting→운영 JS 해시 확인. 엄지척은 자산·동행 계약 조사 후 제안만.

**11-27 전신 기울기·반경 재조정(Codex)**: 기존80/120ms 급변·90도 반경3.19m 회귀 재현. 반폭13.5m로 반경6.37m, 롤 속도30도/s·가속도120도/s² 제한. MapView 회전용 실제dt 분리(저FPS 과대 각속도 보정).
검증: 관련27/27·빌드·lint오류0(기존경고10)·diff PASS, localhost5000 모듈 HTTP200/새 값 확인. [후속 결과](20261111-rider15-app-integration/20261127-cornering-roll-followup.md). 안쪽편차3.58m·실화면 Chief 확인 대기, 미커밋·미배포. 주소 질문 답 대기.

**11-27 커브·테이퍼(Codex)**: 포물선 가중 평균·해석적 접선, 진입/진출 곡률0부터 연속 변화. 반폭6.75m·접선 지연0·전신 기울기35도 상한·진입80/복귀120ms. 파일: geo.ts·riderTurn.ts·수치 회귀2개.
검증: 관련25/25·quick1725/0·빌드/lint/diff PASS(quick 에뮬레이터·하네스7파일 제외). Chief 커밋 지시로 검증 완료 후 커밋 단계. [최종 결과·제약](20261111-rider15-app-integration/20261127-cornering-motion.md). 다음: 로컬5000 새로고침·커브 테이퍼 화면 확인. 푸시·배포 없음.

**11-27 바퀴 RPM 수정(Codex)**: 둘레2.105m·속도 기반 독립 바퀴 위상, 페달 센서 우선/미연결 기어비3.2 추정 적용. rider14/15·본인/동행/페이서 공용 레이어 반영. GLB·통신 코드 미변경.
검증: 바퀴/리그/레이어24/24·빌드 PASS. 첫 시험 실행은 Windows import 경로 오류, 다음 실행은 구형 정규식 1건 실패 후 갱신·전부 통과. 840afc0c 커밋 완료·미배포. Chief 로컬5000 화면 확인.

**11-27 rider15 Hosting(Codex)**: main2 eee3d1e4 푸시·배포 완료, quick 1719/0. 운영 JS·GLB 3종 HTTP 200 및 빌드 해시 일치.
Hoods ±0.2°·몸통 원본 궤적 복원. 전용18/18·기존64/64. 다음: 실폰. [동작 계획](20261111-rider15-app-integration/20261127-rider15-posture-and-motion-plan.md).

**11-27 rider15 V3.0(Codex)**: Chief DEV 화면 정상 확인·기본 rider15 전환 지시. 후보 `20261127-160608-8767e93a`·rider14 롤백 보존. 전용16/16·기존64/64·quick1717/0·빌드/lint 통과.
다음: 실폰·30명 프레임 시간 비교, 주행 조건별 자세·상체 모션은별도 작업. [보고서](20261111-rider15-app-integration/20261127-v3-integration-progress.md).

**11-27 푸시·Hosting(Codex)**: fa7af6b3 원격·Hosting 배포 완료. 게이트 1715/0, HTTP 200·운영 JS와 로컬 동일·세계 지도 문구 확인.
첫 게이트 브라우저 3건 시간초과 → 개별3/3, 전체 재실행 통과. 다음: 실폰·실주행 확인.

이전 작업 상태·검증·미확인 사항은 [11-27 보존 기록](20261127-handoff-background.md)에 원문 보존.

## 다음 한 걸음

1. 지형OFF 1~6단계 배포(11-26)·[3D View 보고서](20261119-camera-terrain-follow/20261126-3d-view-report.md). 남은 것: 실폰(7단계)·Mapbox 토큰 주소 제한.
2. 중계 보드/장애 복구와 반응형·적응형 정책은 후속. Guest 감사는 매일 유지로 확정, 상시 Firestore 백업 유지.
3. 인터벌·이정표 실폰/실센서 확인, 반복 렌더링 스택 확보. 거리 안내·센서/RPM·관전 UID 수정은 로컬 커밋·미배포.

## Chief 결정 대기

- PR #22·지역 칩·Trail 탭 반짝임 Chief 폰 확인(11-06 일부 확인). 위치 저장 임계값 효과는 측정 5로 확인됨(분당 5.0·6.4).
- 그 밖: 2026-10-29 Chief 「한꺼번에 하자」: 간편 인터벌 01 감리·커밋 후 그때까지의 커밋 전부를 한 번에 푸시·Hosting 배포한다(배포 전 대상·범위 설명 후 실행, 적용 검증).

## 잊지 말 것

- **유럽 RTDB Rules는 별도 배포**: `firebase.json`이 아직 기본 인스턴스만 안다. `database.rules.json`을 바꾸면 유럽에도 임시 설정(`{"database":[{"instance":"boxcycle-dc2df-eu-rtdb","rules":"database.rules.json"}]}`)으로 배포한다 — 2차에서 firebase.json 다중 인스턴스로 바꿀 때까지.
- 순위 센서 조건 임시 완화는 **출시 전 서버 상수 true 복구** 필요([묶음](20261029-leaderboard-sensor-test/README.md), 체크리스트 §6).
- Firestore 백업이 꺼져 있다(2026-10-08 기준). 운영 데이터 삭제·이동은 Chief 승인 + 사전 스냅샷.

## 지킬 것

- 타인의 변경 보존: `git restore`·`checkout -- .`·`clean`·`stash`·worktree·일괄 되돌리기 금지. 비추적 `.out/`·`cdbox.bat`은 손대지 않는다(`.out/` 안 폴더를 지울 땐 링크부터 끊는다 — 실제 node_modules 로 이어져 있다).
- imgman 서버(3000·3001) 종료 금지.
- 파일은 링크 대신 `Start-Process "<절대경로>"`. 사용자 명령: 모든 경로 절대경로·한 줄 독립 실행(11-22).
- 보고에 수행 agent 명시.
- 실행자 호출·게이트 명령·배포·환경 사실: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md) §3~§7. 화면 고정 항목: [Chief 지정 디자인 고정](../reference/product/261024-RTW-Chief-지정-디자인-고정.md).
- 옛 구역(10-24~25 묶음3~5 완료 기록, 배포 방법 복제본 절차, 포트 PID 기록)은 archive에 있다.

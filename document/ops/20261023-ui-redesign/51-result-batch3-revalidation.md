# 결과·감리51 — 묶음3 재검증·실패 시험 조사

2026-10-24 KST · 지시50 · **조사·교정·감리·캡처: Codex 직접**. 외부 실행자 미호출.

## 판정

**LOCAL_VERIFIED / AWAITING_CHIEF**(이번 화면·집중 실앱 범위). 커밋·푸시·배포 없음. 실앱 집중3건 PASS. 전체 ride-continuation은 RC1 실패가 있어 전체 PASS로 보고하지 않는다.

## 실패3건 조사와 교정

| 시험 | 원인·근거 | 처리 |
|---|---|---|
| ui-edge-live | 10-21의 220px·36px·주행 시작 직후 펼침 가정이 고정1·11·12와 충돌 | 29.4vw 정확한 폭, 글자 없는 녹색 원형 44px, S/E·센서 맨 위 줄, 시작 직후 접힘·다시 펼침·편집 잠금을 검사. 허용 오차를 넓히지 않음 |
| distance-direction-attention:29 | 자동 탐색 성공 후에도 미선택 강조를 요구. 커밋 `0ec14853`/10-22 지시24·29는 성공한 적용 수단 표시를 요구 | 적용 cycling·driving과 요청 횟수를 검사. 수동 경로의 미선택 순차 강조는 별도 실제 DOM 시험으로 유지. 두 시험 2/2 PASS |
| route-ride-controls:20 | 묶음3 preview 수정 때문이 아님. HEAD preview와 동일 결선. 최근 RouteDock guard가 cadence 바인딩의 존재만 보고 빈 idle 카드를 남김 | 기존 Chief 지시10의 빈 경로 주소 패널 없음 복구. 실제 sensorChipSlot이 카드 안일 때만 빈 stops 허용. idle 없음 단언 유지. setup 센서는 고정12에 따라 카드 맨 위 줄을 정확히 검사 |

묶음3의 기존 제품 변경은 유지하면서 `RideSummarySheet.css`의 큰 진행 숫자 line-height를 1.25로 맞췄다. 26px 글자에 1.1이 적용되어 clientHeight29/scrollHeight32가 되는 실제 overflow를 고쳤다. 글자 크기·통과 기준은 그대로다.

묶음3 시험은 위치를 측정하기 전에 실제 진입 애니메이션의 `finished`를 기다린다. 최초 667×300의 bottom302.59 실패는 translateY16→0 도중 측정한 것으로, 최종 위치 허용 범위는 변경하지 않았다.

## 검증 증거

모든 로그·새 캡처는 `evidence/instruction50/`에 보존한다.

| 실행 | 결과 |
|---|---|
| initial-ui.log | 첫 실행 중단. legacy 증거 폴더 출력을 확인하여 경로 분리 후 재시작 |
| initial-ui-reproduction.log | 거리 강조·idle 카드 두 실패 재현, 667×300 애니메이션 측정 실패 발견. Windows 하위 프로세스 종료 권한으로 최종 종료 대기, 중단. 전체 PASS 아님 |
| final-ui.log — 화면54 | 52 PASS / 2 FAIL(setup 센서 위치·결과 진행 숫자 overflow) |
| corrected-ui.log — 교정 관련15 | **15/15 PASS**: 실패2건 및 묶음3 전체13건. 54개 고유 시나리오 모두 최종 관련 실행에서 통과 |
| profile-attention.log | **2/2 PASS**: 자동 탐색 성공 적용 수단 및 수동 미선택 강조 |
| Chief 고정 잠금 | final-ui.log에서 1~4·10·11·12·14 및 주소 폭·목록 단언 PASS. 잠금 단언·고정 문서 변경 없음 |
| 타입 `npx tsc -b --noEmit`·변경 ESLint | PASS, 오류0 |
| selector | 19/19 PASS |
| unit.log — `npm run test:quick` | 1357 PASS / 3 FAIL. 세 실패 모두 watchdog 프로세스 종료 샌드박스 접근 거부 |
| watchdog-authorized.log | 해당 도구 파일 권한 있는 재실행 **4/4 PASS**(처음부터 통과한 기본값1 포함). 전체 빠른 시험을 단일 실행 1360 PASS라고 보고하지 않음 |
| code tidy·dep direction | 기준선 이내·방향 위반0·순환0 PASS |
| live.log | Firebase 사용자 설정 읽기 EPERM으로 시작 실패 |
| live-authorized.log — 전체 연속 주행 | RC1 300초 FAIL: `.ride-summary__scrim`을 닫기로 고른 데다 reload 뒤 위치 안내가 클릭을 가로챔. RC2 시작 후 중단. RC1/나머지 전체 묶음 승인 증거 아님 |
| live-focused.log | **3/3 PASS**, 2.7분. RC13·주행 주소·실지도 에지. 에뮬레이터 정상 종료·watchdog exit0 |

문서 검사 깨진 링크0·구조 오류0, `git diff --check` PASS. 비교 캡처를 Codex가 직접 열어 양수 결과800×360·다음 주행667×300 외관을 확인했다. 프리뷰5020 종료. 보존 JSON 및 기존 dirty 캡처5장 최종 SHA256 일치. 원래 묶음3 제품 파일 중 추가 변경은 결과 CSS line-height 한 줄뿐이며, preview·NextRideCard·RideSummarySheet TSX·rideEntryHelpers 등은 시작 해시와 동일하다.

실앱 시험은 Firebase auth/firestore/database/functions 로컬 에뮬레이터로만 실행했다. 5000에는 시험 데이터 쓰기를 하지 않았다. RC1의 낡은 위치 안내·닫기 셀렉터 교정은 별도 잔여로 남긴다. RC13은 기존 묶음3에서 그 계약을 이미 교정한 시나리오다.

## 증거 덮어쓰기 사고·복구

고정 시험의 기본 캡처 경로 두 곳을 최초에 모두 분리하지 못했다. 인라인 기존 dirty PNG5장과 이전 clean 주행 접힘 PNG5장이 재생성됐다. 원래 dirty 파일5장은 시작 때 저장한 SHA256과 일치하는 Git 과거 blob을 찾아 **정확한 원래 바이트로 복구**했다. clean5장도 시작 때 clean임을 확인하고 이번 생성물만 HEAD blob으로 되돌렸다. `git restore/clean/stash/worktree`는 사용하지 않았다. 이번 캡처는 `rerun-*.png`로 분리 보존했다. 상세 원본 blob·SHA256은 `recovery-git-matches.json`.

이후 잠금 시험의 단언은 유지하고 주행 접힘 캡처 경로만 `UI_REVALIDATION_EVIDENCE_DIR`로 지정할 수 있게 했다. 인라인은 기존 `ENTRY_CARD_HISTORY_EVIDENCE`를 사용한다. route-ride·ui-edge·route-dock도 별도 증거 경로를 지원하도록 했다. 기존 `.out/`·`cdbox.bat`·보존 JSON과 묶음3 제품 미커밋분은 보존한다.

## Chief 비교 화면

`C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-instruction50.html`

변경 전은 기존 캡처, 변경 후는 이번 instruction50의 실제 컴포넌트 예시 데이터 캡처다. 운영 자료가 아니며 새 도로 +0.16km는 구독 응답 예시다. 800×360/667×300 전환 가능. 기존 비교 페이지·기존 batch3 증거는 변경하지 않는다.

```powershell
cd C:\20.HDev\boxcycle
Start-Process 'C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-instruction50.html'
```

서버·접속 주소 불필요. 새로 연 로컬 페이지라 새로고침 불필요. 주행 결과→양수 새 도로→다음 주행 순서로 보고 화면 크기를 667×300으로 바꿔 확인한다.

2026-10-24 21:57 KST 마감: 위 비교 HTML을 Codex가 `Start-Process`로 직접 열었다(exit0). 최종 리스너는 기존 3000/PID28472·3001/PID42236·5000/PID58256·5040/PID10096만 유지. 이번 5017·5020·5001·8080·9000·9099·4400·9150 리스너 없음. 문서 검사·diff 검사 최종 PASS. HANDOFF·PROGRESS·묶음 README 갱신 완료.

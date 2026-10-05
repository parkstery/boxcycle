# 주행 맵 제어 — Supervisor 최종 검수

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Codex 검수 |
| 작성 | 2026-10-05 |
| 상태 | **APPROVED** — 구현 검수 완료 |
| 결과 | [05 Cursor 결과](05-result-zoom-rework.md) |

카메라 1~6 아래 야외(Outdoors)/위성(Satellite) 토글과 줌 −/+를 배치했다. 기존 맵 스타일 상태와 연동한다. 거리 기반 카메라는 userZoom으로 거리를 조정하고, 경로 전체 보기 등은 실측 지도 줌을 조정한다. 카메라 재선택 시 프리셋을 복원한다.

첫 검수에서 줌 방향·고정 카메라 거리 덮어쓰기·routeFit 무반응·터치 영역 겹침을 발견해 재작업했다. Cursor가 구현·실화면 검증을 수행했고 Codex가 실제 diff를 검수했다.

최종 보완: 지도 재로딩 때 같은 requestId를 재소비하지 않도록 guard를 추가했다. 실측 줌 요청으로 문제를 해결했으므로 일반 mapZoom props의 suppress/deferred 변경은 되돌려 기존 처리 범위를 유지했다. 05의 deferred 설명은 최종 코드에 적용되지 않는다.

## 검증

- 타입 검사: npx tsc -b --pretty false, exit 0.
- 주행 진입 셀렉터 계약: 15단계 통과.
- 카메라 계약: npm run test:ride-camera-framing, 89개 통과.
- 변경 TS 린트: 신규 error 0. 기존 hooks warning은 유지.
- Cursor 실화면: 740×300, QC2 확대/축소·유지·프리셋 복원, routeFit 15.69→16.7→15.7, 상공 확대/축소, 실제 높이 44px·컨트롤 hit-test 및 겹침 검증 통과.
- QC3은 같은 productTune 구현 경로로 검수했으며 개별 실화면 시험으로 보고하지 않는다.

최종 로컬 실화면 재검증 결과는 아래 추가 기록에 남긴다. 커밋·push·배포 없음. Chief의 사용 확인 및 최종 종료는 별도다.

## 최종 보완 후 재검증

타입 검사·린트(error 0)·89개 카메라 시험·15단계 셀렉터 계약 재통과. 일반 sandbox 실행은 주행 준비 셀렉터 대기로 실패했고, 기존 서버에 접근하는 권한으로 재실행한 실화면 검증은 exit 0, pass:true였다. QC2·routeFit·상공의 ± 방향과 44px 실제 높이·겹침 없음이 모두 통과했다. [최종 실측](.out/metrics-zoom-rework.json).

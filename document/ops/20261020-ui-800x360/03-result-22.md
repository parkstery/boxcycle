# 방사 화살표 인계 후 보완 결과

2026-10-22 · record. Codex 직접 보완·검수, [지시22](02-task-22.md).

Cursor 결과21 이후 남아 있던 구면 중심/닫힘점 중복 제거, 몸통0.12R·날개0.055R 보정을 검수했다. 추가로 arrow GeoJSON을 effect당 한 번 계산해 스타일 복원에서 재사용한다. 실제 Mapbox 엔진에서 `setStyle(...,{diff:true})`가 사용자 source를 없애면서 `style.load`를 발생시키지 않는 결함을 재현했다. 누락 source만 복원하는 `styledata` 핸들러와 재진입 방지 가드를 추가했다. 두 source가 있으면 재계산·setData를 하지 않는다. 외부 요청·DB/서버 코드 변경0.

새 `e2e/distance-target-arrows.spec.ts`는 제품 시험 API 없이 기존 Runtime 응답의 props만 주입한다. 실제 MapView/Mapbox 엔진에서 3폭, 1/120km·날짜변경선 위치 변경, 스타일 차분/전체 교체, 원 제거/재진입을 검증한다. 기존 지도 제스처2시험과 함께3 PASS. 사진지도 대신 최소 스타일을 사용했고 실제폰은 미검증.

기존 dirty/evidence/서버 보존, 신규 상시서버·커밋·푸시·배포 없음. 명령·증거·실행 안내는 [검수22](04-review-22.md).

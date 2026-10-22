# 거리·방향 출발 즉시 지정 결과

2026-10-22 · record. Codex 단일 writer. [지시28](02-task-28.md).

거리·방향 탭·출발 미지정 시 긴 누름으로 새 좌표의 팝업을 구성하고 공통 selectStart 경로를 즉시 호출한다. 주소도 새 좌표로 조회하며 임시 마커 없이 기존 출발 마커·거리 입력으로 진행한다. 거리 탭의 출발 버튼 컨테이너 제거, 출발·도착 탭 버튼은 유지. 안내는 Chief 요청 원문 `출발 위치를 지도에서 위치 길게 누르세요.` 사용.

기존 onSelectPoint/거리 준비/팝업 도크 승격 경로를 재사용했다. 서버·Rules·데이터 변경 없음. 삭제 후 터치 긴 누름→재생성 및 탐색 중 삭제→마우스 긴 누름→새 탐색→늦은 옛 응답 무시를 통합시험으로 검증한다.

시험 cwd `C:\20.HDev\boxcycle\apps\web`:

- `npm run test:distance-auto-route`: exit0, 145 PASS. 최초 실행은 추출 전 함수/변수명을 기대한 정적 패턴 두 건 실패. 공통 selectStart 경로를 검사하도록 갱신 후 전체 PASS.
- `npm run build` (저장소 루트): exit0, tsc 포함 PASS. 기존 SADDLE/PELVIS·번들 경고 유지.
- `npx eslint src/components/map/MapView.tsx src/components/map/mapPopupElements.ts e2e/distance-route-continuation.spec.ts`: exit0, 오류0/기존 MapView 경고8.
- `git diff --check`: exit0.
- 브라우저 최종 실행·릴리스 결과는 [검수28](04-review-28.md)에 기록.

증거 `.out/step26-browser.log`(최초4 PASS), `.out/step28-browser.log`(터치/탭 회귀 추가), `.out/step28-distance.log`, `.out/step28-lint.log`, `.out/step26-build.log`. 캡처 `.out/step24-distance-start.png` 직접 확인: 거리 탭·출발 미지정 안내 표시, 출발 버튼 없음. Mapbox/경로 HTTP는 stub; 실제폰/실 API 응답 미검증. 기존5002 서버 보존.

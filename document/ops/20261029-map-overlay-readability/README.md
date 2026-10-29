# 지도 위 인터벌·순위 가독성 시안

최신 상태: **B안 채택·LOCAL_VERIFIED / 미배포**. Chief 「B안으로 하자」「계속해」로 아래 시안 전용 범위를 제품 구현으로 확장했다. Codex 직접 구현·감리·캡처.

Chief 요청: 첨부 위성지도에서 왼쪽 인터벌·오른쪽 순위의 가독성 개선안을 시안과 함께 제시. 후속: 순위 폭을 줄이고 오른쪽 여백을 활용.

범위: 시안·의견만. 제품 코드·배포 없음. Codex가 제작·육안 검토.

- 공통: 순위 우측 8~12px 정렬, 목표 폭 약220px(첨부 1040px 화면 기준), 순번/이름/거리 열 간격 축소. 5명·km·내 순위 유지. 조작·반달 탭 보존.
- A: 바탕 없는 기존 원칙 유지, 청록 강조·강한 외곽선. 복잡한 지도와의 분리 한계.
- B(권고): 정보 바로 뒤만 어두운 반투명 바탕. 좌측 타이머 강조·우측 컴팩트 순위. 고정 목록7 변경 제안이며 아직 제품 적용 아님.

다음: 이미지 생성 후 첨부 비교·육안 검토. AI 시안은 위치·폭의 방향 검토용이며 정밀 픽셀 검증은 제품 구현 후 필요.

## 결과

- 비교 시안: comparison-v1.png (위 A / 아래 B). 내장 imagegen 사용, Codex 직접 제작·육안 검토 완료.
- 권고: B. 정보 바로 뒤의 짙은 반투명 배경으로 지도 지명과 분리. 순위는 오른쪽 끝으로 밀착하고 열 사이 간격 축소.
- 폭은 이미지 생성 근사치다. 제품 구현 시 첨부1040px 화면 기준 약220px 목표로 폰가로 긴 이름·거리와 함께 확인해야 한다.
- 프롬프트 요지: 원본 위성지도·경로·조작 유지, 2단 비교. 공통 우측10px·순위 약220px·5행 보존. A 청록과 윤곽선, B 검정82% 국소 배경. 타이머3:46·준비0/2 유지.
- 검증: 이미지 육안 확인 통과. 제품 시험·실폰·픽셀/대비 수치 검증 미실행(제품 미수정·생성 시안). 커밋·푸시·배포 없음.
- 확인: C:\20.HDev\boxcycle 에서 `Start-Process .\document\ops\20261029-map-overlay-readability\comparison-v1.png`. 서버·접속 주소 불필요. 위/아래의 가독성·오른쪽 밀착·중앙 지도 공간 순서로 확인.

## B안 제품 반영·검증

- `LeaderboardGlance.css`: 기존220px 폭에 추가되어 있던 우측44px 오프셋 제거. border-box220px/작은가로200px, 안쪽 열 간격6→4px, km 내용 폭. 정보만 감싸는82% 짙은 배경·윤곽선 제거·내행 청록 강조. 배경 가장자리는 입력 통과, 목록·버튼만 입력을 받아 반달 탭 유지.
- `RideIntervalHud.css`: 기존35%→82% 배경, 가는 테두리·윤곽선 제거·단계색 타이머·폭205px 이내(낮은화면150px 유지).
- 고정7·31 및 결정로그·상태보드 동기화. `ride-interval.spec.ts`의 배경 기대값은 Chief 채택값으로 갱신.
- 표시 데이터 제한 불변: 인정 주행은 내순위 주변 최대10명(`computeLeaderboardLiveRank(...,10)`), 대기는 상위20명. 센서 미인정 주행은 `mapData.top.slice(0,20)` 폴백. 제공 인원이 적으면 그 수만 표시. 전원 동시표시는 화면 높이에 의존하며 넘치면 내부 스크롤.
- `node scripts/overlay-readability-review.mjs` PASS: 1040×475/800×360/736×300/699×273/667×300 모두10명 동시표시·우측9~11px·반달 실제클릭 접기·인터벌 화면내. `geometry.json`·`implemented-*.png` 5장. 20행 DOM CSS fixture 마지막행 스크롤 도달·5행 축소 시 배경높이 감소 PASS(`content-cases.json`), 서버 데이터 검증 아님.
- `$env:RTW_DEV_PORT='5031'; npx playwright test ride-interval.spec.ts ride-dock-layout.spec.ts --workers=1 --retries=0 --output=test-results/overlay-b-final`: **11 PASS**. 최초7 PASS/4 FAIL(699높이 패딩1건·구35% 기대값3건) → CSS 패딩 보정·승인 배경 기대값 갱신 후 통과. 반달 가장자리 입력 후속 수정은 5크기 실제클릭으로 별도 통과.
- `npm run build`(tsc 포함) PASS, `git diff --check` PASS. 최종 CSS 입력 통과 변경 후 빌드 재확인.
- Ego 공간14에서 제품 컴포넌트 확인, 캡처 Page.captureScreenshot timeout 및 viewport 고정 한계로 headless Playwright 캡처로 전환, Ego 공간 종료. 최초 review 스크립트 산출경로·버튼 이름 오류는 수정 후 최종 PASS. PNG 육안 확인: 명확한 정보/지도 분리·중앙 공간 확보.
- 실폰·실위성지도·실Firebase 통합은 미실행(기존 실제 제품 컴포넌트 검수 하네스 기준). 커밋·푸시·배포 없음. 기존 타인 변경 보존, 새로 시작했다가5032로 밀린 중복 서버만 종료·5031 기존 서버 유지.

실행 폴더: `C:\20.HDev\boxcycle\apps\web`

```powershell
# 기존5031 서버 재사용. 없을 때만 시작
npm run dev:localhost -- --port 5031
# 검증 재실행
node scripts/overlay-readability-review.mjs
```

확인 주소: http://localhost:5031/scripts/ui-800x360/preview.html?state=glance-riding&interval&noSensor

확인 순서: 왼쪽 인터벌 배경·타이머 → 오른쪽 순위 밀착·10명 → 반달 접기/펼치기. 검수용 지도 배경이며 서버 기록 없음. 실제 앱은 http://localhost:5031/ 에서 주행·인터벌·순위 열기로 확인.

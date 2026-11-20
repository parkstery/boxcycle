# 카메라 2·3 지형 간섭 회피

수행: Codex · 2026-11-19 · Chief 검수 성공 / 커밋·푸시·Hosting 배포 완료(4c1f2ef0). [배포 기록](../20261119-mobile-3d-investigation/release.md).
Chief: 건물 간섭은 보류하고 카메라2·3 지형 간섭 해결 진행. 후속 「카메라 지면 충돌 회피 전략은 성공이다. 3D 뷰가 끊기지 않고 디스플레이된다」 확인 및 커밋 지시. 이는 Chief의 체감/동작 검수이며 숫자 FPS 실측 결과는 아니다.

범위: 기존 follow 구도 뒤에 카메라 아래 최소 지상고 및 카메라–라이더 시야의 terrain 안전 여유를 확보한다. 로드된 DEM만 조회하고, 유효하지 않은 지형을 0으로 대체하지 않는다. 상승은 충돌 회피를 우선하고 하강은 완만하게 한다. 자동 평면에서는 3D 복귀 시 지형 기준을 계산한다. 평지에서 충분히 안전하면 기존 구도를 보존한다.

금지: 건물 충돌/렌더 변경, QC1·4·5·6 재설계, peer/센서/기록/라이더 자산 변경, 수동3D OFF 자동복귀, terrain 데이터 결측의 보호 기능 제거. 고정21(지도스타일·종료정북),36(지형 이상 자동평면·수동OFF),72(주행시작QC2) 보존. Chief 승인 범위 내 QC2·3에만 지형 높이 보정 추가.

계획 파일: `apps/web/src/components/map/rideCameraFollow.ts`, 새 `rideCameraTerrain.ts`, 관련 단위·통합 시험 및 독립 WebGL 검수 하네스. 기존 MapView rAF 경로와 follow jump 구분 안에서 보정하고, 새 네트워크 API를 만들지 않는다.


## 구현 결과

- `rideCameraTerrain.ts`: 카메라 아래 지상고 최소3m 및 카메라–라이더 사이7개 지점의 시야 여유0.6m를 확보하도록 상승량을 계산한다. 지형 강조1.3배의 표시 높이 기준이며 실제 세계의 드론 비행 고도 규격이 아니다. 평지에서도 기존 카메라가3m보다 낮으면 보정한다. 중간 언덕이 가리면3m보다 더 높아질 수 있다.
- 필요한 상승은 즉시 적용, 여유가 생긴 뒤에는1초 시간상수로 상승 보정량을 줄인다. nominal Follow 구도보다 낮추지 않는다. QC2/3 외·수동 terrain OFF·free 모드에서는 보정을 끄고 상태를 정리한다.
- 높이만 바꾸면 라이더가 이미 화면 밖인 경사 구도를 보존하는 문제가 있어, 실제 카메라–라이더 높이차와 FOV로 시선을 재계산한다. QC2 anchor0.63/QC3 anchor0.6을 사용하며 pitch 상한85°에서도 시야를 확보할 높이를 고려한다. FOV는 기존 rider projection과 같은 읽기 전용 transform 값 및36.87° 폴백이다. 다른 내부 transform 값은 쓰거나 덮어쓰지 않는다.
- 기본 jumpTo와 후속 FreeCamera 보정을 같은 follow 이벤트 구분 안에서 실행한다. 명목 구도는 기존 위치/방위/거리/사용자 줌 정책을 사용한다. 지형 보정에 따라 실제 pitch·zoom·중심은 달라질 수 있다. 기존 계기·센서·카메라 메뉴 UI 변경 없음.
- 자동 평면에서는 기존 guard와 동일한 prospective3D 높이 기준으로 계산한다. 요청한 terrain 배율과 실제 렌더 배율이 아직 다르면 보정을 한 프레임 유예해 좌표 혼합을 피한다. 타일 결측은0으로 대체하지 않고 기존 guard가 처리한다. 기본 guard의750ms/4초/2.5초 정책은 변경하지 않았다.
- 로드된 DEM 조회만 사용한다. 정상 보정당 raw9회+배율 확인1회, 별도 지형 API/네트워크 요청 없음. 카메라 갱신과 같은 주기이며 스마트폰 CPU 비용·발열은 실기기 미측정이다. 실제 가림 판정은 유한한7개 샘플이므로 모든 절벽/DEM 오차를 완전히 막는 충돌 엔진은 아니다. 안전한 시야를 못 구하면 기존 자동평면 보호가 남는다. 건물 높이는 조회하지 않는다.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/ride-camera-terrain.test.ts
node scripts/test-quick.mjs ride map
node ../../node_modules/typescript/bin/tsc -b
node ../../node_modules/vite/bin/vite.js build
node ../../scripts/check-dep-direction.mjs --check
```

- 새 시험 **10/0**: 평지·음수 고도 수학·중간 능선·결측·상승/하강·QC2/3·flat 복귀·수동OFF/다른 슬롯·terrain 배율 전환·실제 follow jump 연결/이벤트 구분. 카메라 자체는 fake-map으로 실제 보정 함수를 실행한다.
- 주행·지도 quick **1156통과/0실패**(ride976/map180, 제외5파일은 에뮬레이터/하네스). 신규 시험은 map 폴더에서 자동 수집된다. 기존 interval-route-hint 묶음 미등록 경고는 이번 범위 밖.
- tsc·변경 파일 ESLint 통과. Vite build 통과(기존 큰 번들 경고). 의존성 방향 게이트 통과(위반0·순환0), 공백 검사 통과. dev-tools 게이트는 앞선 직접 구현 renderingDiagnostics 등록 누락1건을 발견해 기존 파일 내용을 보존하며 등록했고 재검증했다(기존 만료 경고8은 유지).
- 실제 Mapbox/WebGL: 합성 Terrain-RGB PNG를 브라우저 안에서 생성한 독립 검수 페이지. Firebase 인증·기록 쓰기·건물·실라이더 자산 없이 production tickRideCameraFollow와 guard를 실행한다. 평지·경사·능선, QC2/3, 자동평면 복귀, 강제 결측 및 수동OFF를 확인했다.
- 실제 브라우저의 기본 viewport에서 경사40샘플 모두 health=ready, 최소 지상고 약2.99978m(부동소수 오차), 지상점은 화면 안이었다. 능선 각20샘플 모두ready, 양쪽카메라 복귀 후ready·3D 유지, 결측 시평면·수동OFF 후terrain null 확인.
- **800×360 실제 CSS 크기를 실행 내내 유지한 WebGL 시험142개 관측**: 정상 능선 QC2/3 각20샘플 모두ready·지상고≥2.99m·지상점 화면 안. 자동평면 복귀는 각각 한 번만 전환하고 마지막ready/3D, 결측은평면·수동OFF는terrain null. canvas2400×1080은 이 독립 하네스의 원래 DPR3 조건이며 제품DPR1.5 설정의 GPU 시험이 아니다. 물리 스마트폰 시험도 아니다.
- 증거: `tmp/camera-terrain-20261119/slope.json`, `ridge-recovery-final.json`, `phone-ridge-final.json`, `quick-ride-map.log`, `flat-final.json`. 최신 폰크기 증거는 `phone-ridge-final.json`의 viewport=[800,360]으로 확인한다.

실패/수정: Node ESM의 Mapbox named export 불가→기존 프로젝트 방식의 default import 사용. 초기 높이만 보정 시 지상점이 화면 밖으로 나가 시선 각도도 보정. 2D/3D 배율 좌표 혼합을 막는 확인 추가. 초기 브라우저 장기evaluate15초 시간초과→작업 시작/짧은 결과 조회 분리. 초기 합성 guard 시간을 실제시간보다 빨리 진행하던 검수 오류→performance.now 사용. Ego 명령 종료 뒤 viewport 복원으로800조건이 아니었던 관측은 폰크기 검증에서 제외하고, 브라우저 실행 프로세스를 유지하며 실제viewport를 매 샘플 저장해 재검증했다.

미실행: 물리 폰의 문제 코스·실센서 주행·발열·실건물. 건물 간섭은 Chief 지시대로 보류. 자동화된 전체 실앱 진입 e2e·전체quick은 주행/map 관련 묶음으로 범위를 제한했다.

## 확인

기존 로컬 Vite5000을 재사용했다(새 서버 시작·종료 없음).

- 합성 검수: `http://127.0.0.1:5000/scripts/terrain-camera/preview.html?scenario=slope` 또는 scenario=ridge/flat. 준비 후 콘솔 `terrainCameraDemo.slot(2)`/slot(3), `terrainCameraDemo.step(0)`을 호출하면 production 추적을 한 번 실행하며 상태가 표시된다. `flat()` 뒤 실제시간으로250ms 이상 간격을 두고 `step(0,true)`을 반복하면 복귀를 확인할 수 있다.
- 실제 앱: `http://127.0.0.1:5000/` → 경로·3D 선택 → 주행 → 카메라2/3 → 기존 문제 경사 구간. 지면 관통/불필요한 평면 전환·시선 출렁임·줌 조작을 확인한다. 로컬127.0.0.1은 폰에서 개발PC를 가리키지 않는다.
- 당시 로컬 검수 뒤 Chief 추가 승인으로11-19 Hosting에 반영했다. 운영 https://boxcycle-dc2df.web.app/ 에서 확인 가능. 배포 범위는 위 배포 기록 참조.


## 현재 주행 화면 속성(11-19 작업 폴더 기준)

| 속성 | 현재 값 | 의미/범위 |
|---|---|---|
| FPS 상한 | 고정30/60 제한 없음 | requestAnimationFrame 기반, 기기 주사율·실제 처리량에 따라 변함 |
| 실제 주행 FPS | 수치 미수집 | Chief 3D 연속 표시 성공 확인과 별개. perflab은 최근10초 rAF 평균을 표시하며 지도 실제 렌더 FPS와 같다고 단정하지 않음 |
| DPR 기본 상한 | 로컬1.5 | 별도 이전 변경으로 이번 카메라 커밋 대상 밖. 원래DPR 이하, maxdpr 쿼리로 변경 가능. 운영 기본값 변경 미배포 |
| 800×360·실효DPR1.5 | 1200×540 버퍼 | 648,000픽셀, DPR2 대비43.75% 감소. 총 GPU 시간 감소율 아님 |
| QC2 거리 설정 / 기본 pitch / 방위 보정 | 9.4m / 83.5° / +7.5° | 명목 구도 값. 실제 카메라–라이더 거리나 지상고와 같은 값이 아니며 사용자 줌·지형 보정으로 달라짐 |
| QC3 거리 설정 / 기본 pitch / 방위 보정 | 11m / 83.5° / −6.5° | 위와 같음 |
| 라이더 화면 세로 anchor | QC2 0.63 / QC3 0.6 | 위에서63%/60% 지점을 목표로 시선 보정 |
| 보정 pitch 상한 | 85° | 지형에 따라 더 내려다보는 각도로 가변 |
| 지면과 카메라 최소 여유 | 3m | 표시된 지형 높이 기준 목표 최소값. 샘플 기반이며 완전한 충돌 엔진 아님 |
| 중간 지형과 시야 최소 여유 | 0.6m | 카메라–라이더 사이7개 샘플 |
| 지형 높이 강조 | 1.3배 | 자동 평면에서는0, 수동OFF는terrain null |
| 높이 보정 상승 / 하강 | 즉시 / 1초 시간상수 | 하강이1초 만에 완료된다는 뜻은 아니며 초당 잔여 보정 약37%로 감쇠 |
| 지형 상태 검사 | 250ms 간격(4회/초) | 높이 보정 자체는 follow 틱에서 실행 |
| 자동 평면 / 복귀 | 불량750ms 지속 / 평면최소4초·정상2.5초 지속 | 전환 직후1초 안정화. 수동OFF 자동복귀 없음 |
| 성능 패널 갱신 / 통계 창 | 1초 / 최근10초 | 실제 폰 수치는 ?perflab=1의 결과 복사로 수집 |

이번 커밋 범위는 카메라 보정·시험·합성 검수·고정86·이 묶음과 작업 입구의 카메라 항목이다. 앞선 DPR/계측·타 작업은 커밋 대상에서 제외한다.

## 11-20 카메라 기본값과 Lab 확인

수행 Codex. 거리 값은 프레이밍 설정이며 실제 카메라와 라이더 사이 거리나 지상고와 다르다. Mapbox pitch 0°는 수직 하향이고 90°에 가까울수록 수평이다.

| 카메라 | 위치·방향 | 거리 설정 | 기본 pitch |
|---|---|---:|---:|
| 1 전체 | 전체 경로에 한 번 맞춤 | 경로 범위 | 고정값 없음 |
| 1 상공 | 라이더 위, 진행 방향이 화면 위 | 20·200·300·400·500·1,000m | 0° |
| 2 뒤에서 | 라이더 뒤, 진행 방향 +7.5° | 9.4m | 83.5° |
| 3 앞에서 | 라이더 앞, 진행 반대 방향 −6.5° | 11m | 83.5° |
| 4 왼쪽 | 라이더 왼쪽에서 오른쪽을 봄 | 9.4m | 80° |
| 5 오른쪽 | 라이더 오른쪽에서 왼쪽을 봄 | 9.4m | 80° |
| 6 뒤고정 | 라이더 남쪽에서 정북을 봄 | 9.4m | 80° |

합성 DEM 브라우저 시험(825×471 CSS, QC2, 앵커 0.63). 세 설정 모두 지형 판정 `ready`.

| 프레이밍 거리 / pitch 입력 | 평지 실제 pitch | 경사 실제 pitch |
|---|---:|---:|
| 9.4m / 83.5° | 81.9° | 59.1° |
| 9.4m / 84.5° | 82.1° | 60.8° |
| 11m / 83.5° | 83.6° | 56.9° |

평지에서는 11m를 비교할 만하다. 경사에선 같은 후보가 더 아래를 향했으므로 일괄 기본값 적용은 보류한다. 앵커 0.68에서는 라이더의 지면 접점이 평지 화면 아래로 넘어간 경우가 있었다. 3m 지상고와 0.6m 시야 여유를 유지하면서, 높이 보정 시 후방으로 이동할 여지가 있는지 실폰에서 비교한다. 지형 보정 단위 시험은 10개 통과했다. 첨부 파리 Trail의 실주행, 실폰 프레임 시간·발열은 미측정이다.

더 수평에 가까운 구도가 멀리 있는 타일·건물·지형·라벨을 추가로 렌더링하면 기기 부담이 늘 수 있다. 같은 폰에서 경로·스타일·DPR을 고정하고 성능 Lab의 평균 FPS와 p95 프레임 시간을 비교한다. [Mapbox 렌더링 성능](https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/)

Standard도 도로명·도로 번호를 지원하며 `showRoadLabels`로 제어할 수 있다. Spinatlas의 Standard 낮·해질녘은 같은 스타일의 조명 프리셋이고, 앱에서 이 속성을 끄지 않는다. Outdoors와 Standard는 표시되는 라벨이 구간·줌·시점에 따라 다를 수 있다. 동일 주행 지점의 RUE MONTMARTRE 표시 여부는 미확인이다. [Mapbox Standard 설정](https://docs.mapbox.com/map-styles/reference/standard/)

기존 로컬 5199에서 카메라·조명 조절판 열기와 조명 프리셋 값 갱신을 확인했다. 서버가 꺼져 있으면 다음 명령으로 시작한다.

```powershell
Set-Location 'C:\20.HDev\boxcycle'
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
```

다른 PowerShell 창에서 연다. Trail 주소에 이미 쿼리가 있다면 `&camlab=1&lightlab=1&perflab=1`을 붙인다. 주행을 시작하고 2번 뒤에서를 선택한 뒤 캠 조절을 펼친다.

```powershell
Start-Process 'http://localhost:5199/?camlab=1&lightlab=1&perflab=1'
```

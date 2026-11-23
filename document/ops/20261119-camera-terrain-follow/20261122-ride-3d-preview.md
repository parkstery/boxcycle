# 지형·건물 독립 비교와 FPS

후속: [최소24FPS·원거리300m 후보·조사와 제안](20261122-terrain-distance-and-quality.md). 같은5218에 원거리 버튼과 최저1초FPS 판정을 추가했다.

수행 Codex · 2026-11-22. 작업 폴더 `C:\20.HDev\boxcycle`. Chief 지시: 브라우저에서 지형 ON/OFF와 건물 ON/OFF를 선택하고 FPS를 확인한다. 전용 로컬 프리뷰 준비 완료. 제품 기본 선택·고정 UI·네트워크/기록 정책은 유지하며 커밋·푸시·배포하지 않았다.

## 실행과 확인

전용 서버 5218. 기존 5212/5214/5216 및 Firebase 에뮬레이터를 종료하지 않고 재사용했다. 새 PowerShell에서 아래 한 줄을 실행한다. 이미 전용 서버가 켜져 있으면 재사용 주소만 안내한다.

```powershell
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-ride-3d-preview.mjs"
```

접속: http://127.0.0.1:5218/?maxdpr=1.5&perflab=1

1. Guest 진입 시 기본 위치 선택 → 메뉴에서 경로 선택 → 주행 시작. 기존 수동 속도 또는 센서를 사용한다. 이 주소의 인증·주행 데이터는 로컬 에뮬레이터 대상이다.
2. 지도 스타일을 Standard 낮으로 선택한다. 주행 중 버튼이 숨겨졌으면 지도 빈 곳을 누르면 나타난다. 지도 스타일 버튼에서 야외 → Standard 낮 순으로 전환한다.
3. 위쪽 중앙 「3D 표현 비교」의 지형/건물을 각각 전환한다. 주행은 계속된다. 건물은 일반 건물과 3D 랜드마크를 함께 제어하며 가로수는 ON으로 고정한다. Outdoors에서도 토글은 작동하나 가로수 비교 대상은 없다.
4. 실제 적용 상태가 선택과 일치하고 안정화된 뒤 「10초 측정」을 누른다. 네 조합을 같은 경로·속도·카메라·줌·화면 크기에서 비교한다. 필요하면 패널 제목을 눌러 접는다. 접혀도 실시간 FPS는 보인다. 경로 모달을 가리면 먼저 접는다.
5. 각 결과 행에 10초 평균 지도 렌더 FPS와 프레임 간격 p95가 남는다. 「결과 복사」로 선택/실제 적용 상태, 카메라·캔버스·스타일·조명·시각과 결과를 복사한다. 페이지 새로고침은 결과를 초기화한다.

`127.0.0.1`은 개발 PC에서만 접속한다. 실폰 원격 접속/Hosting 배포는 이번 범위에 없다.

## 구현·측정 의미

- `VITE_RIDE_3D_PREVIEW=1` 전용 빌드에서만 앱 이벤트 브리지가 활성화된다. 일반 빌드는 구독하지 않고 이벤트를 무시한다. 전용 패널은 이 빌드에만 삽입한다.
- 지형 OFF는 `setTerrain(null)`이며 배율0 자동평면과 구분한다. 카메라 pitch를 0으로 만들지 않는다. 의도적 지형 OFF 동안 guard를 시작하지 않아 건물만 켠 조합을 보호한다. ON 복귀 시 기존 지형 보호를 다시 적용한다. 건물만 바꿀 때 guard를 재시작하지 않는다.
- Standard에서는 `show3dBuildings`와 `show3dLandmarks`로 건물을 제어하고 `show3dTrees`는 true로 고정한다. `show3dObjects` 전체 OFF로 건물 비용을 측정했다고 오인하지 않는다. 실제 설정은 패널에서 다시 읽는다.
- 실시간 값은 최근2초의 Mapbox `render` 이벤트 간격이다. 측정용 강제 repaint·카메라 고정·캐시 우회는 없다. 10초 평균은 그 시간 안에 발생한 render 이벤트 수/10이며 p95는 연속 render 이벤트 간격이다. GPU 전용 시간이나 디스플레이에 실제 표시된 프레임을 측정한 값은 아니다. 화면이 정지해 렌더가 멈춘 상태는 성능 비교에서 제외한다.
- 전환 후3초 안정화를 요구하고 선택/실제 상태가 다르면 측정을 시작하지 않는다. 측정 중 옵션·지형 보호·탭 숨김·스타일/조명·캔버스 해상도가 바뀌면 취소한다. 주행 위치/자동 카메라 자세는 자연스럽게 변하므로 이 실험만으로 동일 장면의 정밀 효과량을 단정하지 않는다.
- Mapbox 공식 설정: https://docs.mapbox.com/map-styles/reference/standard/

## 검증과 한계

통과:

- 실제 apply3DState를 추출·실행한 Standard/Outdoors 네 조합, 수동OFF·자동평면 보호·일반 빌드 격리 및 이벤트 구독 해제: **12/0**.
- FPS 패널: 합성 render 이벤트300개/10초 →30FPS·p95 약33.3ms, 전환·탭 숨김·스타일 변경 취소: **2/0**. 성능 성공 수치가 아니라 계수기 검증이다.
- map quick **183/0**, TypeScript build 통과, ESLint 오류0(기존 MapView 경고10), dev-tools PASS(기존 만료 경고11), 의존성 방향/순환0, diff 공백 검사 통과.
- 격리 production 프리뷰 빌드·서버 시작 통과. HTTP HTML/패널 연결과 운영 Firebase 접속 차단 CSP 확인.
- Ego 실제 브라우저: Guest→에뮬레이터 퍼블릭 경로(원주3.42km)→수동5km/h 주행→Standard 낮. 네 조합에서 DEM null/1배, 건물·랜드마크 설정, 가로수 true 및 카메라 이동 확인. ON 복귀와 10초 결과 저장·옵션 변경 시 측정 취소 확인. 증거 `tmp/ride-3d-browser-states.json`, `tmp/ride-3d-browser-measure.json`.

초기 map 시험2건은 추출 하네스의 옛 effect 의존성 및 새 preview 함수 stub 누락으로 실패했다. 하네스 연결을 갱신한 뒤183/0. 초기 패널 시험1건은 토글 뒤 fake-map의 실제 건물 상태를 바꾸지 않아 실패했으며 상태를 일치시킨 뒤2/0. 실제 브라우저에서 상단 패널이 메뉴/경로 행을 가린 것을 확인해 중앙 배치·접기 안내로 보완했다. Ego screenshot은15초 응답 시간초과로 시각 검수를 완료하지 못했으나 DOM/API 검증과 실제 토글은 진행됐다.

미실행: 실폰/실센서·발열·장시간 FPS 비교 및 최종 외관 검수. Ego 세션의 render 이벤트는 약1Hz로 관측되어 이번 브라우저 숫자를 기기 성능 결론으로 사용하지 않는다. Chief의 실제 브라우저에서 측정한다. 이전 커스텀 후보의 지형 정지 불합격 판정은 유지한다.

재현:

```powershell
node --test "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\test-ride-3d-preview.mjs" "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\manual-ride-3d-preview.test.mjs"
Set-Location "C:\20.HDev\boxcycle\apps\web"; node "C:\20.HDev\boxcycle\apps\web\scripts\test-quick.mjs" map
Set-Location "C:\20.HDev\boxcycle\apps\web"; node "C:\20.HDev\boxcycle\node_modules\typescript\bin\tsc" -b
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-ride-3d-preview.mjs" --check
```

소스 변경 후에는 같은5218 서버를 유지하며 다음 명령으로 재빌드하고 브라우저를 새로고침한다.

```powershell
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-ride-3d-preview.mjs" --rebuild-only
```

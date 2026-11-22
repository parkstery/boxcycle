# 기본 렌더 지형 높이 1.3 / 1 비교

수행 Codex · 2026-11-22 · 작업 폴더 `C:\20.HDev\boxcycle`. 로컬 준비 완료, Chief 직접 주행 대기. 커밋·푸시·배포 없음.

## 후속 결정 — 제품 기본1배 채택

Chief가 「1.3배와1.0배의 차이가 느껴지지 않는다. 굳이1.3배를 할 필요가 없겠다. 1배로 변경한 상태로 하고 커밋해」 지시했다. 제품 기본값을1배로 변경했다. 일반 제품 빌드는 쿼리를 무시하며 항상1배다. 전용 로컬 비교만 명시적 `terrainscale=1.3`을 허용하고, 미지정/잘못된 값은1배다. 아래의 기본1.3·검수대기·미커밋 설명은 준비 당시 기록이다. FPS 개선이나1.3/1의 정량 차이는 주장하지 않는다.

지도 DEM·카메라 높이/시선·충돌 health·자동평면에서3D 복귀 모두 같은1배를 사용한다. 수동OFF·결측 보호·3m/0.6m 여유·추적 주기·표고/코칭 데이터는 유지했다. Chief가 비교한 체감 결과를 바탕으로 채택했으며 에이전트 추가 주행은 하지 않았다.

재검증: 전용1배25/0·전용1.3배25/0·일반 빌드에서1.3쿼리 무시/1배25/0, 전환판2/0, map quick183/0, tsc·제품 production 빌드 통과(큰 번들 경고 유지), dev-tools/방향 게이트 통과(기존 만료 경고11). 원본 pre-commit ESLint(변경8파일)도 통과했고, 준비/제품 변경17파일을 본 커밋으로 정리했다. 일반 빌드의 실주행·배포는 수행하지 않았다.

5216 기존 서버를 유지한 채 전용 비교 빌드도 갱신하고 HTTP200·생산 JS/전환판의1배 기본값을 확인했다. 아래1배 주소에서 Ctrl+F5 하면 된다. 이후 서버 시작 시 안내 주소도1배다. `--rebuild-only`는 기존 서버를 유지하며 재빌드만 하는 옵션이다.

## 사용

현재 전용 프리뷰 **5216 실행 중**. 기존 5212 커스텀 후보와 5214 서버는 유지했다. 에뮬레이터는 기존 프로세스를 재사용한다.

- 1.3배: http://127.0.0.1:5216/?maxdpr=1.5&perflab=1&terrainscale=1.3
- 원래 높이 1배: http://127.0.0.1:5216/?maxdpr=1.5&perflab=1&terrainscale=1

서버가 꺼져 있을 때 새 PowerShell 창에서 실행한다. 실행기가 필요한 작업 폴더로 이동하고, 에뮬레이터가 없으면 직접 시작한다. 종료는 Ctrl+C. 이미 5216이 켜져 있으면 주소로 접속한다.

```powershell
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-terrain-scale-preview.mjs"
```

1. 1.3배 주소 접속 → 같은 코스 선택 → 직접 주행 → 카메라2 또는3. 왼쪽 위 「지형 높이 비교 · 기본 렌더 · 1.3배」와 실제 `3D 1.3배` 확인. 자동평면은 `자동평면`, 수동 OFF는 `3D OFF`로 구분한다. 배율1도3D다.
2. 비교판을 접어 지도 공간을 확보하고, 같은 코스·속도·카메라 번호/줌 조작·화면 크기·DPR·스타일·레이어 조건으로 확인한다. 지형·도로·라이더의 연속 이동, 지형 관통·시야 가림·불필요한 평면 전환을 관찰한다. `maxdpr=1.5`는 상한이며 기기DPR1이면 실효1이다.
3. 성능 Lab의 결과를 복사하고, 비교판의 「결과 복사」도 따로 보관한다. 후자는 기본 렌더 모드·선택 배율·실제 배율/3D 상태·카메라 자세·화면/버퍼 크기·스타일·시각을 담는다. 서로 다른 시각의 성능/상태를 같은 표본으로 묶지 않는다.
4. 주행 종료 후 비교판의 「원래 높이 1배」 선택 → 새로고침 확인 → 같은 코스로 다시 시작한다. 선택 변경은 페이지 전체를 다시 열므로 주행 중 누르면 현재 주행이 종료된다. 두 주소를 번갈아 사용해도 된다. 다른 배율도 같은 방식이다.
5. 자동평면/복귀·수동OFF도 별도로 확인한다. 배율별 카메라의 실제 높이·pitch가 달라질 수 있고, 주행 위치/시점도 달라지므로 단순 전환 수치를 동일 장면의 FPS 효과량으로 단정하지 않는다. 이 주소는 개발PC 전용이다.

## 변경

`lib/map/rideTerrainScale.ts`가 전용 빌드 `VITE_TERRAIN_SCALE_PREVIEW=1`에서만 쿼리를 읽는다. 허용 선택은1/1.3, 기본1.3. 일반 제품 빌드는 쿼리가 있어도1.3이다. follow의 DEM 설정, 카메라 표시 높이·시선 보정, guard의 충돌 판정·자동평면에서 복귀할 높이가 같은 선택값을 쓴다. 자동평면0·수동OFF null 및 기존 시간 정책을 보존했다. 라이더는 기존 exaggerated 조회로 실제 렌더 높이를 따라가므로 수정하지 않았다.

새 실행기/전환판은 기존 후보 파일·overlay probe를 로드하지 않는다. 카메라/지도 쓰기 메서드를 감싸거나 교체하지 않고, 선 표현식·레이어·카메라 갱신 주기·프레이밍·3m/0.6m 여유를 변경하지 않는다. 표고 그래프·코칭 데이터는 수정하지 않았다. 전환판의1초 간격은 상태 표시만 갱신한다. 배율 변경은 전체 로드로 분리해 두 배율 사이의 카메라/평면 복귀 상태를 섞지 않는다.

등록부 `dev-tools.json`에 `terrainscale` 쿼리(만료2026-12-22), `dep-layers.json`에 map 도메인 소속을 추가했다. 새 별도 산출물은 `tmp/terrain-perf/terrain-scale-preview-dist`다.

## 검증

통과:

- 배율별 회귀25건×3조건=75/0: 전용1배·전용1.3배·일반 빌드에서1배 쿼리 무시. 카메라2/3 지상고·시선·렌더 배율 전환 유예·결측·수동OFF·guard·실제 MapView lifecycle 포함.
- 전환판2/0: 읽기 전용 지도 stub으로 상태/복사·자동평면/OFF·불일치 표시, 새로고침 동의와 기존 쿼리 보존 확인.
- 지도 quick183/0(22파일). 기존 미등록 `interval-route-hint` 경고 유지.
- TypeScript build, 변경8개 TS/시험 파일 ESLint, 새 실행기/전환판 문법, 공백 검사 통과.
- dev-tools·의존성 방향 검사 통과. 기존 도구 만료 경고11건 유지. 최초 검사는 새 쿼리/파일 미등록으로 실패하여 등록 후 통과했다.
- 격리 emulator 모드 Vite 생산 빌드 통과(기존 큰 번들 경고). 5216 HTML/전환판/생산 JS HTTP200, 선택 기능이 실제 번들에 포함됨을 확인. 기존 후보 스크립트 미연결, 운영 Firebase 접속 차단 CSP 확인.

처음 회귀 명령은 Windows의 Node `--import`에 드라이브 경로를 직접 넣어 실행 전 실패했다. 파일 URL을 사용하는 아래 재현 실행기로 수정했다. 초기 새 terrain setup stub의 카메라 메서드 누락 경고도 stub을 보완한 뒤 위75건을 다시 실행해 통과했다.

미실행: 자동 주행·실제 WebGL 주행·실폰/센서·FPS 효과 측정. Chief가 직접 판정한다. 커스텀 후보의 지형 정지 UX 불합격은 유지한다.

복사 가능한 재현 명령:

```powershell
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\test-terrain-scales.mjs"
node --test "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\manual-terrain-scale-preview.test.mjs"
Set-Location "C:\20.HDev\boxcycle\apps\web"; node "C:\20.HDev\boxcycle\apps\web\scripts\test-quick.mjs" map
Set-Location "C:\20.HDev\boxcycle\apps\web"; node "C:\20.HDev\boxcycle\node_modules\typescript\bin\tsc" -b
node "C:\20.HDev\boxcycle\scripts\check-dev-tools.mjs" --check
node "C:\20.HDev\boxcycle\scripts\check-dep-direction.mjs" --check
```

실행기의 `--prepare`는 재빌드·임시 HTTP 확인 후 종료한다(5216 실행 중에는 사용하지 않는다). 일반 시작은 위 명령이다. `--refresh-ui`는 전환판만 갱신하므로 TS 변경 후에는 다시 빌드해야 한다.

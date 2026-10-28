# 라이더·경로 지형 높이 정합

## Chief 지시와 범위

라이더를 drape된 경로와 같은 표시 높이에 배치한다. 미로딩 지역은 기존0m 처리 유지, 추가 대응 없음. 지형 강조1.3·표고 그래프·DB·동기화·카메라·자산은 변경하지 않는다. 최초 경사 자세 질문은 자문만 수행했으며, 후속 Chief 「지면 경사에 따라 자전거도 기울어지게 하자」 지시로 아래 경사 회전을 구현한다.

## 구현

`apps/web/src/lib/map/riderPreservedLayer.ts`의 공통 self/peer/pacer 루프에서 `queryTerrainElevation` 옵션을 `exaggerated:false`에서 `true`로 교정했다. 지형 강조가 반영된 높이를 Mercator 좌표의 고도로 사용한다. 조회 횟수·렌더 횟수·API·저장·패킷 필드 추가 없음. null/예외0m 유지.

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`.

- `node --test scripts/rider-preserve/preserved-layer-contract.test.mjs`: 6PASS/0FAIL, exit0. 기존 정적 계약 시험이며 실제 지형 접지 시각 검증은 아님.
- `npx eslint src/lib/map/riderPreservedLayer.ts`: exit0.
- `npm run build`: tsc·Vite exit0, 큰 청크 경고 있음.
- 루트에서 `git diff --check -- apps/web/src/lib/map/riderPreservedLayer.ts`: 출력 없음. 후속5027 포트 조회는 listener를 찾지 못해 묶음 명령exit1이었으며 diff 실패가 아님.
- 실제 지도/스마트폰/FPS 측정은 미실행. 서버·DB·동기화 변경 없음에 따라 해당 시험 미실행. 커밋·푸시·배포 없음, 기존dirty 보존.

## 확인 방법

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5031'
npm run dev:localhost -- --strictPort
```

`http://127.0.0.1:5031/`에서 기존 진입 절차 후 경로 선택→맵 뷰3D ON→주행, 언덕에서 본인/동행/페이서 접지 및3D OFF/ON 확인. 포트5031은 안내용이며 이번 작업에서 서버를 시작하지 않았다. 운영 사이트에는 미반영.

## 최초 경사 자세 비용 자문(구현 전 가정)

중심점1회 조회를 앞뒤2회로 대체하면 경사 갱신당 라이더마다 조회1회 추가. 초당10회·10명이면100→200회/초(설계 예시, 실측 아님). 각도·보간·회전 비용 추가, 메시/그리기 횟수 증가는 필요 없음. 로드된 DEM 재사용·각 기기 계산 시 백엔드/DB/동기화 트래픽 추가0 설계 가능. 실제FPS·발열 영향은 폰 측정 필요. 미구현.

## 후속 지시: 지형 경사 회전 구현

- 합격 기준: 평면 수평, 오르막 앞쪽 상승/내리막 하강, 역방향 경사 부호 반전, 모든 진행방향에서 지면 기준 회전, 기존 코너링 롤 유지, self/peer/pacer 독립,2D 전환 즉시 수평,GLB/리그 불변.
- `riderTerrainSlope.ts`: 기존 리그 허브X좌표 앞0.583m/뒤−0.412m를 구면 좌표로 이동, 배율 포함 DEM 고도 차이로 atan2 경사 계산.10Hz 샘플·150ms 지수 보간. 로컬Z축 경사 후 로컬X축 코너링/흔들림 롤 합성. 기존 렌더러의 중심점 높이는 유지한다.
- 앞뒤 경사 조회는 초당 최대20회/라이더가 **추가**된다(최초 샘플2회 포함). 중심점은 기존 프레임마다 조회를 유지하므로 위 최초 자문의 「중심점 대체」 가정과 다르다. 높이를 지형에 계속 붙이면서 경사만 저빈도로 계산한다. 화면 표시 라이더10명이면 경사 조회최대200회/초 추가, 외부 요청 아님. 실제CPU/FPS 미측정.
- 미로딩 고도 추가 보관/지형 프리패치 없음. 앞뒤 쿼리 중 하나라도 없으면 경사 목표0.2D는 쿼리/상태제거, 사라진id·레이어제거 시 상태정리. 그리기횟수·자산·서버/DB/패킷변경 없음.
- 확인 순서: 앞의 로컬 명령으로 실행→언덕 경로에서3D ON→본인/동행/페이서 오르막/내리막→전후좌우 시점→회전구간 코너링→3D OFF/ON. 실제지도·폰 시각검증은 미실행, 수치 회전 검증과 구분한다.
- 추가 시험: `node --experimental-strip-types --test scripts/rider-preserve/rider-terrain-slope.test.ts scripts/rider-preserve/preserved-layer-contract.test.mjs` **15PASS/0FAIL**. 부호·방향별 Mapbox 좌표변환·코너링합성·한국위도/날짜변경선·조회횟수·보간프레임독립·2D·미로딩·상태분리/정리 검증.
- `npx eslint src/lib/map/riderPreservedLayer.ts src/lib/riderPrototype/riderTerrainSlope.ts scripts/rider-preserve/rider-terrain-slope.test.ts` exit0. `node scripts/check-dep-direction.mjs --check`(리포 루트) 방향위반0·순환0 PASS.
- 후속 `npm run build`: tsc·Vite exit0(큰청크경고). `npm run test:quick`: **1402PASS/3FAIL**,122.5초. 실패3개는 기존 watchdog 자식프로세스 종료/격리 시험이며 접근거부 확인. 권한 허용 실행에서 `node --test scripts/e2e/e2e-deadline-watchdog.test.mjs` 재검증 **4PASS/0FAIL**(8.9초,exit0). 원래 quick 실행을 전체성공으로 바꾸어 기록하지 않는다.
- 제품/문서 대상 `git diff --check`: exit0(LF→CRLF 안내만 있음). 프로세스 조사 `Get-CimInstance Win32_Process`는 접근거부 exit1, watchdog 자체 재실행은 위와 같이 통과.
- 후속 구현도 커밋/푸시/배포 없음. 폰FPS·발열 및 실제지도 시각검증은 미실행, 수치시험·빌드 검증 완료 상태.

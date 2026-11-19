# 3D 부담 비교 도구 구현

수행: Codex · 2026-11-19. 상태: 로컬 검증 완료, 미커밋·미푸시·미배포.
Chief 「지금 할 수 있는 것」의 권장 순서에 「진행해」: DPR 수동 비교 준비, 전환 원인 기록, 지형·건물·라이더 분리 측정 도구 범위다. 자동 품질 조절·DPR 기본값·반응형 배치는 이번 범위가 아니다.

## 변경

- `src/lib/debug/renderingDiagnostics.ts`: perflab에서만 지도 canvas의 context lost/restored를 관측한다. 이벤트 시각·페이지 경과 시간, 지형 health/자동 평면 상태, 실제 CSS/canvas/WebGL 버퍼 크기, 요청 DPR 상한, 실제 terrain/건물 visibility/라이더 레이어 유무를 보존한다. 이벤트는 최근 120개, 잘린 개수도 보고한다. 같은 health의 반복은 저장하지 않는다.
- 기존 lazy `perfLabFacade`/`perfLabRuntime`에 연결하고 지도 제거 시 구독을 해제한다. perflab JSON 복사 결과의 `rendering`에 포함한다. 서버 전송·추가 polling·context 복구 정책 변경 없음. 계측 등록 이전의 사건은 알 수 없다. `latest`는 종류별 마지막 관측이며 현재 모드는 `state`와 함께 해석한다.
- `mapcut=riders`: preserved 라이더의 렌더·자세 계산을 생략한다. 라이더 위치 동기화·모델 로드·자산과 VRAM은 유지한다. `latest.rider-render=skipped-by-mapcut`은 실제 준비된 라이더 render 진입 때 기록된다. 이 값이 없으면 OFF 실측 성공으로 취급하지 않는다. 레이어 유무만으로 라이더가 그려졌다고 판단하지 않는다.
- MapView 자동 평면/3D 복귀 때 mapcut을 다시 적용한다. 측정용 terrain/buildings OFF가 전환 중 되살아나는 것을 방지한다. 쿼리가 없으면 mapcut은 기존처럼 아무 지도 API도 호출하지 않는다.
- 새 debug 모듈을 `apps/web/dep-layers.json`의 기존 debug 도메인에 등록했다.

화면 고정 계약: 주행 계기·센서·버튼·패널의 형태/기능/배치, 수동 3D OFF 및 자동 복귀 정책, DPR 기본2 유지. 자산/GLB/페달링/peerMotion 알고리즘 변경 없음. 구현은 현재 HANDOFF의 직접 구현 지침에 따라 Codex가 수행했다.

## 비교 순서

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 Vite `127.0.0.1:5000` 사용. 기존 서버 시작·종료 없음.

1. DPR: `http://127.0.0.1:5000/?perflab=1&maxdpr=2` → 같은 주소의 maxdpr를 1.5, 1로 변경하고 매번 새로고침한다. 상한이므로 기기 원래 DPR보다 높이지 않는다.
2. 장면 분리: DPR을 하나로 고정하고 기준 장면 → `&mapcut=terrain` → `&mapcut=buildings` → `&mapcut=riders` → 기준 장면 순서로 각각 새로고침하여 비교한다. 한 번에 한 종류만 제외한다.
3. 같은 경로·카메라·라이더 수를 사용하고 초기 로딩 후 안정 구간을 반복 측정한다. perflab 패널 펼침 → 결과 복사. 수치와 함께 `rendering.state`, `latest`, `events`를 보존한다. 기준 장면부터 실제 3D terrain/건물이 있어야 분리 비교가 성립한다. 자동 평면 상태와 terrain cut으로 고정한 평면은 구분한다.
4. `state.terrain=null`, buildings visibility 또는 레이어 부재, `latest.rider-render`로 실제 OFF를 확인한다. style/context가 불안정하면 state는 null일 수 있으므로 유효한 비교로 판정하지 않는다. terrain OFF는 높이·접지도 달라지는 장면 제외 실험이다.
5. 끊김/평면 전환이 발생하면 즉시 복사한다. 복구 후 `contextLost=false`여도 앞선 lost 이벤트가 있으면 보존된다. 이벤트 종류가 있다고 메모리 부족이 원인이라고 단정하지 않는다.

운영의 기존 DPR 비교는 `https://boxcycle-dc2df.web.app/?perflab=1&maxdpr=1.5`에서 가능하다. 신규 `rendering` 기록과 riders OFF는 배포 전이므로 현재 로컬에서만 확인한다. 폰에서 127.0.0.1은 개발 PC가 아니므로 신규 계측 폰 시험에는 별도 접근 가능한 개발 서버 또는 검증 배포가 필요하다.

전체 GPU 시간과 CPU 시간은 기존 breakdown/rider 필드를 구분해서 본다. rAF fps를 실제 지도 렌더 fps로 간주하지 않는다. 컴포넌트별 실제 VRAM 사용량이나 GPU timer 미지원 기기의 GPU ms를 제공하는 도구는 아니다. 계측 이벤트 시점의 스냅샷 수집 비용도 있으므로 안정 구간과 전환 구간을 분리한다.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rendering-diagnostics.test.ts scripts/map/rider-map-cut.test.mjs scripts/map/map-cut-contract.test.ts scripts/map/ride-terrain-guard.test.ts scripts/map/ride-terrain-lifecycle.test.mjs scripts/map/rider-map-pixel-ratio-contract.test.ts scripts/perf-lab.test.ts scripts/frame-breakdown.test.ts scripts/rider-preserve/preserved-layer-contract.test.mjs
node ../../node_modules/typescript/bin/tsc -b
node ../../node_modules/vite/bin/vite.js build
node ../../scripts/check-dep-direction.mjs --check
```

- 관련 시험: 49/0 및 기존 분해/라이더 회귀 16/0, 합계 **65통과/0실패**. loss→restored 이력 보존·120개 제한·복사 격리·구독 해제·미활성 무호출, 실제 MapView effect의 cut 유지 및 실제 rider render 메서드의 생략/정상 진입을 검증했다. 정상 렌더 전체의 GPU 출력 시험은 아니다.
- 타입 검사·Vite build 통과. 변경 파일 ESLint 오류0, 기존 MapView hook 경고10. 번들 크기 경고는 남는다. 의존성 방향 게이트 통과, 방향 위반0·순환0. diff 공백 검사 통과.
- PC 실제 브라우저 WebGL, CSS800×360·DPR3 에뮬레이션: 상한2→1600×720, 1.5→1200×540, 1→800×360을 신규 기록에서 확인. 실제 폰 GPU 시험이 아니며 인증/주행 전 지도 관측이다. 증거: `tmp/rendering-diagnostics-20261119/dpr-observations.json`.
- 실패 후 수정: 최초 mapcut 키 수 기대값 및 VM effect 새 계측 의존성 미등록으로 2실패 → 신규 키와 계측 spy 반영 후 통과. 최초 tsc의 앱 내부 node_modules 경로는 없음 → 루트 설치 경로로 실행해 통과. 의존성 검사 미지정1건 → 기존 debug 도메인 등록 후 게이트 통과.
- 라이더 실제 브라우저 벤치: evaluate 15초 응답 시간 초과로 중단·브라우저 공간 종료. GPU 비교 결과 없음. production render 메서드를 실행하는 시험으로 분기 검증만 완료했다.
- 실기기: `adb devices -l` 연결0. 폰 장시간 성능/문제 순간/센서 주행/지형·건물·라이더 실제 GPU 비용 순위는 미측정. 전체 quick·실주행 e2e는 미실행(진입/동기화/UI 정책 변경 없으며 관련 회귀 중심 검증).

다음: 접근 가능한 폰 환경에서 위 순서의 동일 장면 반복 측정. 결과가 나온 뒤 DPR 기본값/적응형 정책을 결정한다.


11-19 배포 준비: Chief 커밋·푸시·배포 승인. 진단의 riderLayerPresent=false 오표시는 getStyle 직렬화가 custom layer를 제외하는 문제로 확인해 live getLayer 조회로 변경했다. 시험 fake-map도 custom 레이어를 직렬화 목록에서 제외해 회귀를 검증한다. 흰 화면 오류는 Chief 지시로 보류. FPS 병목 최적화나 건물 충돌 변경은 이번 배포에 추가하지 않는다.

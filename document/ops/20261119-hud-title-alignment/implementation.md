# RPM 포함 계기판 타이틀 정렬 구현

2026-11-19 · Codex 직접 수행. Chief 「rpm 타이틀 높이도 맞춰!」 후 실제 앱에 적용. Chief 요청으로 로컬 커밋·미배포.

`MapHud.css`의 주행·일시정지·결과 계기판(active-ride)에만 위 정렬을 적용했다. RPM 센서 캡슐에도 일반 캡슐과 같은 위 패딩2px을 주고 라벨11px·값18px 줄 높이를 통일했다. RPM/거리/시간/속도/새 도로/평균 6개 모두 같은 top, 보조 안내가 있어도 위치가 변하지 않는다. 센서30px 단추·44px 터치 영역·폰트/색/순서·센서 설정 동작 유지. 대기 계기판 규칙은 그대로다. 고정85에 Chief 후속 지시 기록.

검증은 실제 컴포넌트 preview의 가로4크기(800×360·736×300·699×273·667×300)×주행/일시정지/결과에서 RPM을 포함한 라벨6개의 top, 숫자6개의 top, 보조 안내 토글 전후 높이 불변, 센서 크기·설정 열림을 확인했다. preview의 `ownedHint`는 0m 보조 안내 상태용 메모리 fixture이며 제품 데이터/동작을 변경하지 않는다.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:SENSOR_DOCK_EVIDENCE_DIR='C:/20.HDev/boxcycle/tmp/hud-title-alignment-20261119/sensor'
node ../../node_modules/@playwright/test/cli.js test 'hud-title-alignment.spec' sensor-dock ride-summary-hud --workers=1 --retries=0
node scripts/ride-verify/verify-selectors.mjs
node ../../node_modules/typescript/bin/tsc -b --noEmit
node ../../node_modules/eslint/bin/eslint.js e2e/hud-title-alignment.spec.ts scripts/ui-800x360/preview.tsx
node ../../node_modules/vite/bin/vite.js build
```

초기 시험은 제목/숫자 정렬 검사를 모두 통과한 뒤 크기 검사에서 메뉴의 같은 LED 도안까지 선택해 strict 위반12건. 선택자를 해당 계기판 센서 버튼 내부로 좁혔다. 센서/결과 회귀19건은 첫 실행에서 통과. 수정한 정렬12건은 별도 재실행에서12/12 통과(합계31/31). tsc·변경 TS/TSX ESLint·진입 셀렉터21·Vite build 통과(기존 대형chunk 경고). 실기기/실센서/Firebase 주행 저장·전체quick은 이번 CSS 변경 범위에서 미실행. 증거 `tmp/hud-title-alignment-20261119/{riding,paused,summary}.png`.

서버 `http://127.0.0.1:5000/` 새로고침 → 주행/일시정지/결과에서 RPM과 나머지 타이틀 높이 확인. 서버 쓰기 없이 실제 컴포넌트를 확인하려면 `http://127.0.0.1:5000/scripts/ui-800x360/preview.html?state=riding&ownedHint`.

서버가 꺼졌을 때:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5000 --strictPort
```

앞선 시안의 `preview.png`는 당시 비교 기록이다. 제품에 적용된 최신 모습은 위 실제 컴포넌트 캡처/주소에서 확인한다. Chief 요청으로 로컬 커밋. 푸시·Hosting 배포 없음.

# 감리11 — 경로 팝업 3항목 / LOCAL_VERIFIED

2026-10-21 Codex Supervisor. Chief 요청 그대로 구현: 별도 생성버튼 제거·수단 클릭 즉시 생성, 삭제버튼 하단 수단 오른쪽 이동, 두 모드 탭 제목 오른쪽 21px/10.4px 한 줄. 모드·삭제·접근성/키보드 계약 유지. 서버/인증/데이터/토큰 정책/주행바 변경 없음.

Cursor Composer 2.5 session `76c69c70-1688-4611-a2f3-54d82efb1c53`가 허용4파일+결과11 구현, exit0(250초). [지시11](02-task-11.md)·[결과11](03-result-11.md). 현재 branch codex/route-popup-compact-20261021, 시작 main2 24af44f8. 기존 ops 혼합dirty·.out/evidence/cdbox 보존.

## 독립 검수 / 보완

- 기존 fixture에는 실제 `mountRoutePickDockDrag`가 없어 상단 탭을 옮긴 뒤의 pointer capture 충돌을 놓쳤다. 실제 drag helper+닫기 버튼을 연결한 ready 단일시험이 **FAIL(exit1)**: 거리탭 클릭후 위치패널이 그대로 보임. Supervisor가 탭 pointerdown 전파만 차단(기본 focus/click은 유지), 재시험 PASS. 단순 이벤트 흉내가 아니라 제품 drag helper를 계속 회귀에 사용한다.
- 토큰차단 시험의 mock 콜백이 자체 차단해 제품 guard를 우회해도 통과할 수 있어 mock guard 삭제. 실제 popup만 차단해야 증가0으로 통과한다. 세수단 모두 각각1회 콜백, 출발만/도착만/빈핀에서 생성0, 거리탭 수동생성0, 삭제/닫기1회 확인.
- 800×360 ready 캡처 직접 검수: title·탭·닫기 한 줄/겹침없음, 탭높이21px, 하단 수단3개+삭제, 별도생성버튼0. 667×300/844×390에도 패널·닫기·탭 화면밖/상호겹침없음. 텍스트·토큰 피드백은 줄바꿈 보존. 지도는SVGfixture이며 실제Galaxy/실Mapbox생성API시험과 구별한다.
- 마우스+터치+Home/End 탭전환에서 drag0, 제목/주소 drag에는 실제 drag1. 기존주소/주행바/에지회귀 포함 **22/22 PASS(exit0,65.4초)**. Node 거리자동경로 전체 **142/142 PASS**, selector19 PASS, 변경TS eslint오류0, 전체 web `tsc -b` PASS. npm build/정상push게이트/Hosting은 후속증거로 구분한다.
- 첫 supervisor 명령의 공백 grep 인수가 Windows wrapper에서 분리되어 다른파일까지 선택: 즉시중단 후 공백없는 `ready.*모드배타`로 단일선택하여 위 red를 확인했다. 이전실패를 PASS로 덮지 않는다.
- ego-browser 스킬을 읽었으나 CLI미설치(Windows는사용자설치/온보딩필요)라 기존 Playwright로 대체. 새 브라우저 설치/사용자프로필/운영인증 쓰기 없음. Cursor가 본문4파일을 edit 도구로 편집한 점과 감독전용 예정이던 fixture7시험도 직접 실행한 점은 지시 실행상 차이로 기록한다. Supervisor 추가 수정은 apply_patch, 독립시험으로 검수했다.

## 재현 / Chief 확인

```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```

http://localhost:5000 → 800×360 → 지도지점선택 → 제목 오른쪽 두탭 전환 → 출발·도착 설정 → 자동차/자전거/도보 중 하나 탭시 즉시 경로생성 → 하단 오른쪽 경로삭제.

시험(실행폴더 `C:\20.HDev\boxcycle\apps\web`): 별도 `RTW_DEV_PORT=5025` Vite 서버를 재사용하여 Windows 자동서버 teardown 대기를 피했다.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5025'
node scripts/e2e/run-with-deadline.mjs --limit-sec 120 -- node ../../node_modules/@playwright/test/cli.js test route-ride-controls ui-800x360 --workers=1 --retries=0 --timeout=20000 --global-timeout=100000
npm run test:distance-auto-route
node ../../node_modules/eslint/bin/eslint.js src/components/map/mapPopupElements.ts e2e/route-ride-controls.spec.ts
node ../../node_modules/typescript/bin/tsc -b --pretty false
```

증거 `.out/ui-route-ride-20261021/popup-11-{empty,start-only,end-only,ready,waypoints}-800.png`, `popup-11-ready-{667,844}.png`. 실제Galaxy·BLE·새 API 응답 자체는 이번에 시험하지 않았다(콜백/레이아웃 변경만). 배포전 제품범위4파일 외 변경없음.

최종 `C:\20.HDev\boxcycle`의 `npm run build` exit0. index-Chn6MZ50.js / index-CqFpcJ0i.css. 기존 SADDLE/PELVIS export·대형번들 경고는 유지(이번범위아님), 무경고로 보고하지 않는다.

# 계기판 타이틀 높이 통일 시안

**11-19 후속: Chief 「rpm 타이틀 높이도 맞춰!」 지시로 실제 앱 CSS에 적용.** [구현·검증·접속 주소](implementation.md). 아래는 적용 전 시안 기록.

2026-11-19 · Codex 직접 제작. Chief 첨부 이미지와 「타이틀 높이 일정하게, 시안 먼저」 요청. **제품 MapHud/Cadence CSS·TSX는 이번 작업에서 수정하지 않음.** 고정81/84의 글꼴·색·크기·순서·센서 도안을 유지하며 정렬만 제안.

원인: 타이틀+값의 높이가 작은 일반 셀, 30px 센서 단추가 있는 RPM 셀, 「이미 내 도로」 안내가 붙은 새 도로 셀을 세로 중앙 정렬하므로 제목의 top이 달라진다. 실제 스타일에서 현재 RPM24.26px·일반30.26px·새 도로24px.

제안: 캡슐/상위 행은 위 정렬, 라벨11px/값18px 높이를 각각 고정하고 센서 캡슐 위 패딩2px을 일반 캡슐과 통일한다. 센서 단추의 크기/모양은 그대로이며 값 줄 중앙에서 위아래로 돌출한다. RPM·거리·시간·속도·새 도로·평균 **6개 top=24px**. 보조 안내가 나타나거나 사라져도 제목/값 높이는 일정하다.

`apps/web/scripts/hud-title-alignment-preview.html`에서 실제 컴포넌트 DOM/기존 CSS를 복제해 위 현재/아래 제안 비교. 예시 수치와 파란 배경은 첨부 이미지에 맞췄다. 내부 복제본은 표시 전용이므로 센서 조작/실제 주행과 연결되지 않음. 시안 확인 뒤 실제 CSS에 최소 적용할 예정.

검증: ego-browser DOM에서 여섯 top동일 확인. ego screenshot은 기존 Page.captureScreenshot 응답 오류로 실패하여, Playwright 시안 검증/캡처로 전환. 첫 검사1실패(버튼의 label 접근성 이름과 시험 문자열 불일치) 후 실제 id로 대상을 지정해 통과. 최종 **1/1 통과**: 6개 타이틀의 top동일 및 보조 안내 토글 전후 불변. 숫자 text node가 나뉜 복제 표시도 정리 후 재검증. `preview.png`가 최종 비교 이미지. 제품 변경이 없어 tsc/build/실주행/Firebase 검증은 미실행.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node ../../node_modules/@playwright/test/cli.js test hud-title-alignment-preview --workers=1 --retries=0
```

현재 서버 5000. 확인 주소 `http://127.0.0.1:5000/scripts/hud-title-alignment-preview.html`. 위/아래 비교 → 「이미 내 도로 숨기기」를 눌러 제목 위치 확인.

서버를 다시 시작할 때:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5000 --strictPort
```

Chief 요청으로 로컬 커밋. 푸시·배포 없음. 앞선 결과창 작업 및 타 작업 변경은 보존.

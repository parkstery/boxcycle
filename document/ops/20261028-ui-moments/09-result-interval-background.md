# 인터벌 안내 반투명 검정 배경

2026-10-28 Chief 후속 지시: 맵이 비치는 검정20~30% 배경으로 인터벌 글자 가독성 개선. 소규모 CSS 작업으로 Supervisor 직접 반영.

`RideIntervalHud.css`에 `background: rgba(0, 0, 0, 0.25)`·안쪽6×8px 여백·모서리8px·border-box 적용. 부모 opacity를 사용하지 않아 글자는 기존 선명도 유지. 표시 전용 pointer-events:none 유지. 고정31에 고정7 배경없음 원칙의 인터벌 예외 기록.

검증: `e2e/ride-interval.spec.ts` **6 PASS (22.9초)**. 준비/전환/일시정지/재개/완료 및 800×360·667×300·844×390에서 비겹침·지도 터치 통과·계산된 배경25% 확인. 최초 실행은 기존 투명배경 기대값으로3 PASS/3 FAIL, 최신 Chief 요구의25%로 갱신 후6 PASS. 로그 `evidence/interval-background-initial.log` / `interval-background-check.log`. 실제 제품 컴포넌트 캡처 `evidence/interval-background/`(지도·수치는 fixture). 전체quick/build는 CSS 변경만으로 재실행하지 않음. 기존 증거10장 원본 미복구는 직전 인계와 동일. 커밋·푸시·배포 없음.

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

기존5031 서버 실행 중이면 재사용. http://localhost:5031/ 새로고침→인터벌 켜기→주행. 빠른 확인 http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding&interval&intervalMs=330000 .

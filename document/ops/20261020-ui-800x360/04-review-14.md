# 지명 겹침 대비 검수

| 항목 | 내용 |
|---|---|
| 문서 유형 | record |
| 작성 | 2026-10-22 |
| 판정 | LOCAL_VERIFIED / Chief 외관 확인 대기 |
| 연결 | [지시14](02-task-14.md) · [결과14](03-result-14.md) |

지명 중첩 캡처 직접 확인: 글리프 외곽이 두꺼워지고 배경 지명과의 분리가 강화됨. 박스 배경 없음. 겹침 자체를 없애는 방식은 아니므로 실지도/폰 외관은 Chief 확인 대기.

`npx playwright test e2e/ui-800x360.spec.ts --grep '준비·주행의 지표' --workers=1 --retries=0`: 1 passed (10.0s). 800×360/667×300/844×390 × 준비/주행/일시정지의 크기·셀 내 글자·컨트롤 비겹침 PASS. `git diff --check` PASS. CSS 범위 변경으로 전체 빌드/전체 시험 미실행. 실제 위성지도·스마트폰 미검증. 커밋/푸시/배포 없음.

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

현재 5002 개발 서버 사용 가능. http://127.0.0.1:5002 에서 강력 새로고침 → 경로 선택 → 주행 시작 → 지명과 계기판이 겹치는 위치 확인. 기본 UI fixture는 http://127.0.0.1:5002/scripts/ui-800x360/preview.html?state=riding (추가 지명은 캡처용 임시 DOM 주입).

# 계기판 글리프 외곽선 검수

| 항목 | 내용 |
|---|---|
| 문서 유형 | record |
| 작성 | 2026-10-22 |
| 판정 | LOCAL_VERIFIED / Chief 외관 확인 대기 |
| 연결 | [지시13](02-task-13.md) · [결과13](03-result-13.md) |

`npx playwright test e2e/ui-800x360.spec.ts --grep '準備|준비·주행의 지표' --workers=1 --retries=0`: 1 passed (7.8s). 기존 시험으로 800×360/667×300/844×390 × 준비/주행/일시정지의 최소 글자 크기·계기 셀 내 글자·우측 컨트롤 비겹침 검증. `git diff --check` PASS.

800×360 DPR2 캡처 직접 확인: 글자 사이로 지도 배경이 보이고 캡슐 배경 없음. 계산 스타일도 투명/::before none 확인. CSS만 변경한 이번 회차에서는 빌드·전체 테스트 미실행. 실제 위성 타일·폰 미검증. 기존 dirty 보존, 배포 없음.

Chief 확인:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

현재 5002 서버 기동 상태. http://127.0.0.1:5002/scripts/ui-800x360/preview.html?state=riding 에서 강력 새로고침 → 상단 계기판의 하늘색 숫자/초록 새 도로/검정 외곽선 확인. 실제 앱은 http://127.0.0.1:5002 에서 주행 후 확인. 운영 반영 없음.

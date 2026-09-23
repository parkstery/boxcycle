# 인수인계 — 카메라 작업 (2026-09-23)

## 지금 어디까지 왔나

**지시09 수행 중/직후** — pitch 80 · 거리 현행값 **확정**, 문서 갱신, 빌드·커밋·푸시(지시09 허용).

### 제품 확정값

| 항목 | 값 |
|---|---|
| 밀착 pitch | **80°** (67° 폐기 — 지평선 소실) |
| 거리 상한 / 기본 / 하한 | **60m / 40m / 6.0m** |
| QC 2~5 preset | `max(5, MIN)` → **6m** |
| QC 1 | Route Fit · 60m · 10m 3단 |
| 디버그 | `?ridePitch=<0..85>` **유지** |

### 코드에 들어간 것 (지시01~09)

- 명칭: `rear30→forward` · `front30→backward` · `leftFlat→left` · `rightFlat→right`
- Quick Camera 1~6 (`MapHud` Account 왼쪽, 주행 중만)
- 줌 비간섭: 거리 역산 · userZoom 경로 floor 미적용
- pitch 80 확정 주석 · 원안 5m→6m 적용 경위 주석

## 남은 것 — Chief

1. **Hosting 배포** (에이전트 샌드박스 차단 — 지시09 §5):
   ```
   firebase deploy --only hosting --project boxcycle-dc2df
   ```
   (`.firebaserc` default = `boxcycle-dc2df`, public = `apps/web/dist`)
2. 실기기·실센서 육안(선택)

## 미결

- 실센서 연결 상태에서의 확인은 아직 없음
- 3D 측면 카메라 건물 가림(인벤토리 🔶) — 본 작업 범위 밖

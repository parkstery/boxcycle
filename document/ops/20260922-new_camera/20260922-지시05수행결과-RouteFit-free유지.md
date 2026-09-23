# 지시05 수행결과 — Route Fit 유지 (`free`)

- **지시**: [20260922-지시05-…](20260922-지시05-1번-RouteFit이-1초만에-풀리는-문제.md)
- **수정**: `App.tsx` Route Fit 분기 `setFollowMode("topDown")` → **`setFollowMode("free")`**
- **커밋·푸시**: 없음

---

## §0 그림

폴더: `apps/web/.out/camera-qc1-hold/`  
미러: `document/ops/20260922-new_camera/.out/지시05/`

| 파일 | 관찰 |
|---|---|
| `qc1-t0.png` | 1번 직후(+1.3s) — 스케일 **100m**, S~E 전체 경로 |
| `qc1-t3s.png` | **+3초** — 여전히 S~E 전체. 스케일/프레이밍이 Aerial 로 붕괴하지 않음 |
| `qc1-aerial.png` | 1번 재클릭 — 스케일 **5m**, 라이더 밀착 Aerial |

감리 진단과 일치: 토글 상태가 뒤집힌 게 아니라 팔로우 틱이 덮고 있었다. `free` 로 끊으니 3초 후에도 Route Fit 유지.

반증 조건(「free 로 바꿔도 되돌아감」) — **해당 없음**. mapZoom effect 추가 수정 불필요.

---

## §1 변경

```ts
// Route Fit
setFollowMode("free");  // was topDown
// Aerial 분기는 그대로 aerial + 60m
```

MapViewSheet 에 `free` 칩이 활성화되는 것은 지시대로 사실 반영.

---

## §2 검증

`npm run test:e2e:camera-qc1-hold` → **1 passed**

---

## §3 모델

Cursor Agent. 지시04 직후 폴링으로 지시05 착수.

# rider15 상체 스킨 — P3 GLB 구조 감사

- 작업 ID: `RIDER15-P3-GLB-STRUCTURE-AUDIT`
- 상태: `TOOL_READY_WAITING_FOR_CANDIDATE`
- 목적: 후보 GLB가 도착했을 때 제품 승격 전 구조 계약을 자동 감사
- 성격: 읽기 전용

## 실행 명령

```powershell
cd C:\20.HDev\boxcycle\apps\web
node scripts/rider-preserve/audit-rider-glb-structure.mjs <candidate>\rider.glb
```

## rider15 합격 기준

- `skins: 1`
- `JOINTS_0`와 `WEIGHTS_0` 존재
- 본 수가 계획과 일치
- 상체 메시가 예상 노드에 존재
- 삼각형 ≤ 24,000
- 재질 1장 목표와 실제 결과 기록
- 후보 파일 SHA256과 바이트 수 기록

이 도구는 합격 판정을 자동으로 선언하지 않고 구조 결과만 출력한다. 프리뷰, 관통, 손 고정, 성능 검증은 별도 게이트다.


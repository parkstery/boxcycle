# 거리·방향 단계별 유도 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 외관 확인 대기. [결과23](03-result-23.md).

요구3항 구현: 거리 명시 확정 후 원/화살표2회 펄스, 거리+방향이 모두 있을 때만 수단 표시, 기존 자동차→자전거→도보2사이클 강조 재사용. 방향 클릭에서는 탐색0, 자동차 클릭1/driving·거리 재입력 후 보행 클릭2/walking을 실제 MapView fixture에서 확인. 실제 Firebase/API 호출을 대체한 콜백이므로 운영 경로 응답 검증은 아니다.

아래 명령 cwd `C:\20.HDev\boxcycle\apps\web`:

| 명령 | exit | 최종 결과 |
|---|---:|---|
| `npm run test:distance-auto-route` | 0 | 144 PASS. 원 펄스 두 봉우리·종료 복원/프레임0·취소·reduced-motion 결정적 시험 포함 |
| `npx playwright test e2e/distance-direction-attention.spec.ts e2e/distance-target-arrows.spec.ts e2e/map-route-runtime.spec.ts e2e/route-ride-controls.spec.ts --workers=1 --retries=0` | 1 | 초기12 PASS/1 FAIL: Runtime 확장 뒤 기존 화살표 fixture 중복 import. alias로 교정 |
| `npx playwright test e2e/distance-direction-attention.spec.ts e2e/distance-target-arrows.spec.ts --workers=1 --retries=0` | 1 | 화살표1 PASS, 신규 reduced-motion 검사1 FAIL: 기존 CSS specificity 결함 발견/교정 |
| `npx playwright test e2e/distance-direction-attention.spec.ts --workers=1 --retries=0` | 0 | 최종1 PASS /7.4s. 최초 나머지11+화살표1+신규1=13종 분할 통과 |
| `npx tsc -p tsconfig.json --noEmit` | 0 | PASS. 최종 build에서도 타입 재검증 |
| `npx eslint src/components/map/MapView.tsx src/components/map/mapPopupElements.ts src/hooks/useDistanceAutoRoute.ts src/lib/map/distanceCircleAttention.ts scripts/ui-800x360/map-route-runtime.tsx scripts/distance-auto-route/distance-auto-route-contract.test.ts e2e/distance-direction-attention.spec.ts e2e/distance-target-arrows.spec.ts e2e/route-ride-controls.spec.ts` | 0 | 오류0, 기존 MapView warning8 |
| `npm run build` | 0 | 최종 CSS 교정 후 PASS /3.30s, 기존 큰번들·SADDLE/PELVIS 경고 |
| `git diff --check` (repo root) | 0 | PASS |

최초 거리계약1 FAIL은 기존 함수명 정규식이 commit 함수 도입을 수용하지 못한 것으로 갱신 후144 PASS. 실제 provider 미호출 계약은 유지했고 신규 브라우저로 단계별 호출 수 검증을 보강했다.

증거: `.out/step23-distance.log`, `step23-browser.log`, `step23-browser-final.log`, `step23-attention-final.log`, `step23-lint.log`, `step23-build.log`. 800×360 캡처 `.out/step23-distance-confirmed.png`(버튼 숨김), `.out/step23-direction-confirmed.png`(버튼 표시·원/방향 마커) 직접 확인. 화살표3폭·style 차분/전체교체·제거/재진입 회귀 유지. 다른 viewport의 전체 신규 단계·실제 타일 외관·실제폰 터치 체감/성능·실 API 탐색 미검증.

기존5000을 재사용했고 임시 검수 탭만 닫았다. 기존 서버/포트와21/22 미커밋 변경·공용 ops/evidence 보존. 커밋·푸시·배포 없음.

Chief 직접 확인: 현재 [localhost5000](http://localhost:5000)을 새로고침한다. 별도 실행이 필요하면:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

http://127.0.0.1:5002 → Guest/로그인 → 지도 길게누르기 → 출발 지정 → 거리·방향 → 거리 칩/숫자 Enter 확정 → 원·화살표2회 펄스와 수단 숨김 확인 → 지도 방향 클릭 → 자동차/자전거/도보 표시·순차2사이클 확인 → 수단 클릭해 탐색. 거리 변경 시 버튼 숨김·방향 재선택 확인. 출발·도착 방식도 기존 표시/탐색 확인.

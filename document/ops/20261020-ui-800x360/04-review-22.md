# 방사 화살표 최종 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 외관 확인 대기. [지시22](02-task-22.md) · [결과22](03-result-22.md).

이전 채팅의 마지막 턴은 사용량 한도로 failed. Cursor 구현은 남아 있었고 Supervisor 최종 검수가 미완이었다. 이번 인계에서 스타일 차분 전환 소실을 재현·교정하고 실제 엔진 회귀로 고정했다. 원 중심/반경·fitBounds 정책·경로 API는 보존했다. 화살표12개, 추가선분36개. 좌표 계산은 원 props 변경 시 한 번, 스타일 복원은 같은 GeoJSON 재사용. 외부 요청/서버 쓰기 추가0.

아래 명령의 cwd는 모두 `C:\20.HDev\boxcycle\apps\web`이다.

| 명령 | 종료 | 결과 |
|---|---:|---|
| `npm run test:distance-auto-route` | 0 | 143 PASS |
| `npx playwright test e2e/distance-target-arrows.spec.ts e2e/map-route-runtime.spec.ts --workers=1 --retries=0` | 0 | 3 PASS / 43.0s |
| `npx tsc -p tsconfig.json --noEmit` | 0 | PASS |
| `npx eslint src/components/map/MapView.tsx src/lib/route/distanceAutoRoute.ts e2e/distance-target-arrows.spec.ts` | 0 | 오류0 / 기존 warning8 |
| `npm run build` | 0 | PASS / 기존 큰번들·SADDLE/PELVIS 경고 |
| `git diff --check` (repo root) | 0 | PASS |

증거: `.out/resume21-distance.log`, `.out/resume21-browser.log`, `.out/resume21-lint.log`, `.out/resume21-build.log`. 직접 브라우저 검수 캡처 `.out/radial-21-800.png`, `radial-21-667.png`, `radial-21-844.png`; 800 캡처 직접 확인. 12화살표 표시, 1/120km 변경, style 차분/전체 교체 후12복원, 제거 후source0, 재진입12 확인. 최초 style 시험 FAIL은 교정 전 결과이며 최종 신규 회귀 PASS로 구별한다.

미실행: 실제 스마트폰·실제 위성 타일 외관·배터리/프레임 측정·전체 앱 실인증/실주행. 최소 지도 스타일을 사용한 실제 Mapbox 엔진 시험이다. ego-browser 실행도구 미설치로 기존 Playwright를 사용했다. 최초 브라우저 요청 가로채기의 query 매칭 누락으로 대기 실패 후 수정해 진행했다. 검증 서버는 기존5000 재사용; 이번에 시작/종료한 서버 없음. 기존 다른 포트·dirty 보존. 커밋·푸시·배포 없음.

Chief 직접 확인:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

http://127.0.0.1:5002 → 새로고침 → Guest/로그인 → 지도 길게 누르기 → 출발 설정 → 거리·방향 탭 → 목표 거리 선택 → 파선 원 안쪽의 바깥방향 화살표 확인. 거리 변경, 지도 회전/기울기·스타일 변경, 경로창 닫기/재진입 확인. 실제폰에서 화면 밀도·지도 대비 확인이 남았다. 이미5002가 사용 중이면 해당 서버를 종료하지 말고 기존 주소로 확인한다.

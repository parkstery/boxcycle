# 5km/h 동속 동행 — 프레임 회귀 가설 점검

작성 2026-10-29 · 독자 Chief/AI · 상태: 가설 점검·재생 보강 완료, 현재 실화면 원인 미확정 · [입구](README.md)

## 조건과 판단

Chief는 두 라이더 모두5km/h로 고정한 테스트에서 상대가 약20~30cm 앞뒤로 반복 이동한다고 명확히 했다. 실제 가감속 예측오차를 주원인으로 가정하지 않는다. 정상 동속에서의 시간·거리 표본 불일치와 화면 렌더 경로를 우선한다.

10-16의 이전프레임 거리/현재프레임 시각 결함과 같은 종류의 재발은 유력 조사 가설이다. 그러나 현재 코드에서 그 수정이 지워진 증거나 현장 재현은 아직 없다. 일반16.7~33.3ms 한 프레임은5km/h에서2.3~4.6cm 전진에 해당한다.20~30cm는 약144~216ms의 거리이므로, 일반적인 한 프레임 오류만으로 크기를 설명하지 않는다. 긴 프레임·주기성 표본·다른 타임라인 등이 후보이며 숫자 일치만으로 원인을 확정하지 않는다.

## 소스 대조

- `useVirtualRideSession.ts`는 `projectRideDistToFramePerfMs`를 유지한다. 동행 지연모드에서는 자기 송신표본 버퍼를 공통 시각에 보간한 결과를 사용한다.
- `MapView.tsx`의 같은 tick에서 `epochMs=performance.timeOrigin+now`를 만들고 self좌표·self거리·peer step에 넘긴다. 카메라는 해당 self좌표를 받는다.
- `PeerMotionRegistry.step`은 공통시각 준비 시 동일 프레임의 renderTime을 integrator에 잠근다.
- `git diff 1db5347e -- frameDistProject.ts commonDisplayClock.ts`상 투영함수는 변경 없고 공통시계는 진단export 제거 외 동작 변경이 없다.
- 따라서 「10-16수정이 단순히 없어졌다」는 정적 증거는 없다. 다른 경로의 시각 불일치나 운영/부하 문제는 미배제다.
- 추가 조사후보: 송신 `buildLiveLocationSnapshot`은 마지막 세션rAF 원본거리를 읽고 캡처시각은 현재시각을 붙인다. 화면용 투영과 별개인 경로다. 긴 프레임 등에서 거리의 나이와 시각이 다를 수 있으나, 이번에 결함/회귀를 확정하거나 변경하지 않았다.

## 재생 보강과 결과

`residual-peer-jitter-harness.mjs`에 다음2셀을 추가했다. 기존7셀과 판정 기준은 보존한다.

| 셀 | 조건 | 상대거리 오차 변동폭 |
|---|---|---:|
| low5equal | A/B 모두5km/h·5m간격·B송신위상80ms·네트워크sin지터·60Hz | 0.010m |
| low5equalIrregular | 동일 입력,20/30/16.7/33.3ms 프레임 반복 | 0.010m |

신규셀은 기존 일반0.8m보다 엄격한3cm residual 상한을 적용해20~30cm를 통과시키지 않도록 했다. 두셀은 송신위상을 다르게 하여 동일 표본 오차가 상쇄되는 조건을 피했다. 불규칙 프레임에서는 실제 각 프레임의 dt를Registry에 전달한다. 기존7셀의 수치는 변경 전과 동일했다. 프레임 스텝 단위로 송신/도착 이벤트를 처리하는 합성모델이며 실제Worker·세션rAF·React·Mapbox·GLB·카메라 렌더 전체는 실행하지 않는다. 현재 입력 표본은 올바른 capture거리·시각의 짝이므로 실제 stale캡처까지 검증한 것은 아니다.

이번 조건에서는 계산된 거리의20~30cm진동은 재현되지 않았다. 따라서 UI가 정상이라는 뜻도, Chief 관측을 부정하는 뜻도 아니다. 다음 분기점은 실제 증상 때의 raw self/peer상대거리와 화면/카메라변위를 함께 확보하는 것이다. raw가 흔들리면 송신표본시각·공통시각·소스선택을, raw가 안정적이면 프레임/3D/카메라 적용경로를 조사한다. 통신주기 변경·추가읽기·무조건 smoothing으로 가리지 않는다.

## 실행·검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 접속주소 불필요.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --test scripts/jitter/raf-beat-replay.test.mjs
node scripts/peer-sync/residual-peer-jitter-harness.mjs --scenario low5equal,low5equalIrregular
```

- 기존rAF회귀: **8PASS/0FAIL**. 로그 `C:\20.HDev\boxcycle\.out\peer-raf-regression-20261029.log`.
- residual 전체: **9시나리오PASS**, 증거 [이번 JSON](evidence/residual-equal5-20261029.json). Vite24678포트 중복경고는 있었으나 종료0·JSON생성.
- 첫 동속 재생은 송신위상동일로0m가 나와 조건이 부족함을 확인하고 위상80ms를 추가한 뒤 재실행했다. 최종값0.010m를 사용한다.
- 실제브라우저·두클라이언트5km/h·실폰·운영패킷수집: **미실행**. 사용자현재시점 증상 원인·수정완료로 보고하지 않는다.
- 제품소스/전송주기/Rules/배포/커밋푸시 변경 없음. 변경은 하네스·문서·증거다. 타입/제품빌드는 제품소스미변경으로 미실행.

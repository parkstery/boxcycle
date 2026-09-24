# PROGRESS — 20260924-camera-qc

15:39 | 착수. 지시01 읽음 — QC1 3단(routeFit/aerial60/aerial5) → 4단(+200m) 확장. 구조 조사 시작.
15:41 | 구조 확인: RIDE_CAMERA_DISTANCE_MAX_M(60m)은 MapViewSheet 수동 슬라이더 min/max 클램프와 wheel-줌 역산 소프트캡(*2=120m)에만 쓰임. QC1 preset(setRideCameraDistanceM)은 이 상한을 거치지 않고 computeRideFollowFraming 에 그대로 흘러감 → 200m 를 상한 변경 없이 추가 가능. 구현 착수.
15:44 | 구현 완료: camera1Mode.ts(신규, 단일 정의) + App.tsx/MapHud.tsx 리팩터. tsc/build PASS, eslint 0 errors.
15:46 | 캡처 5종 완료(document/ops/20260924-camera-qc/.out/jisi01/) — 순환 확인(05가 01과 zoom/pitch 동일). zoom 18.4/20.1/23.7(200/60/5m), pitch 전단계 0(QC1 기존 설계, QC2-6과 다름 — 지시서 pitch80 전제와 차이 있음, 보고서에 명시).
15:48 | 보고서 작성 완료(20260924-지시01수행결과-QC1-200m-4단.md). 잔여 프로세스 없음. 완료.
15:49 | [감리] 지시01 감리 착수 — 캡처·수치 확인 중
15:50 | [감리] 지시01 PASS — 4단 순환 닫힘(zoom 16→18.4→20.1→23.7) · 상한 미적용 구조 확인 · 지시서 오류 2건(pitch 80 전제·10m 표기) 개발팀장이 정정. 커밋·병합·배포
16:14 | 지시02 착수. preservedRiderLayer.ts 광원 3종 참조를 클래스 필드로 승격 + azimuth/elevation 역산 + applyLightLabState/setRiderLightLabState 추가(제품 기본값 불변). lib/riderPrototype/riderLightLab.ts(URL 게이트·범위·프리셋·localStorage·복사텍스트) + components/riderLightLab/RiderLightLabPanel.tsx 신규. App.tsx 최상위에 <RiderLightLabPanel /> 한 줄 추가. tsc/eslint(대상 파일) PASS. 프리셋 값은 Playwright 로 실제 화면 보고 정하는 중.
16:29 | [감리] 지시02 PASS — 캡처 6종·URL 게이트·제품 기본값 불변(1.25/1.7/2.4)·tsc PASS 확인. 커밋·배포

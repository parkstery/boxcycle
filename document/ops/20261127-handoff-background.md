# 2026-11-27 HANDOFF 보존 기록

**11-26 계정 창 배치(Codex)**: 이름·상태 왼쪽 위, 기간 탭 아래, 도로망 제목 옆 거리·닫기 오른쪽 위. UserInfoSheet·가로 시험·고정104, 커밋 b8b4fc90·11-27 배포.
빌드·가로 계정2/2(800×360·667×300, 기간·기록·닫기) 통과. 초기 시험은 빈 계정 fixture로 실패 후 보완. 실폰·실계정 미확인.

**11-26 세계 지도(Codex)**: 확대 왼쪽 지구본, 경로와 무관하게 현재 중심 줌2·추적 해제(Chief 후속 변경). App·MapView·MapHud·MapRail·고정103, 커밋 50586cba·11-27 배포.
빌드·진입 셀렉터21/21·가로 UI10/10 통과(버튼 4크기). 줌2로 후속 변경, 이전 줌4 타입 검사 통과. 실제 Mapbox 주행·프레이밍 미확인. 다음: 실화면 확인.

**11-26 배포(Codex)**: `13f09762` 원격·Hosting 완료, HTTP 200·센서 번들 확인. 전체 시험 1715/0(직전 전체 실행), 정련 통과; 브라우저 2건 제한 뒤 재시험 2/2. 폰·실센서 확인 대기.

**11-26 센서 B 구현(Codex)**: HUD·메뉴 54×28 알약·크랭크·상태 점, 고정102. 빌드·lint PASS, 가로 화면 16/17 후 단언 갱신 2/2 PASS. 배포 완료, 실제 센서·폰 미확인.

**11-26 메뉴 누락(Codex)**: 결과창 내부 플래그가 남아도 실제 결과가 없으면 메뉴 표시. 회귀 1/1·빌드 PASS, lint 오류0·기존 경고6. 배포 완료, 실화면 원인 미확정.
다음: Chief 발생 시점 확인 후 실화면 검증.

**11-26 미니맵·카메라1 배포(Codex)**: ca92207c Hosting, 검사 1712/0·HTTP 200. 실폰 확인 대기.

**11-26 카메라1 평면(Codex)**: 카메라1 지형·3D OFF·다른 카메라 복원, 고정101. 시험 7/7, 실화면 미검증.

**11-26 미니맵 스타일(Codex)**: 메인과 반대 위성/야외·고정100, 4bb99964 배포. 실폰 미검증.

**11-24 지형OFF·3D최대(Claude Code)**: 0~4단계(건물·안개·능선) ~6단계 푸시 e26a14a3·미배포: [결과](20261124-terrain-off-3d-plan/05-result-stage4.md)·[계획](20261124-terrain-off-3d-plan/README.md). 고정91~95. 전체1702/0.
**11-26 미커밋 폐기(Chief)**: 계정 전환·rider15·FPS 실험 백업 `tmp/discarded-20261126.zip`.
FPS 패널 `?fps=1`. 화면 시험은 Chief 직접. [5](20261124-terrain-off-3d-plan/06-result-stage5.md)·[6](20261124-terrain-off-3d-plan/07-result-stage6.md)단계. 비교 `?ridequality=0~3`·`?ridelook=0`·`?ridetrees=0`·`?viewdist=0`.

**11-26 Mapbox 3D 사례 조사(Codex)**: 7개 사례 조사 완료, 코드 변경 없음.

 **기존 FPS 기록**: [실험총괄](20261119-camera-terrain-follow/20261123-fps-experiments-summary.md)·공식선6.8FPS 후보불합격. 문서 bec2a14b 커밋, 미커밋 실험은 11-26 폐기。
**11-22 제품 지형1배**: 2dfb84c8/1c8457a9 푸시·전체1642/0·App허용4157. 중복호출5파일 정리도 반영, Chief FPS차이없음. [원기록/기타 인계](20261124-handoff-background.md) 참조。

지도3모드 `66a0fac8` 배포.
비용: Mapbox 0회↑·GTX 비교. Standard 도로명 지원.

센서창 a29728e1·280×108。
lint PASS·Hosting 배포。

이정표542d04cb 배포·FINISH PASS·반복렌더 미확정(간편03).

**11-20 인터벌(Codex)**: `9ff9b78f` 배포. [계정 인계](20261029-quick-interval-ride/README.md).
다음: 실폰·센서 확인.

**11-19 시작3D**: b70c824c 배포; 이후 고정90이 기본 OFF로 대체.

**11-19 중계기(릴레이) 설계 검토(Codex)**: 코드 미작성. [설계·정량](20261119-firestore-read-audit/10-multi-rider-relay-design.md).
RTDB motion 은 이미 스타(중계) 구조. 남은 n:n 은 Firestore 백업 컬렉션 구독. 읽기 300·N·(N−1)/시간 → 후보B(라이더 RTDB만·관전자 보드1개)는 선형.
RTDB 대역·복구 품질을 포함한 큰 구조 변경은 후속. 후보B 미채택·상시 백업 유지.

**11-20 read 후속(Codex)**: Guest 제외계정 읽기 절감5a5b3170 배포·web1584/0·서버307/0。
11-22 Chief: 매일 전수감사 유지 확정. 주기 결정 대기 종료. [기록](20261119-firestore-read-audit/05-guest-and-measurement.md).

**11-19 배포**: 결과·RPM·카메라·DPR·계측 [4c1f2ef0](20261119-mobile-3d-investigation/release.md).

**11-19 퍼블릭(Codex)**: 4개 등록·공개43/9국·기존44 보존·공개read8OK.
[릴리스](20261119-public-route-candidates/release.md). ecf600c7 푸시·Hosting 완료. 아라/암스텔 보류.

**표고 조회**: 11-22 Chief 반려로60초 연장안 철회. 기존15초 유지·지연 원인 미해결. [과거 분석](20261102-ride-screen-layout/20261118-elevation-timeout-analysis.md).

**RPM/거리/도구 인계**: RPM f3efe8ce 배포·가로16/16, 거리baf65e9f 커밋·미배포/실폰 미검증. [기록](20261102-ride-screen-layout/README.md)·[거리 결과](20261029-interval-route-hint/02-result-claude-code.md)·[압축 전 인계](20261124-handoff-background.md) 참조。
MiniMax 개발도구 제외(AGENTS.md)·rider15 수정후교체·전체진단 보류.

**11-16 점검**: 지역 필터 Hosting f0068146 확인. 함수·Rules는 [묶음](20261106-region-ride-stats/README.md) 확인.

**11-06 G5**: 배포 완료 428ae1b4·고정80. Chief 폰 확인·셀 연속성 제안 남음.

**11-06 지역 필터**: 고정79·폰 확인 완료(11-16 Hosting f0068146). geo 없는 Trail 제외.

**11-06 PR #22**: 푸시 완료 0276202f. 위치 쓰기 임계값 조정, 효과는 측정5(분당5.0·6.4). 당시 Hosting 자동 승인 거부, 운영 반영은 관련 묶음 확인.

**11-11 rider15**: DEV 전용·활성 rider14·리그8·색상4 통과. [README](20261111-rider15-app-integration/README.md)·보존 기록에 원본 경로·진단.

**11-04 PR #21**: 배포004e4261·국가별 점수·폰 확인 대기.

**11-03~04 비용**: 54bd409d·6f125e1c 배포. 후속 read 조사 진행.

**11-02 주행 화면**: 배포. App 래칫3807. 기존 하네스14실패·5초 숨김 유의.

10-30~11-01 배포는 묶음 README·git log. 주행 중 인터벌: 일시정지→INT.

간편 인터벌01·01-B는 배포됨. 이정표/FINISH도542d04cb 배포. 반복 렌더링 제보의 원인·실폰/실센서 확인은 남음.
과거 진입시험 결함 후보(현재 미재검): 결과창 닫기/지도에 가린 메뉴 클릭. 재개 시 실제 App 진입 시험과 구분한다.

배포 상세: [보존 기록](20261102-ride-screen-layout/20261118-handoff-background.md).


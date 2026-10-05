# Edge 내 경로 글자 가독성 수정

담당 Cursor CLI. README와 본 지시만 읽고 필요한 파일만 조사하여 토큰을 절약한다. 결과 02-result.md에 기록, stdout 10줄 이내. 기존 다른 작업 변경을 보존하며 커밋/push/배포 금지.

Chief 증상: 좌측 Edge의 '내 경로' 글자가 알아보기 어렵지만 입문/퍼블릭은 잘 보인다. 우측 Chrome은 정상. 내 경로 출처 버튼과 내 경로 목록 모달/행을 둘 다 살펴 정확한 표면·원인을 좁힌다. SavedRoutesPanel/RouteListModalShell CSS와 공유 입문/퍼블릭 모달 비교. color/background/opacity/disabled/-webkit-text-fill-color/상속/테마의 실제 computed 값 확인. dark/light 등 브라우저 선호 상태에서도 확실히 읽히는 최소 명시적 foreground/background 수정. Guest/disabled 권한·기능·선택 의미는 유지, 버튼 임의 enable 금지. 무관한 디자인·카메라·문서 체계 변경 금지.

기존 localhost5010 서버 재사용. 사용자 브라우저를 임의 재로그인/주행 종료/데이터 변경 금지. 연결된 UI 도구는 Chrome만 보이며 Edge는 노출되지 않으므로, 설치된 Edge/Chrome 채널 별도 headless 페이지와 기존 인증/로컬 캐시 fixture로 비파괴 재현을 시도해도 된다. 저장 경로가 없다면 기존 SavedRoutes UI를 비파괴 seed/mount해 CSS 검증 가능하며 실사용 Edge 검증 여부 구분. 새 인증 우회·외부 API 비용 증분 금지. 글자색 실측·대비 및 740×300 캡처를 .out에 남긴다. 입문/퍼블릭 가독성 회귀 없는지 비교. 색상 수정은 불필요한 신규 테스트 코드를 만들지 않고 타입/lint(변경 TS 있으면)/selectors, 실제 브라우저 CSS/화면 증거로 검증. 브라우저 5분 무진전이면 중단·원인점검·대체경로. 실패/미실행은 정확히 기록. 결과는 변경 파일·원인·수정·명령/exit·브라우저별 증거·한계.

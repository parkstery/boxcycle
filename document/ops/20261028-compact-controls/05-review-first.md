# 1차 독립 감리 — 보완 필요

Supervisor Codex. Cursor 03 구현/시험 진행 중에 제품 코드를 읽고 별도 Playwright로 검사했다. 실행자 최종 결과를 받았다는 뜻은 아니다.

확인 통과: 699×273 기본 순위10명·설정전체 캡처, 실제 단일카메라154px/1번62px/열린메뉴235px(하단271px), 기존 보호 이미지2181해시 불변.

발견1: 699×273에서 개척→「내 길 이용 · 새 도로」펼치기. 순위 panel rect 높이257px·하단285px로 viewport273보다12px 넘어감. scrollHeight273/clientHeight257. 현재 `max-height:calc(100dvh - 16px)`에 실제상단28px가 더해진다. 최하단이 화면 밖이라 스크롤해도 완전접근 불가. 확장/많은참가자/게스트 상태에도 같은위험. `evidence/first-review-probes.txt`와 `pioneer-review-699.png`에 증거.

발견2: 개척의 행별 `uses`는 기존 가시셀에서 값의title/행aria-label로만 이동했다. 새details는 본인uses만 표시하며, 나머지참가자의이용정보를폰터치로펼쳐볼수없다. 본인uses없으면「순위 행의 이용 안내는 이름에 올려 두었습니다」라는모호한문구뿐이고 실제title은값에있다. 원래정보를폰에서도볼수있게보존해야한다.

검증 공백: 새spec「설정 토글·긴 값·운동/프로필 왕복」은 긴값설정/로딩/프로필미설정/음악미구성 상태를 생성하지않는다. preview도rideElevationProfileLoading=false·bgmConfigured=true 고정. 실제필수조건에대한완료증거가아님. 전체노출은패널scrollHeight뿐아니라버튼/레이블/로딩문구의실제rect로확인해야한다.

다음: 04-result-cursor 종료 확인 후 06-task-review-fixes.md를 같은Cursor대화에재지시. 제품코드수정은Cursor담당, Codex가임의대체구현하지않음.

보존 감사 후속: Cursor 1차 ui-800x360 회귀가 기존PNG11장을 덮어쓴 사실 발견(04의「덮어쓰기없음」보고와불일치). `implementation-baseline.zip`에서 이번착수원본11개를정확복구했고2181/2181해시일치 재확인. 생성캡처는 `evidence/relocated-first-pass/`로보존, `protected-restoration.json`에경로·전후SHA256기록. 과거묶음의원본미복구10장사고와는별개이며이번11장은전부복구됨. Supervisor는 검증하네스의두캡처기본경로만 `testInfo.outputPath`로교정해기존증거재작성차단, 제품구현은Cursor담당유지. 독립감리실행폴더혼동/진단스크립트인코딩·경로오류는교정후재실행,제품실패로계산하지않음.

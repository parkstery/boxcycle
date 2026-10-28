# 계기판 한 행 후속 수정

Chief 최신 지시: 두 행인 계기판을 왼쪽 약20px부터 한 행으로 표시. 소규모 CSS 변경이라 Supervisor 직접 처리.

`MapHud.css`에서 왼쪽 위치 safe-area+20px, 주행6개 셀 한 행·내용 폭·셀 사이8px로 변경했다. 숫자18px·라벨11px·단위는 유지/정리하고 오른쪽 조작을 위한208px 이상 공간을 둔다. 기존 3열2행/무조건50vw 제한은 최신 한 행 지시에 따라 대체한다. 좁은 가로에서도 가독성을 위해 숫자를14px로 줄이지 않았다. 800에서는 통상 약반폭, 작은 화면은50%를 넘을 수 있다. 시간/속도/평균/새도로/케이던스 생략 없음.

관련 검증은 `ride-ui-moments.spec.ts` 4크기(800×360·736×360·699×273·667×300)의 한 행·왼쪽20px·내용 잘림·계정/지도·순위 비겹침, `ui-800x360.spec.ts` 준비/주행/일시정지 긴누적값 가독성(최소18px)·컨트롤 비겹침. 최종 **5 PASS (10.3초)**, 결과 `evidence/single-row-check.log`, 실제 제품 컴포넌트 캡처 `evidence/single-row/`. 지도/수치는 fixture. diff-check PASS. 전체quick/build는 CSS 배치 변경으로 재실행하지 않음. 기존 증거10장 원본 미복구 상태는 직전 인계와 동일.

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 http://localhost:5031/ 재사용, 새로고침→주행. 빠른 확인 http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding&interval&intervalMs=330000 . 서버가 꺼졌을 때만 `npm run dev:localhost -- --port 5031`. 커밋·푸시·배포 없음.

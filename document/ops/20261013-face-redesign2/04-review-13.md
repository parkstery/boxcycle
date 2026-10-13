# 감리13 — 계정창 컨트롤 높이 절반

Chief명시지시로계정창의기존44px컨트롤을22px로변경,다른창규칙불변. Developer Muse Spark1.3 exec15671 exit0. UserInfoSheet.css한파일에33줄추가만,TSX/글씨크기/색/문구/통계정보/기능불변. snapshot account-before-13.css와diff대조.

대상: Free/업그레이드/Guest플랜행,기간탭,마지막주행입구,Google연결/로그아웃/계정탈퇴/확인취소·실행버튼,탈퇴확인입력. 기존작은헤더버튼·목록내액션은유지. 마지막주행두줄→같은행으로만들어22px에서도글씨잘림방지,긴요약은기존ellipsis유지. 주행전체요약이항상한눈에전부보인다고주장하지않는다.

독립검증: account-state-qa.cjs 실행18조합 account-13-shots/(800x360/667x300 ×9상태)exit0/pageerror0. 추가긴요약DOMfixture+Guest로그아웃포함20조합 account-13-summary-shots/exit0/pageerror0. 실제React컴포넌트에mockUser/구독응답을사용,실제인증/Firestore통계/로그아웃/탈퇴아님. 모든대상controlrect높이22px,전후fontSize차이0,수평overflow0,마지막컨트롤도달true. 정상자산및Guest로그아웃afterPNG직접시각확인:긴Google연결버튼글자잘림없음.

콘텐츠높이: 기본Free228.56→162.56px,자산284.47→218.47px,로그아웃확인303.16→215.16px,탈퇴확인397.36→287.36px. 667x300자산스크롤35→0,로그아웃54→0. 자산+탈퇴등긴상태는정당한스크롤유지(667x300:231→121px),삭제안내숨김없음.

정확한apps/web cwd tsc -b --pretty false 및git diff --check 최종exit0,개발자diff-check출력없음. 실기기터치체감·운영계정동작미검증. 사용자관찰탭조작/서버조작/commit/push/deploy없음. 5013반영,Chief확인대기.

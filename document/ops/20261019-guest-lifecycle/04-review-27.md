# 감리27 — 종료 후 첫 인트로 / 운영 반영 완료

2026-10-20 KST(전날시작) / Codex직접. Chief의종료후첫페이지요청에따라App표시분기교정. 2a1710ae→main2병합cf2e4dff,패널닫기보완e1ac2199. origin/main2반영. 기존다른dirty보존,서버/Rules/계정데이터변경없음.

## 동작·질문 답

종료는Firebase signOut이아니다. 기존인증세션과기록을보존하고,인트로표시상태를초기화한다. 계정/메뉴패널도닫는다. 종료표시가남은새로고침·새탭은인증복원이완료된뒤첫인트로를보여준다. AuthSessionGate는중복표시하지않으며,만료/오프라인/오류복구는기존분기를유지한다.

첫인트로의게스트시작은동일beginAuthenticatedSession이다. **유효한기존Guest는서버확인후같은UID로재사용**한다. 빈세션또는서버확정삭제일때만명시클릭으로새Guest하나. 단순화면복귀때문에새계정을만들지않는다. 같은브라우저/주소조건필수.

## 검증·배포

- 실제demoSDK종료→인트로→Guest시작3회,새로고침/새탭인트로,개인fixture유지·계정증가0·UID동일·종료heartbeat/membership정지:최종1 PASS(21.5초),844×390. 첫수정검증27.7초·캡처추가후21.9초도PASS. `.out/guest-existing-server-results/**/ended-intro.png`는종료애니메이션진행중패널일부가포함돼완료상태미학검수증거로쓰지않는다.
- 실제App종료handler2 PASS(Guest/Google,signOut0·패널닫기·introreset확인),인증게이트/탈퇴14 PASS,selector19 PASS,변경lint exit0/기존App경고7.
- 커밋사본webbuild exit0(기존bundle/riderRig경고). prepush전체게이트최종1295 PASS/0 FAIL(60.8초),우회없음.
- 커밋사본`.out/release26`에서hosting만배포exit0. 운영 https://boxcycle-dc2df.web.app 응답200·bundle **index-BXz026cM.js**일치. 로그`.out/intro27-deploy.log`. 이번운영Guest생성/삭제없음. 실제Google팝업·BLE/폰실기기는미검증.

## Chief 직접 확인

실행폴더 **C:\20.HDev\boxcycle**. 아래운영주소는로컬서버불필요.

```powershell
Set-Location C:\20.HDev\boxcycle
Start-Process 'https://boxcycle-dc2df.web.app'
```

강력새로고침→기존Guest접속→사용자정보→종료→첫인트로→게스트로시작→이전닉네임/기록확인. 같은주소로유지한다. 최종Chief디자인/실기기사용확인·CLOSED대기.

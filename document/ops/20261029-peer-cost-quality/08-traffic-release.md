# 트래픽 저감 1단계 릴리스

작성:2026-10-29 · 독자:Chief/AI · 상태:**DEPLOYED·운영 주요 자산 검증 완료** · [작업 입구](README.md)

## 승인·수행자

Chief는새저감커밋과보고서를 `parkstery/boxcycle`의 `origin/main2`에푸시하고Hosting에배포하도록명시적으로승인했다. 이전자동승인차단은이승인으로재개한다. **제품구현·설계·검증·커밋·푸시·배포 수행자는Codex이며위임없음**이다.

제품 `78f0dd19`,계측계약/보고 `7483402a`,최종로컬검증기록 `78e30476`을정상훅으로푸시한다. 다른작업의미커밋UI·문서는포함하지않는다.

## 배포 대상

빌드는제품커밋만추출한 `C:\20.HDev\boxcycle\.out\peer-release-78f0dd19\apps\web\dist`다. 문서/계측시험후속커밋과제품코드는동일하다. 기존혼합작업폴더의dist는배포하지않는다. 준비된6개index/초기참조자산의manifest를다시대조해6/6일치를확인했다.

main bundle: `assets/index-BZ3jLtJM.js`,2,045,862B.

SHA256: `4D8AC2189E5777F7AC68331FF631C4C3A3EE9A4DDA67379643FD5E3E7CA7609F`.

## 검증 범위

이번변경은같은5Hz에서변경필드만전송한다. 로컬RTDB에서수신표본동일·Rules·정지완주·재연결/삭제후복구를검증했다. 전체1,449시험·빌드·타입·의존·정련·동행간격·selector20의직전PASS기록은 [07구현보고](07-traffic-reduction-implementation.md)에있다. 실제push때정상훅을다시실행한다.

요청본문−47.1%,상향TCP−24.7%,하향TCP−21.7%는로컬비암호측정이다. 운영청구절감률/실화면효과는미측정이다. Firestore읽기건수·Functions호출은이번변경으로줄지않는다. 수초수신공백의큰밀림은미해결이다.

## 실행·확인

실행폴더 `C:\20.HDev\boxcycle`:

```powershell
Set-Location C:\20.HDev\boxcycle
git push origin main2
firebase deploy --only hosting --project boxcycle-dc2df --config .out/peer-hosting-deploy-78f0dd19.json --non-interactive
```

Git Bash의PATH앞에 `/c/Program Files/nodejs`를설정해기존npm래퍼문제를피하며훅을우회하지않는다. Hosting만배포하고Rules/Functions는변경하지않는다.

접속:[Spinatlas](https://boxcycle-dc2df.web.app). 배포완료후다음접속시새로고침한다. 현재Chief추가육안테스트는요구하지않는다. 로컬검증은다음명령이며주소불필요다.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --test scripts/peer-sync/motion-delta-writer.test.mjs
```

## 완료 결과

- 정상push훅:전체 **1,449PASS/0FAIL**,동행간격/소스전환/residual·타입·selector20·의존·정련·개발부산물PASS. 우회없음.
- 원격push: `e9c6061f..78e30476 main2→origin/main2` 완료·`git ls-remote`로확인.
- Hosting:52파일검색·새파일8개업로드·`release complete`·`Deploy complete`·exit0.
- 운영 `index.html`+참조JS/CSS5개: **6/6 HTTP200·bytes/SHA256 일치**. [운영검증JSON](evidence/motion-delta-production-verify.json). 전체52파일해시검증은아니다.
- 현재운영main번들은위의 `index-BZ3jLtJM.js`다. 로컬/운영hash가일치하며원격문서후속은제품차이가없다.
- Rules/Functions배포없음. 다른작업UI dirty보존. 실제두창/실폰·운영TLS전송량·원화청구전후는미검증이며추가육안확인을요구하지않는다.

푸시로그 `.out/motion-delta-approved-push.log`, 배포로그 `.out/motion-delta-approved-hosting.log`, 운영다운로드 `.out/motion-delta-production-78f0dd19`에보존했다. **Codex가구현부터배포·해시대조까지직접수행했고다른에이전트위임은없다.**

# 주행 UI·인터벌·응원 Hosting 배포

2026-10-28 Chief 「배포해」 승인. Supervisor 직접 수행. 상태: **DEPLOYED / 운영 번들 일치 확인 완료**.

범위: 현재 검수한 프런트엔드 앱. 계기판 한 행·인터벌 검정25% 배경 포함. 승인된 선행 프런트엔드 변경도 현재 작업 트리에 포함되어 있으며 기존 dirty를 보존한다. 함수·Rules·DB 배포 없음. 배포 지시에 따라 Hosting만 실행하며 커밋·푸시는 하지 않는다.

실행 폴더 `C:\20.HDev\boxcycle`. 명령 `npm run deploy:hosting`(내부 build 후 firebase deploy --only hosting). 프로젝트 `.firebaserc`의 `boxcycle-dc2df`. 운영 주소 https://boxcycle-dc2df.web.app .

사전 검증: 최신 빌드(tsc 포함) PASS, selector19 PASS, 의존 방향 PASS, diff-check PASS. 최종 화면5spec **54 PASS (2.1분)**, `evidence/deploy-ui-final.log`. 과거 전체 quick1430/4실패 후 개별 재검 통과 및 기존 정련188>186 문제는 `03-review.md`에 구분되어 있으며 이번 배포를 전체게이트0FAIL로 표현하지 않는다.

배포 전 지문 `evidence/deployment/manifest.json`(제품 소스/설정544·산출물52개). 환경 파일은 해시만 기록한다. 운영 배포 전 index200·기존 main JS `index-CSTgMVw7.js`, CSS `index-BwNTbOpf.css`. 직접 네트워크는 sandbox WinError10013으로 실패 후 승인된 외부 실행에서 정상 조회했다. 최초 잘못된 셀렉터 명령 `check-entry-contract.mjs`는 파일 없음 실패, 올바른 `verify-selectors.mjs`로19단계 통과.

배포 후 `python -X utf8 document/ops/20261028-ui-moments/deployment-record.py verify`로 운영 index/연결 자산의 로컬 SHA256 일치 및 배포 중 제품 소스 지문 불변 확인. 배포 로그·버전·결과는 종료 전에 갱신한다.

기존 증거 PNG10장 원본 미복구는 이전 인계와 동일하며 이번 검증 캡처는 새 `evidence/deploy-final/`로만 저장한다. 기존5031/3000 서버 보존. 실폰·센서·음향 청취 및 실계정 주행 전체 흐름은 이번 검증 범위가 아니다.

## 최종 결과

`npm run deploy:hosting` 완료, Firebase release complete 확인. 운영 index HTTP200·로컬 index 바이트 일치, 연결된 JS/CSS 5개 모두 HTTP200·SHA256 일치, 사전 기록 제품소스544개 지문 변경0. `evidence/deployment/verified.json`에 전체 해시. 메인 JS `index-BxrSOZ9X.js` SHA256 `7fd3c830bae37edcfeae54a0485e294f27e43ac3b77a3bbb7c8acc6dc388d736`, CSS `index-CHSjW9rI.css` SHA256 `ae95bcbe3fb01c0efb1fabd9e7402ab57a2c5ef0d636c3b24c70450c69019058`. 소스 커밋·푸시 없음. 실계정 주행 UI를 운영에서 직접 조작한 검증은 미실행. 확인: https://boxcycle-dc2df.web.app 새로고침→인터벌 켜기→주행, 왼쪽20px 한행 계기판/반투명 검정 인터벌 배경 확인. 기존 증거10장 원본 미복구는 계속 남음.

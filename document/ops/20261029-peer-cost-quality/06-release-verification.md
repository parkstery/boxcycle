# 동행 표본 시각 수정 — 커밋·푸시·Hosting 배포 확인

작성:2026-10-29 · 독자:Chief/AI · 상태:**DEPLOYED·운영 주요 자산 바이트 검증 완료** · [작업 입구](README.md)

## 배포 내용과 남은 한계

원본 주행 거리·속도에 그 값이 적분된 시각을 함께 전달하도록 수정했다. 송신 타이머가 더 늦게 실행돼도 오래된 거리를 현재 위치처럼 태깅하지 않는다. RTDB200ms·FS4초·공통표시지연600ms·정밀도·외삽상한·화면/카메라 설정을 유지했다. Functions·Rules·데이터 모델 변경은 없다.

합성 동속 재생에서6.0→1.2cm로 줄었다. **실제 운영 화면의 개선율은 아직 미측정이며 수초 수신공백의 수m 밀림은 미해결이다.** [04 수정과 검증](04-solution-and-local-fix.md), [05 품질보존 트래픽 검토](05-quality-preserving-traffic-review.md)를 함께 본다. 최적화 후보는 이번 배포에 포함하지 않았다.

## 커밋·원격

| 커밋 | 내용 |
|---|---|
| `8101ead2` | `fix(peer): pair motion distance with its integration timestamp` — 제품3파일·회귀시험/하네스3파일 |
| `187ddf9c` | `docs(peer): update jitter report and review quality-preserving traffic cuts` — 보고서·증거·이번작업의공용문서항목 |

정상 pre-commit/pre-push를 사용했다. 첫push는 Git Bash가 기존 `/c/Users/kdrea/bin/npm` 래퍼를 골라실패했다. `export PATH="/c/Program Files/nodejs:$PATH"`를 적용한 Git Bash에서재실행하여모든게이트통과후 `e3927e9b..187ddf9c main2→origin/main2`를확인했다. 훅우회·forcepush·main병합은하지않았다.

작업폴더의다른UI 변경은커밋하지않았다. 공용HANDOFF/PROGRESS/ops README도이번요약항목만index에선택반영하고기존타작업dirty는보존했다.

## 격리 빌드

다른UI dirty가Hosting에섞이지않도록 `git archive 8101ead2`를다음폴더에추출해빌드했다:

`C:\20.HDev\boxcycle\.out\peer-release-8101ead2`

기존node_modules를junction으로참조하고로컬 `.env`만복사했다. env값/인증정보는문서·커밋에포함하지않았다. clean출처에서 `npm run build`와새capture회귀3시험을다시통과했다. 문서커밋187ddf9c는제품차이가없다. 기존혼합작업폴더의dist는배포하지않았다.

## 검증 결과

| 항목 | 결과 |
|---|---|
| pre-commit 변경JS/TS eslint | PASS |
| pre-push web타입·의존방향·개발부산물·정련 | PASS |
| 동행간격11셀·소스전환7셀·residual10셀 | PASS |
| 진입셀렉터계약 | 20PASS |
| 전체 `test:quick` | **1,443PASS/0FAIL**, 제외3파일(에뮬레이터·전체하네스) |
| 격리출처 capture시험 | **3PASS/0FAIL** |
| 격리출처 build | PASS·기존큰chunk경고 |
| Hosting deploy | **exit0·release complete·Deploy complete** |
| 운영 index+초기참조자산5개 | **6/6 HTTP200·bytes/SHA256일치** |
| 실제브라우저두창·실폰·운영패킷/청구전후 | 미실행·현재Chief추가육안시험요구없음 |

서버소스가변경되지않아Functions시험·배포는미실행했다. 큰수신공백의고의진단2FAIL와예전시각태깅모델의FAIL은미해결/회귀비교증거이며기본게이트PASS로숨기지않는다.

## 배포와 운영 검증

실행폴더 `C:\20.HDev\boxcycle`:

```powershell
Set-Location C:\20.HDev\boxcycle
npx firebase deploy --only hosting --project boxcycle-dc2df --config .out/peer-hosting-deploy-8101ead2.json --non-interactive
```

이명령은이번에완료한배포기록이다. config는기존Hosting헤더/rewrites를보존하고public만격리dist절대경로로지정했다.52파일검색·새파일8개업로드후release완료를확인했다.

운영URL: [Spinatlas](https://boxcycle-dc2df.web.app). 다음접속때새로고침해야이미열린탭에도새번들이적용된다. 지금테스트하실필요는없다.

주요번들: `assets/index-mDtgkiO9.js`, **2,043,673bytes**.

SHA-256: `C701E3B37D69C4727B49B0966D11B707B46AD16F595879C210CBDD05D6350039`.

`index.html`, mainJS, jsx-runtime, camera1Mode, react, CSS를운영에서직접받아검증했다. 전체52파일을해시대조했다는뜻은아니다. [운영검증JSON](evidence/production-verify-8101ead2.json)에파일별bytes/hash/cache-header를보존했다.

로컬재현(네트워크/브라우저주소불필요):

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --test scripts/peer-sync/motion-capture-timeline.test.mjs
node scripts/peer-sync/residual-peer-jitter-harness.mjs --scenario low5captureAge
```

로그:루트`.out/peer-release-push-20261029.log`(첫환경실패), `peer-release-push-retry-20261029.log`(전체통과), `peer-clean-release-build-20261029.log`, `peer-clean-capture-test-20261029.log`, `peer-hosting-deploy-20261029.log`. 격리소스/zip/dist와검증다운로드는보존했다. 다음작업은05의우선순위대로실제비용귀속과변경필드update의동등품질/실wire측정이다.

# 지시03a — 저토큰 패치 적용 실행

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 지시03 실행 방법 보완 |
| 최초 작성 | 2026-10-18 |
| 상태 | READY_FOR_DEVELOPMENT |
| 담당 | Cursor AI — Chief 명시 전환 승인 |
| 연결 문서 | [지시03](02-task-03.md) · [검토가능 패치](03-proposed.patch) |

지시03 첫 LongCat 실행은 HTTP500으로 종료됐고 제품수정은 없다. LIMIT 오류가 아니므로 LongCat으로 재시도한다. Chief가 UI4파일과 지시서의 LongCat 전달을 명시 승인했으며 환경파일·키·인증정보 제외. **소스를 다시 읽거나 조사하지 마라.** Supervisor가 동일 승인4파일에만 적용되는 구체 패치를 작성했고 dry-run을 통과했다. 추가로 인증대기 동안 지도 자체 컨트롤도 숨기는 root pre-auth class를 포함한다. 기능·범위는 지시03 그대로.

실행 폴더 `C:\20.HDev\boxcycle`. 아래만 수행한다:

후속 승인: LongCat HTTP500 두 번 실패 후 Chief가 Cursor AI로 전환하고 지정4파일 패치/지시서를 전달하는 것을 명시 승인했다. 환경파일·키·인증정보 제외. 같은 적용·검증 계약을 Cursor가 이어간다.

```powershell
git apply --check --ignore-space-change document/ops/20261018-intro-blend/03-proposed.patch
git apply --ignore-space-change document/ops/20261018-intro-blend/03-proposed.patch
node apps/web/scripts/ride-verify/verify-selectors.mjs
npm run build
npm run lint
git diff --check
```

각명령 실패 시 멈추고 원인만 결과에 기록. 줄바꿈 차이만 허용하는 ignore-space-change는 CRLF기존파일의 패치 문맥일치를 위한 것이며 검증규칙을 무시하는 옵션이 아니다. 전체소스/이미지/환경/다른문서/브라우저 읽기·새스크립트·커밋/push/배포 금지. token절약을 위해 출력은 종료코드·요약만 확인한다. `document/ops/20261018-intro-blend/03-result-03.md`에 실제모델/세션·적용성공·각검증명령/종료코드·오류/경고만 간결히 기록하고 종료. README·공용색인은 Supervisor가 처리한다. 다른수정은 하지 않는다.

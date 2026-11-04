# 클라우드 세션 재개 안내

작성 2026-11-04 Supervisor Claude Code(Opus 5.5) · 상태: **커밋·푸시 완료, 배포 미실행** · [작업 입구](README.md)

Chief 로컬 세션의 토큰이 소진되어 Claude Code 클라우드로 옮긴다. 클라우드는 GitHub만 읽는다.

## 시작

1. 리포 `parkstery/boxcycle`, 브랜치 **`main2`**. 기본 브랜치 `main`이 아니다.
2. `node scripts/handoff-check.mjs` 실행 후 [HANDOFF](../HANDOFF.md)를 읽는다.
3. 이 문서의 「남은 일」부터 잇는다. 상세 근거는 [쓰기 장부](03-write-ledger.md).
4. 설치: 루트에서 `npm install`, `functions/`에서 `npm install`. Node 24.

## 클라우드에 없는 것

| 없는 것 | 영향 |
|---|---|
| `apps/web/.env`(Firebase·Mapbox 키, `VITE_*` 8개) | 앱 실행·빌드 불가. `.env.example`을 보고 클라우드 환경 변수로 넣어야 한다 |
| `functions/.env` | 함수 배포 불가 |
| Firebase 로그인(`~/.config/configstore/firebase-tools.json`) | 운영 조회 도구·`firebase deploy` 불가. `GOOGLE_APPLICATION_CREDENTIALS` 서비스 계정이 없으면 운영에 닿지 못한다 |
| `.out/`(로컬 전용) | `aPbTo3` 삭제 전 스냅샷이 여기에만 있다 |
| Claude 메모리(`~/.claude`) | 아래 「지킬 규칙」으로 옮겼다 |

**클라우드에서 되는 일**: 코드 수정, 시험(`test:quick`·functions), 커밋·푸시. **안 되는 일**: 위 인증 없이는 운영 조회·배포·삭제. 그 단계는 Chief PC 세션에서 한다.

## 남은 일 (순서 지킬 것)

Chief 승인 완료(11-04): L9 A·B, 로컬 기록 수정, `aPbTo3` 50건 삭제, 시계 복구. 커밋 7568c566·cd4d748c·9c02590c·5b851237까지 푸시됐고 **운영에는 아직 없다.** 운영은 6f125e1c 그대로다.

1. **Functions 먼저** (루트): `firebase deploy --only functions:openTrailListingOnTrailWritten,functions:openTrailListingsSweep`
2. **Hosting 격리 배포**: `git archive <sha>`를 `.out/release-<sha>`에 풀고 `node_modules` junction 연결, `apps/web/.env` 복사, 빌드, hosting public만 바꾼 설정 파일로 `--config` 배포. 운영 js SHA256을 로컬과 대조한다.
3. **그다음 삭제** (루트, 스냅샷 있음): `node document/ops/20261103-cost-squeeze/tools/purge-resurrected-rides.cjs C:/20.HDev/boxcycle/functions C:/20.HDev/boxcycle/.out/private-guest-lifecycle/rides-aPbTo3-20261104 --apply`
4. 공개 주행 1회로 쓰기 감소·Trail 목록 깜빡임 없음 확인(`tools/` 측정 도구), HANDOFF 「마지막 배포」 갱신.

순서를 바꾸면 안 되는 이유: 앱을 먼저 올리면 서버 정리 90초가 110초 간격의 달리는 Trail을 목록에서 지운다. 삭제를 먼저 하면 옛 코드가 서버 0건을 보고 50건을 다시 올린다.

그 뒤: Rules 거부 원인 확인(미확정), `route-ride-controls` 「모드배타」 5건 기존 실패(`.map-view__pick-token` 없음), G2 공개 경로 요약 목록(보고서 §5).

## 지킬 규칙 (메모리 요약)

- 사용자 호칭은 **chief**, 존대말, 쉬운 말로 결론부터. 보고에 수행 agent(모델명)를 적는다.
- 링크 대신 경로·명령을 준다. 명령에는 실행 폴더·포트를 함께 적는다.
- 구현 결과 보고용 캡처는 만들지 않는다. chief가 사이트에서 직접 본다.
- 개발 base는 `main2`. 커밋·푸시·배포는 한 번에 승인받는다. 배포 명령은 대상·범위·위험을 설명하고 승인 뒤 직접 실행하고 적용을 검증한다.
- 화면 변경은 [Chief 지정 디자인 고정](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md)이 우선이다. 바꾸려면 표를 먼저 고친다.
- 타인의 변경 보존: `git restore`·`checkout -- .`·`clean`·`stash`·worktree 금지.
- 원인은 실측 뒤에 말한다. 「없다」고 할 땐 찾은 범위를 적는다. 시험은 사보타주로 살아 있는지 확인한다.
- `npm run dev`는 운영 Firebase에 쓴다. 데이터 시험은 에뮬레이터로 한다.
- 웹 타입 검사는 `tsc -b --noEmit`이다. `tsc --noEmit -p .`는 빈 검사다.
- 잠금 e2e는 증거 폴더 env(`UI_REVALIDATION_EVIDENCE_DIR` 등)를 임시 폴더로 준다. 기본값은 커밋된 증거를 덮는다.
- 유럽 RTDB Rules는 별도 배포다(HANDOFF 「잊지 말 것」). Firestore 백업은 꺼져 있다. 운영 삭제는 승인과 스냅샷이 먼저다.

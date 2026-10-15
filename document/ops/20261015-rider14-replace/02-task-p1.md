# 지시 P1 — rider14 자산 스테이징 (바이트 복사)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — OpenCode Muse Spark |
| 계획 | [01-plan.md §5.1 · §6 P1](01-plan.md) |
| 작업 위치 | **`C:\20.HDev\boxcycle-rider14`** (브랜치 `rider14-replace`) |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p1.md` |

## 입력 (읽기 전용 — 절대 쓰지 않는다)

rider 작업 폴더 `R = C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20261015_01-s6-poly-drawcall-reduction`

| 파일 | 기대 SHA-256 |
|---|---|
| `R\out\rider_s6_LOD0_meshopt.glb` | `df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d` |
| `R\source\guide-weights.json` | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` |
| `R\source\roadcyclist_s6_wheelfix_merged.glb` | `aeefb4d246b815a2391cbf80c0778bfb80cc8f66fa09f7385684bba8d2c8bc70` (해시 확인만, 복사 안 함) |

## 만들 것

`apps/web/scripts/rider-preserve/stage-rider14.mjs` (신규). Node 내장 모듈만 사용.

1. 인자 `--source <R 경로>` 필수. 위 3파일 해시를 계산해 하나라도 다르면 **아무것도 쓰지 않고** 예외로 끝낸다.
2. `candidateId` = 실행 시각 KST `YYYYMMDD-HHmmss` + `-` + GLB SHA 앞 8자(`df8de090`). `--id <값>` 을 주면 그 값을 쓰되 형식(`/^\d{8}-\d{6}-df8de090$/`)을 검사한다.
3. 대상 폴더 `apps/web/public/rider/preserved/candidates/<candidateId>/` 가 이미 있으면 예외(덮어쓰기 금지).
4. `fs.copyFileSync` 로 복사: GLB → `rider.glb`, 가이드 → `guide-weights.json`. 복사 후 대상 해시를 다시 계산해 원본과 다르면 대상 폴더를 지우고 예외.
5. `candidate.json` 작성 (2칸 들여쓰기, 끝 줄바꿈):
   ```json
   {
     "schemaVersion": 2,
     "candidateId": "<id>",
     "nickname": "rider14",
     "modelProfile": "rider14",
     "stage": "APP_CUSTOM_LAYER_CANDIDATE",
     "status": "APP_CANDIDATE_UNDER_REVIEW",
     "stagedAtKst": "<YYYY-MM-DDTHH:mm:ss+09:00>",
     "sourceGlbPath": "<R>\\out\\rider_s6_LOD0_meshopt.glb",
     "sourceGlbSha256": "df8de090…(64자 전체)",
     "stagedGlbSha256": "(복사본 실측 64자)",
     "upstreamSourceSha256": "aeefb4d2…(64자 전체)",
     "geometryEquivalentTo": "20260921-041426-cd81398e",
     "guideRuntimeSha256": "(복사본 실측 64자)",
     "compression": "EXT_meshopt_compression+KHR_mesh_quantization",
     "files": { "glb": "rider.glb", "guideWeights": "guide-weights.json" }
   }
   ```
6. 표준출력에 `candidateId` 와 세 파일 해시를 한 줄씩 출력.

## 실행

`apps/web` 에서 한 번 실행한다:
`node scripts/rider-preserve/stage-rider14.mjs --source "<R>"`

이어서 다음을 확인·기록한다:
- 대상 폴더 파일 3개, 크기(GLB 245,120 B 이어야 함), 해시
- 원본 3파일 해시가 실행 전후 같음
- s5 폴더 `candidates/20260921-041426-cd81398e/` 3파일 해시가 실행 전후 같음
- 일부러 실패 경로 2개 시험: ① 같은 `--id` 로 두 번째 실행 → 덮어쓰기 거부 ② `--source` 를 존재하지 않는 경로로 → 아무 파일도 생기지 않음 (`git status --short` 로 확인)
- `node --test scripts/rider-preserve/preserved-layer-contract.test.mjs` exit code (변경 없이 통과해야 함)
- `npx eslint scripts/rider-preserve/stage-rider14.mjs`

## 결과 파일 `03-result-p1.md`

candidateId · 명령과 exit code · 해시 표(원본/복사본/s5 전후) · 실패 경로 시험 결과 · `git -C C:\20.HDev\boxcycle-rider14 status --short` 출력 · 이상 사항.

## 금지

- GLB·JSON 재export·재압축·정렬·후처리 금지 (바이트 복사만)
- `apps/web/src/**`, `config.ts`, 기존 시험·검증기 수정 금지 — 앱은 아직 s5 를 가리킨다
- rider 작업 폴더·본 작업트리 쓰기 금지, commit·push·`npm install` 금지

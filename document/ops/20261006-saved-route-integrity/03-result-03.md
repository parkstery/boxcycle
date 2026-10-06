# 결과 03 — 퍼블릭 신청 지문 오거절 수정 (`functions/` 만)

| 항목 | 내용 |
|---|---|
| 지시 | [02-task-03.md](02-task-03.md) |
| 담당 | Developer (Cursor CLI) |
| 상태 | **DEVELOPMENT_DONE** — 커밋·푸시·배포 안 함 |
| 범위 | `functions/` 만 (`apps/web` 미수정) |

## 변경 요약

저장 경로 대조를 **저장 문서 geometry 로 지금 규칙 지문을 재계산**해 신청 지문과 비교하도록 바꿨다. 저장 필드의 옛 `routeFingerprint` 는 더 이상 거절 근거가 아니다. 재계산이 일치하고 저장값만 다르면 `routeFingerprint` 필드만 백필한다.

| 파일 | 내용 |
|---|---|
| `functions/src/savedRouteFingerprintMatch.ts` | **신설** — `decodeSavedRouteCoords` · `matchSavedRouteFingerprint` |
| `functions/src/savedRouteFingerprintMatch.test.ts` | **신설** — (a)(b)(c)(d1)(d2) + legacy geometry |
| `functions/src/autoReviewPublicRouteRequest.ts` | §3c 저장 경로 대조를 위 판정 호출 + 백필 update |
| `functions/package.json` | `test` 목록에 `lib/savedRouteFingerprintMatch.test.js` 추가 |

신청 자체 지문 검사(`req.routeFingerprint` vs 신청 좌표 재계산)는 **그대로** 둠.

### Diff 요약

- `autoReviewPublicRouteRequest.ts`: 저장값 `!==` 직접 거절 제거 → `matchSavedRouteFingerprint` + `needsBackfill` 시 `savedRoutes/{id}` 의 `routeFingerprint` 만 update
- 판정 모듈: `geometryCoordsJson` 우선, 없으면 `geometry.coordinates`; profile 은 `resolveRouteProfile(doc.profile)`
- 거절 문구: 모양 불일치 → 「저장된 경로와 신청한 경로의 모양이 다릅니다. 내 경로에서 다시 선택해 신청하세요.」 / geometry 불가독 → 「저장된 경로의 좌표를 확인할 수 없습니다. …」

## 검증

| 명령 | 폴더 | 결과 |
|---|---|---|
| `npm run build` | `functions/` | 0 에러 |
| `npm test` | `functions/` | **42 pass / 0 fail** (기존 36 + 신설 6) |

### 사보타주

`matchSavedRouteFingerprint` 본문을 「저장값 64자이고 신청 지문과 다르면 거절」로 잠시 교체한 뒤 `node --test lib/savedRouteFingerprintMatch.test.js` 실행:

- **(a) 실패** (`ok` expected true, got false) — 옛 규칙 저장값 + 같은 geometry 가 다시 오거절됨을 확인
- (b)(c)(d1) 등은 우연히 통과하거나 다른 assertion 실패
- 원복 후 `npm test` 다시 42 pass

## grep — 저장 `routeFingerprint` 를 재계산 없이 다루는 곳 (수정 안 함)

지시: 목록만 보고, 이번 범위에서 고치지 않음.

| 위치 | 동작 | 비고 |
|---|---|---|
| `autoReviewPublicRouteRequest.ts` ~185 | 신청 `routeFingerprint` vs 신청 좌표 재계산 | **의도 유지**(요구 2). 저장 문서 대조가 아님 |
| `backfillRoutePublicationsCore.ts` ~32–46 | courses 저장값을 publication 에 그대로 복사 | 옛 규칙 값이면 publication 에도 옛 지문이 들어갈 수 있음 |
| `backfillRoutePublications.ts` ~94–113 | 위와 동일(CLI 경로) | 동일 |
| `backfillCourseMetadataCore.ts` ~58–65, ~83 | 이미 64자면 fingerprint 패치 skip | geometry 로 재검증하지 않음(이미 있으면 신뢰) |

참고(재계산하는 쪽, 문제 아님): `cliDedupeSavedRoutes.ts`(geometry 재계산 후 백필), `seedBasicIntroPublicationsCore.ts`(시드 시 계산).

## 배포 (실행하지 않음 — Chief)

효과 반영에는 Cloud Functions 배포가 필요하다.

```text
# 저장소 루트 C:\20.HDev\boxcycle
npm run deploy:functions
# → firebase deploy --only functions
```

단일 함수만 배포하려면(루트에서):

```text
firebase deploy --only functions:autoReviewPublicRouteRequest
```

## 범위 밖·미실시

- `apps/web` 미수정 (지시 04 병행)
- 커밋·푸시·배포 금지 준수
- 위 grep 목록의 backfill/CLI 경로는 수정하지 않음

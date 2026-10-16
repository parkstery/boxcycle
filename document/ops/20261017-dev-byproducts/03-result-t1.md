# 결과 T1 — 개발 부산물 삭제

| 항목 | 내용 |
|---|---|
| 수행 | **OpenCode Muse Spark** (삭제·호출처 정리·검증) → 결과 파일 작성 직전 **사용 한도 초과로 중단** → **Supervisor (Claude) 가 마무리**(누락 확인, CSS 잔여 제거, `.out` 추적 해제, 재검증, 이 파일) |
| 교대 | 규칙에 따라 다음 지시(T2)는 **Cursor** |
| 판정 | **APPROVED** (Supervisor 자체 감리) |

## 지운 것 — 69개 파일 삭제 + 10개 추적 해제

| 묶음 | 수 |
|---|---:|
| `apps/web/scripts/rider-cycle-fit/` 전체 | 35 |
| `apps/web/scripts/rider-preview/` 전체 | 11 |
| `rider-preserve/` 일회성 조사 7종 | 7 |
| `peer-sync/` `s3b2r`·`s41r` summarize | 2 |
| `map/` headless 2종 | 2 |
| UI 캡처 픽스처 4종, `phase-c-three-loop` | 5 |
| 루트 `scripts/move-lib-files.mjs`·`repair-lib-imports.mjs`, `apps/web/scripts/build-rider-candidate.mjs`(삭제한 rider-preview 를 import — 감리 중 dep 검사가 발견) | 3 |
| DEV 디버그: `tickTestSwitches`, `TickTestOffBadge`, `localFirstGeoProbe`, `peerSmoothnessProbe` | 4 |
| 죽은 코드 `parseWeatherOverride`(33줄) | 함수 |
| `.out` 추적 해제(디스크 유지): ride-map-controls 8, saved-route-readability 2 | 10 |

호출처 정리: `MapView.tsx`(tickTest 훅·배지), `rideCameraFollow.ts`(운영 기본값 그대로 — follow 조건은 `followMode === "free"` 만, `alignCam`·`stopFirst` = true), `LocalFirstEntryCard.tsx`, `PeerMotionRegistry.ts`, `MapView.css`(배지 스타일), `dep-layers.json`(3항목).

## 남긴 것 — 조사 목록에 있었지만 쓰이고 있음

| 파일 | 이유 |
|---|---|
| `peer-sync/` `s3av`·`s3b1`·`s3b2`·`s3b3`·`s3r`·`s41` summarize | `apps/web/e2e/peer-sync-*.spec.ts` 가 사용 (재고 조사가 `e2e/` 를 빠뜨림) |
| `mapTickProbe.ts` | 계측 외에 **제품 로직**(`isFollowCameraJump` 등, 운영 카메라 추종에서 사용)이 들어 있음. T3 등록 시 제품 로직 분리 검토 |
| `installLiveRideExistsDebug.ts`·`installMotionExistsDebug.ts` | `e2e/peer-sync-s41r.spec.ts` 가 사용(파일 주석 "지우면 안 된다") |

## 검증 (worktree, Supervisor 재실행)

| 항목 | 결과 |
|---|---|
| `tsc -b` | 0 |
| 변경 파일 eslint | 오류 0 (기존 경고 8) |
| `check-dep-direction --check` | 도메인 지정 PASS |
| `test:rider-preserve` | 통과 (Muse) |
| `test:quick` | 1217 통과 · 실패 5 = worktree 환경 3(`functions/lib` 부재) + 2(`.env` 의 Mapbox 토큰 부재 — gitignore) |
| `check-document-system` | newErrors 1 = gitignore 된 `muse-task-04-output.log` 가 worktree 에 없음(본 트리에는 있음) |
| `npm run build` | 0, 기본 청크 3,731.24 kB → 3,731.24 kB (지운 코드는 원래 운영에서 빠지던 DEV 코드라 크기 같음 — 운영 동작 변화 없음) |

환경 의존 실패 3종은 본 트리 pre-push 게이트에서 재확인한다.

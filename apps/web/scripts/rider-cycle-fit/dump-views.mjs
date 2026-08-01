/**
 * required-views.mjs 정본을 JSON 으로 덤프한다(Blender 파이썬이 읽기 위한 다리).
 * 정본을 파이썬 쪽에 복제하지 않기 위한 것 — 뷰 정의는 required-views.mjs 한 곳에만 둔다.
 *
 * 실행: node dump-views.mjs
 */
import {
  STATIC_VIEWS,
  RIDER_ONLY_VIEWS,
  STATIC_CLOSEUPS,
  PEDAL_PHASES,
  PHASE_VIEWS,
  CONTACT_SHEETS,
  ANCHORS,
  CLOSEUP_DIST,
  QUALITY,
  requiredImageIds,
} from "./required-views.mjs";

process.stdout.write(JSON.stringify({
  staticViews: STATIC_VIEWS,
  riderOnlyViews: RIDER_ONLY_VIEWS,
  staticCloseups: STATIC_CLOSEUPS,
  phases: PEDAL_PHASES,
  phaseViews: PHASE_VIEWS,
  contactSheets: CONTACT_SHEETS,
  anchors: ANCHORS,
  closeupDist: CLOSEUP_DIST,
  quality: QUALITY,
  required: requiredImageIds(),
}));

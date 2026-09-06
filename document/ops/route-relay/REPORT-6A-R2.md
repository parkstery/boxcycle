# REPORT-6A-R2

| item | value |
|---|---|
| work id | UI-DECLUTTER-SENSOR-6A-R2 |
| branch | fix/ui-declutter-6a |
| base | d3f7bb3 |
| when | 2026-09-07 KST |

## 1. Summary
Chief screen judgment 3 items applied.

1. Axis change: `.route-dock__shell` `row` -> **`column`**. Sensor chip + collapse caret in always-visible **top bar**; panel below with `hidden={!expanded}`.
2. Always show dock: `isRouteDockStageVisible` adds **`idle`**. Keep excluding gate / gate-nickname / summary.
3. Delete MapHud TR chip completely: CadenceHudChip / showCadenceChip / resolveCadenceChipSurface / cadence prop removed. Top-right = account + map only.

Chip behavior (rpm, colors, sheet open) unchanged. Go untouched. Section 8 other surfaces out of scope.

## 2. DOM / CSS axis change
### Before (d3f7bb3)
`[vertical caret] [sensor-rail] [panel]` — shell **row** + stretch => rail grows to panel height (space waste).

### After (6A-R2)
Top bar (chip + caret) always visible; collapsible panel below.
- Removed: `route-dock__sensor-rail`, vertical caret-name strip
- Added: `route-dock__topbar` (+ spacer); caret is horizontal collapse icon
- Landscape (`max-height: 560px`) shrink rules retargeted to topbar
- Panel animation: translateX -> translateY

## 3. idle / gate decisions
| stage | dock | chip |
|---|---|---|
| idle, setup, ready-to-start, riding, paused | shown | topbar chip (collapsed/expanded) |
| gate, gate-nickname, summary | absent | absent |

Evidence: MapHud already hid chip with `!isGate && !isSummary` — not a regression. No counter-evidence found; proceeded as instructed.
`resolveCadenceChipSurface` / MapHud fallback **deleted**. idle now has dock so fallback is unnecessary.

## 4. Expand paths
- Initial: `useState(() => visible && stops.length > 0)` => idle+0 stops collapsed; mount with stops expands (saved-route load)
- Change key: visible / stopsLen / **stage**
  - visible && stops>0 => expand
  - stage===idle && stops===0 => collapse
- Pin add still auto-expands via stopsLen change

## 5. Removal scope
- MapHud.tsx: CadenceHudChip, showCadenceChip, MapHudCadence, cadence prop
- App.tsx: mapHud `cadence: cadenceHud` x2 removed (RouteDock `cadence={cadenceHud}` kept)
- routeDockVisibility.ts / index.ts: resolveCadenceChipSurface deleted
- cadence prop not kept on MapHud (unused)

## 6. Section 4.5 Landscape measure (pass criterion)
Playwright viewport **844x390**, baseline CSS at d3f7bb3 vs after CSS.
Script: `apps/web/scripts/route-dock/measure-6a-r2.mjs`
Metrics: `apps/web/scripts/route-dock/6a-r2-measure/metrics.json`

| state | before WxH px | after WxH px | note |
|---|---|---|---|
| collapsed | **90x58** | **101x33** | height -25px (-43%); stretch waste gone |
| expanded | **288x100** | **184x130** | width -104px (-36%); height +30px (panel stacked below) |

Pass: collapsed height and expanded width drop; chip no longer stretches to panel height.

## 7. Screenshots
- apps/web/scripts/route-dock/6a-r2-measure/idle-collapsed.png
- apps/web/scripts/route-dock/6a-r2-measure/ready-expanded.png
- apps/web/scripts/route-dock/6a-r2-measure/riding-collapsed.png
- apps/web/scripts/route-dock/6a-r2-measure/top-right-empty.png

## 8. Tests
8 pass cadence; 10/10 selectors; 61 next-ride; 141 distance; builds OK; diff-check OK

## 9. Chief verify
use worktree root then start localhost:5000

## 10. Brief
chip in topbar; idle dock; MapHud chip gone; landscape 90x58->101x33 and 288x100->184x130

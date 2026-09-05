# REPORT-6A - UI-DECLUTTER-SENSOR-6A

| item | value |
|---|---|
| work id | UI-DECLUTTER-SENSOR-6A |
| branch | fix/ui-declutter-6a |
| when (KST) | 2026-09-05 |
| deps | root install OK; functions install OK (no junction/robocopy) |

## 1. Summary
- Moved CadenceHudChip from MapHud map-hud__tr into RouteDock rail route-dock__sensor-rail outside collapsible panel.
- Chip behavior unchanged (rpm, colors, sheet open). Go untouched.
- Phone landscape shrink under max-height 560px media query.

## 2. Section 4.3 signed-out evidence (code, not guess)
1. App.tsx needsAuthCard when !user (unless VITE_ALLOW_UNAUTH_MAP).
2. useRideUiStage: needsAuthCard => stage gate.
3. isRouteDockStageVisible only setup/ready-to-start/riding/paused; gate => dock null.
4. signed-out without unauth map: RouteDock does not show.
5. resolveCadenceChipSurface(gate)=map-hud-tr keeps MapHud top-right fallback.
6. MapHud authGateVisualDismissed=needsAuthCard allows TR while stage is gate.

## 3. Tests
- next-ride 61 pass; distance-auto-route 141 pass; ride-camera-framing 70 pass
- cadence-chip-visibility-contract 6 pass (8-combo)
- ride-verify selectors 10/10; functions build OK; web build OK; git diff --check OK

## 4. Layout / screenshots
- Go px before/after not measured in browser this turn; landscape CSS shrink applied.
- Screenshots not attached. Chief verify: cd worktree then run script dev:localhost at 127.0.0.1:5000

## 5. Auditor corrections
- None

## 6. Korean brief
- sensor chip -> RouteDock header rail; Go unchanged; signed-out fallback MapHud TR (sec 2).


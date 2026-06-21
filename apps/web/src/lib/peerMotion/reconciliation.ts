import type { PeerMotionEntity } from "./types";
import {
  PEER_RECONCILE_HARD_M,
  PEER_RECONCILE_HARD_PULL_MPS,
  PEER_RECONCILE_SOFT_M,
  PEER_RECONCILE_SOFT_PULL_MPS,
} from "../rideSyncPolicy";
import { clampRouteDist } from "./integrator";

const DIST_EPS_M = 0.2;

function signM(v: number): number {
  if (v > DIST_EPS_M) return 1;
  if (v < -DIST_EPS_M) return -1;
  return 0;
}

/**
 * 패킷 ingest 직후 — displayDistM 은 건드리지 않고 pull 속도만 설정.
 * |err| ≤ SOFT: pull 0 (연속 sim 유지)
 * SOFT < |err| ≤ HARD: 완만한 pull
 * |err| > HARD: 빠른 pull (snap 금지)
 */
export function applyReconciliationOnIngest(entity: PeerMotionEntity): void {
  if (entity.phase !== "live") {
    entity.reconcilePullMps = 0;
    return;
  }

  const err = entity.authDistM - entity.displayDistM;
  const absErr = Math.abs(err);

  if (absErr <= PEER_RECONCILE_SOFT_M) {
    entity.reconcilePullMps = 0;
    return;
  }

  const pullCap =
    absErr <= PEER_RECONCILE_HARD_M
      ? PEER_RECONCILE_SOFT_PULL_MPS
      : PEER_RECONCILE_HARD_PULL_MPS;
  entity.reconcilePullMps = signM(err) * pullCap;
}

/** rAF step — speed 적분 후 auth 쪽으로 pull (overshoot 없음) */
export function applyReconciliationStep(
  entity: PeerMotionEntity,
  dtSec: number,
  routeLenM: number,
): void {
  if (entity.phase !== "live" || Math.abs(entity.reconcilePullMps) <= 0.001) return;

  const err = entity.authDistM - entity.displayDistM;
  const absErr = Math.abs(err);
  if (absErr <= DIST_EPS_M) {
    entity.reconcilePullMps = 0;
    return;
  }

  const stepM = entity.reconcilePullMps * dtSec;
  if (Math.abs(stepM) >= absErr) {
    entity.displayDistM = clampRouteDist(entity.authDistM, routeLenM);
    entity.reconcilePullMps = 0;
    return;
  }

  entity.displayDistM = clampRouteDist(entity.displayDistM + stepM, routeLenM);

  if (Math.abs(entity.authDistM - entity.displayDistM) <= PEER_RECONCILE_SOFT_M) {
    entity.reconcilePullMps = 0;
  }
}

import { lazy, Suspense } from "react";
import type { Camera1Mode } from "../../lib/camera/camera1Mode";
import { isRideCameraLabEnabled, type RideCameraLabQc } from "../../lib/debug/rideCameraLab";
import { isPerfLabEnabled } from "../../lib/debug/perfLabFacade";
import { isRiderLightLabEnabled } from "../../lib/riderPrototype/riderLightLabSwitch";

const RiderLightLabPanel = lazy(() =>
  import(/* webpackChunkName: "lightlab-panel" */ "../riderLightLab/RiderLightLabPanel").then((m) => ({
    default: m.RiderLightLabPanel,
  })),
);

const RideCameraLabPanel = lazy(() =>
  import(/* webpackChunkName: "camlab-panel" */ "../rideCameraLab/RideCameraLabPanel").then((m) => ({
    default: m.RideCameraLabPanel,
  })),
);

const PerfLabPanel = lazy(() =>
  import(/* webpackChunkName: "perflab-panel" */ "../perfLab/PerfLabPanel").then((m) => ({
    default: m.PerfLabPanel,
  })),
);

type Props = {
  mapZoom: number;
  activeQuickCamera: RideCameraLabQc | null;
  camera1Mode: Camera1Mode;
  onDistanceM: (distanceM: number) => void;
};

/**
 * 주소 스위치가 켜진 조절판만 별도 청크로 불러온다. 꺼져 있으면 import 를 시작하지 않는다.
 */
export function DevLabPanels({ mapZoom, activeQuickCamera, camera1Mode, onDistanceM }: Props) {
  const lightlab = isRiderLightLabEnabled();
  const camlab = isRideCameraLabEnabled();
  const perflab = isPerfLabEnabled();
  if (!lightlab && !camlab && !perflab) return null;
  return (
    <Suspense fallback={null}>
      {lightlab ? <RiderLightLabPanel /> : null}
      {camlab ? (
        <RideCameraLabPanel
          activeQuickCamera={activeQuickCamera}
          camera1Mode={camera1Mode}
          onDistanceM={onDistanceM}
        />
      ) : null}
      {perflab ? <PerfLabPanel mapZoom={mapZoom} /> : null}
    </Suspense>
  );
}

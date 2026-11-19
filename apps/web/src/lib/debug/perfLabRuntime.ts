/**
 * `?perflab=1` 일 때만 불러오는 계측 묶음.
 * 제품 경로는 이 파일을 정적 import 하지 않는다.
 */
export { noteRiderJitterFrame } from "./riderJitterProbe";
export {
  noteReactProfilerCommit,
  openFrameBreakdownTick,
} from "./frameBreakdownProbe";
export {
  installRiderRenderCostProbe,
  measureRiderPose,
  measureRiderRenderFrame,
  noteRiderPerfScene,
} from "./riderRenderCostProbe";

import { attachMapRenderProbe as attachFrameProbe } from "./frameBreakdownProbe";
import { attachRenderingDiagnostics } from "./renderingDiagnostics";
export { noteRenderingDiagnostic } from "./renderingDiagnostics";
export function attachMapRenderProbe(map: object): () => void {
  const detachFrame = attachFrameProbe(map);
  const detachDiagnostics = attachRenderingDiagnostics(map);
  return () => { detachDiagnostics(); detachFrame(); };
}

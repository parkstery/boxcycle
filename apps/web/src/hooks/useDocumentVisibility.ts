import { useEffect, useState } from "react";
import {
  resolveDocumentVisible,
  subscribeDocumentVisibilityOverride,
} from "../lib/debug/documentVisibilityOverride";

/** `document.visibilityState` — 백그라운드에서 리스너·쓰기 완화용 */
export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(() => resolveDocumentVisible());

  useEffect(() => {
    const sync = () => setVisible(resolveDocumentVisible());
    const unsubOverride = subscribeDocumentVisibilityOverride(sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      unsubOverride();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return visible;
}

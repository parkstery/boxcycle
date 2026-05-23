import { useEffect, useRef } from "react";
import { CancelMapillaryError, TransitionMode, Viewer } from "mapillary-js";
import "mapillary-js/dist/mapillary.css";
import type { LngLat } from "../../lib/geo";

const ALIGN_DEBOUNCE_MS = 820;

type Props = {
  accessToken: string;
  imageId: string;
  lookAt: LngLat;
  driveHeadingDeg: number | null;
  sphericalNavigation: boolean;
};

async function alignViewToLookAt(viewer: Viewer, lookAt: LngLat): Promise<void> {
  try {
    const basic = await viewer.project({ lng: lookAt[0], lat: lookAt[1] });
    if (basic && basic.length >= 2 && Number.isFinite(basic[0]) && Number.isFinite(basic[1])) {
      const y = Math.min(0.92, Math.max(0.08, basic[1]));
      viewer.setCenter([basic[0], y]);
    }
  } catch {
    /* noop */
  }
}

export function MapillaryRideViewer({
  accessToken,
  imageId,
  lookAt,
  driveHeadingDeg,
  sphericalNavigation,
}: Props) {
  void driveHeadingDeg;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const mountedImageRef = useRef<string>("");
  const lookAtRef = useRef(lookAt);
  lookAtRef.current = lookAt;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const viewer = new Viewer({
      accessToken,
      container: el,
      transitionMode: TransitionMode.Instantaneous,
      component: {
        cover: false,
        direction: false,
        sequence: { visible: false },
        attribution: true,
      },
    });
    viewer.setTransitionMode(TransitionMode.Instantaneous);
    viewerRef.current = viewer;
    mountedImageRef.current = "";
    return () => {
      viewerRef.current = null;
      mountedImageRef.current = "";
      viewer.remove();
    };
  }, [accessToken]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cancelled = false;
    void (async () => {
      try {
        if (sphericalNavigation) await viewer.setFilter(["==", "cameraType", "spherical"]);
        else await viewer.setFilter(undefined);
      } catch {
        /* noop */
      }
      if (cancelled) return;
      try {
        await viewer.moveTo(imageId);
        mountedImageRef.current = imageId;
        await alignViewToLookAt(viewer, lookAtRef.current);
      } catch (e) {
        if (e instanceof CancelMapillaryError) return;
        console.warn("[MapillaryRideViewer]", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageId, sphericalNavigation]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || mountedImageRef.current !== imageId) return;
    const t = window.setTimeout(() => {
      void alignViewToLookAt(viewer, lookAt);
    }, ALIGN_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [lookAt, imageId]);

  return <div ref={containerRef} className="mapillary-ride-viewer__canvas" />;
}

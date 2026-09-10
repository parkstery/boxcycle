/**
 * RIDE-CLAIM-RESULT-1: 세션 궤적 SVG 미리보기 컴포넌트.
 * 추가 Mapbox 인스턴스 없이 이번 세션 + 주변 내 도로망을 SVG 로 렌더한다.
 */
import { useMemo } from "react";
import type { LngLat } from "../../lib/geo";
import { buildSessionPreviewPaths } from "../../lib/rideSessionPreview";
import "./RideSessionTracePreview.css";

type RideSessionTracePreviewProps = {
  /** 종료 시 고정된 세션 궤적 LngLat[] */
  sessionPathLngLat: LngLat[] | null | undefined;
  /**
   * 이미 로드된 내 도로망 geometries.
   * LineStringGeometry[] 또는 null. 세션 bounds 내 클리핑은 preview lib 에서 수행.
   */
  conquestTraces?: Array<{ type: string; coordinates: number[][] }> | null;
};

export function RideSessionTracePreview({
  sessionPathLngLat,
  conquestTraces,
}: RideSessionTracePreviewProps) {
  const preview = useMemo(
    () => buildSessionPreviewPaths(sessionPathLngLat, conquestTraces ?? null),
    [sessionPathLngLat, conquestTraces],
  );

  if (!preview) {
    return (
      <div className="ride-trace-preview ride-trace-preview--fallback" aria-hidden>
        <p className="ride-trace-preview__fallback-msg">
          이번 주행의 경로 미리보기를 표시할 수 없어요
        </p>
      </div>
    );
  }

  const { width, height, sessionPath, tracePaths } = preview;

  return (
    <div className="ride-trace-preview">
      <svg
        className="ride-trace-preview__svg"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-label="이번 주행 경로 미리보기"
        role="img"
      >
        <title>이번 주행 경로 미리보기</title>
        <desc>이번 세션에 달린 길과 주변의 내 도로망을 나타낸 지도</desc>
        {/* 배경 없음 */}
        {/* 가는 선: 내 도로망 */}
        {tracePaths.map((d, i) => (
          <path
            key={i}
            className="ride-trace-preview__trace"
            d={d}
          />
        ))}
        {/* 굵은 선: 이번에 달린 길 */}
        <path
          className="ride-trace-preview__session"
          d={sessionPath}
        />
      </svg>
      <div className="ride-trace-preview__legend" aria-hidden>
        <span className="ride-trace-preview__legend-item ride-trace-preview__legend-item--session">
          <span className="ride-trace-preview__legend-line ride-trace-preview__legend-line--session" />
          이번에 달린 길
        </span>
        {tracePaths.length > 0 ? (
          <span className="ride-trace-preview__legend-item ride-trace-preview__legend-item--trace">
            <span className="ride-trace-preview__legend-line ride-trace-preview__legend-line--trace" />
            내 도로망
          </span>
        ) : null}
      </div>
    </div>
  );
}

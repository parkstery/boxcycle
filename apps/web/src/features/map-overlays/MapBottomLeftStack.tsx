import type { ReactNode } from "react";
import "./MapBottomLeftStack.css";

export type MapBottomLeftStackProps = { children: ReactNode };

/**
 * 좌하단 한 자리를 나눠 쓰는 스택 — RouteDock · 「다음 주행」 카드 · 입문 CTA.
 *
 * 2026-09-16: 셋은 각자 `position: absolute` 로 **같은 좌표**에 붙어 있었다.
 * 종전에는 서로 배타적이라(dock 은 경로가 있을 때, 카드는 idle) 겹칠 일이 없었는데,
 * 센서 칩을 위해 dock 을 `idle` 에도 띄우면서 정면으로 부딪히게 됐다.
 * 좌표는 이 스택이 혼자 갖고, 안쪽은 흐름에 맡겨 세로로 쌓는다.
 *
 * 순서는 렌더 순서 그대로 — 아래쪽(화면 하단, 엄지에 가까운 자리)이 주 행동이다.
 */
export function MapBottomLeftStack({ children }: MapBottomLeftStackProps) {
  return <div className="map-bottom-left-stack">{children}</div>;
}

import "./RouteEndpointMarkers.css";

/** 종점 깃발 — 장대 밑동이 종점. 오른쪽 끝에 붙으면 깃발을 왼쪽으로 단다 */
const FLAG_POLE_H = 13;
const FLAG_W = 9;
const FLAG_H = 6;

export function GoalFlag({ x, y, boxW, waving }: { x: number; y: number; boxW: number; waving: boolean }) {
  const dir = x + FLAG_W + 2 > boxW ? -1 : 1;
  const top = y - FLAG_POLE_H;
  const cell = FLAG_W / 3;
  const cells = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = dir > 0 ? x + c * cell : x - (c + 1) * cell;
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={cx}
          y={top + r * (FLAG_H / 2)}
          width={cell}
          height={FLAG_H / 2}
          fill={(r + c) % 2 === 0 ? "#10151f" : "#ffffff"}
        />,
      );
    }
  }
  return (
    <g className={`route-minimap__goal${waving ? " route-minimap__goal--waving" : ""}`}>
      <line className="route-minimap__goal-pole" x1={x} y1={y} x2={x} y2={top} />
      {/* 깃발 천 — 펄럭일 땐 장대 쪽을 축으로 흔든다 */}
      <g
        className="route-minimap__goal-cloth"
        style={{ transformOrigin: `${x}px ${top + FLAG_H / 2}px` }}
      >
        {cells}
        <rect
        className="route-minimap__goal-frame"
        x={dir > 0 ? x : x - FLAG_W}
        y={top}
        width={FLAG_W}
        height={FLAG_H}
        fill="none"
      />
      </g>
      <circle className="route-minimap__goal-base" cx={x} cy={y} r={1.8} />
    </g>
  );
}

/** 미니맵·표고선의 공통 출발 마커. */
export function RouteStartMarker({ x, y }: { x: number; y: number }) {
  return <circle className="route-minimap__endpoint route-minimap__endpoint--start" cx={x} cy={y} r={3.4} />;
}
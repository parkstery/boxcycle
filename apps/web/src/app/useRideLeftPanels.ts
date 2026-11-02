import { useState } from "react";

type LeftPanel = "dock" | "minimap";

/**
 * Chief 11-02 v4 C단계 — 주행 화면 왼쪽의 세 패널(인터벌 안내·경로 카드·미니맵) 규칙.
 *
 * - 인터벌이 시작되면 인터벌은 펼치고, 미니맵은 펼친 채, 경로 카드는 접는다.
 * - 인터벌이 펼쳐져 있는 동안 경로 카드·미니맵은 하나만 펼친다 — 나중에 펼친 쪽이 남고 먼저 펼친 쪽이 접힌다.
 * - 인터벌을 접으면 둘 다 펼칠 수 있다. 둘 다 펼친 채 인터벌을 다시 펼치면 먼저 펼친 쪽을 접는다.
 *
 * 경로 카드의 펼침은 RouteDock 이 갖고 있으므로 접기는 `dockCollapseSignal` 로 요청하고 바뀜은 `onDockExpandedChange` 로 듣는다.
 */
export function useRideLeftPanels(intervalOn: boolean) {
  const [minimapExpanded, setMinimapExpanded] = useState(true);
  const [intervalFolded, setIntervalFolded] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(false);
  const [dockCollapseSignal, setDockCollapseSignal] = useState(0);
  const [lastOpened, setLastOpened] = useState<LeftPanel>("minimap");
  const [prevIntervalOn, setPrevIntervalOn] = useState(intervalOn);
  if (intervalOn !== prevIntervalOn) {
    setPrevIntervalOn(intervalOn);
    if (intervalOn) {
      setIntervalFolded(false);
      setMinimapExpanded(true);
      setLastOpened("minimap");
      setDockCollapseSignal((n) => n + 1);
    }
  }
  const intervalExpanded = intervalOn && !intervalFolded;

  const toggleMinimap = () => {
    const next = !minimapExpanded;
    setMinimapExpanded(next);
    if (!next) return;
    setLastOpened("minimap");
    if (intervalExpanded && dockExpanded) setDockCollapseSignal((n) => n + 1);
  };

  const onDockExpandedChange = (expanded: boolean, byUser: boolean) => {
    setDockExpanded(expanded);
    if (!expanded || !byUser) return;
    setLastOpened("dock");
    if (intervalExpanded && minimapExpanded) setMinimapExpanded(false);
  };

  const toggleIntervalFold = () => {
    const nextFolded = !intervalFolded;
    setIntervalFolded(nextFolded);
    if (nextFolded || !dockExpanded || !minimapExpanded) return;
    if (lastOpened === "dock") setMinimapExpanded(false);
    else setDockCollapseSignal((n) => n + 1);
  };

  return {
    minimapExpanded,
    toggleMinimap,
    intervalFolded,
    toggleIntervalFold,
    dockCollapseSignal,
    onDockExpandedChange,
  };
}

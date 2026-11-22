import { useState } from "react";
import { createRoot } from "react-dom/client";
import { IntervalWorkoutStatsSheet } from "../../src/components/ride/IntervalWorkoutStatsSheet";

const fixture = { failNext: false, delayMs: 80, requests: [] as { userId: string; start: string; end: string }[] };
Object.assign(window, { __intervalStatsFixture: fixture });

export function Fixture() {
  const [userId, setUserId] = useState("fixture-a");
  return <>
    <div style={{ display: "flex", gap: 8, padding: 8, color: "white", font: "12px sans-serif" }}>
      <span>{userId}</span>
      <button type="button" onClick={() => setUserId(userId === "fixture-a" ? "fixture-b" : "fixture-a")}>계정 전환</button>
      <button type="button" onClick={() => { fixture.failNext = true; }}>다음 조회 실패</button>
      <button type="button" onClick={() => { fixture.delayMs = 600; }}>지연 조회</button>
    </div>
    <main style={{ position: "absolute", inset: 0, margin: "auto", width: "min(520px, calc(100vw - 16px))", height: "min(250px, calc(100dvh - 90px))", borderRadius: 18, overflow: "hidden", fontFamily: "sans-serif" }}>
      <IntervalWorkoutStatsSheet key={userId} userId={userId} fallbackSessions={[]} onClose={() => {}} />
    </main>
  </>;
}

document.body.style.margin = "0";
document.body.style.background = "#24334b";
createRoot(document.getElementById("root")!).render(<Fixture />);

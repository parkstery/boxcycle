import { readFileSync } from "node:fs";

const raw = JSON.parse(
  readFileSync(new URL("../../../../document/ops/sync-relay/S44-jitter-capture.json", import.meta.url), "utf8"),
);
const display = raw.events.filter((e) => e.kind === "display");
const t0 = raw.windowStartedAt;
const JITTER_SCREEN_REVERSE_PX = 8;

const reverses = [];
let prev = null;
let prevDx = 0;
let prevDy = 0;
let maxBack = 0;
let backAt = null;
for (const ev of display) {
  if (prev) {
    const back = prev.displayDistM - ev.displayDistM;
    if (back > maxBack) {
      maxBack = back;
      backAt = { t: ev.atMs - t0, from: prev.displayDistM, to: ev.displayDistM };
    }
    if (prev.screenX != null && ev.screenX != null) {
      const dx = ev.screenX - prev.screenX;
      const dy = ev.screenY - prev.screenY;
      const reverse =
        dx * prevDx + dy * prevDy < 0 &&
        Math.hypot(dx, dy) >= JITTER_SCREEN_REVERSE_PX &&
        Math.hypot(prevDx, prevDy) >= JITTER_SCREEN_REVERSE_PX;
      if (reverse) {
        reverses.push({
          tMs: ev.atMs - t0,
          dt: ev.atMs - prev.atMs,
          distFrom: prev.displayDistM,
          distTo: ev.displayDistM,
          distBack: back,
          x0: prev.screenX,
          y0: prev.screenY,
          x1: ev.screenX,
          y1: ev.screenY,
          mag: Math.hypot(dx, dy),
          prevMag: Math.hypot(prevDx, prevDy),
        });
      }
      prevDx = dx;
      prevDy = dy;
    }
  }
  prev = ev;
}

const dts = [];
for (let i = 1; i < display.length; i += 1) dts.push(display[i].atMs - display[i - 1].atMs);
dts.sort((a, b) => a - b);
const medianDt = dts[Math.floor(dts.length / 2)];

console.log(
  JSON.stringify(
    {
      displayN: display.length,
      medianDt,
      spanMs: display.at(-1).atMs - display[0].atMs,
      maxBack,
      backAt,
      reverseN: reverses.length,
      reverses,
      first: display[0],
      last: display.at(-1),
    },
    null,
    2,
  ),
);

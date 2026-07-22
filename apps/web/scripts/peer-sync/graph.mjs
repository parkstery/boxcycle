// 재생 결과를 distM-vs-time SVG 로 그린다. 외부 의존 없이 SVG 문자열 직접 생성.
// 파란 선 = 렌더된 displayDistM(보간 결과), 회색 점 = 수신 패킷(정답).
// 두 선이 ~DELAY 만큼 뒤진 채 겹치면 정상. 렌더선이 튀거나 역행하면 눈에 보인다.

const W = 720;
const H = 200;
const PAD = { l: 48, r: 12, t: 16, b: 28 };

function scaleFns(results) {
  let maxT = 0;
  let maxD = 0;
  for (const r of results) {
    for (const p of r.timeline) {
      if (p.tMs > maxT) maxT = p.tMs;
      if (p.displayDistM > maxD) maxD = p.displayDistM;
    }
    for (const s of r.sent) if (s.distM > maxD) maxD = s.distM;
  }
  maxT = maxT || 1;
  maxD = maxD || 1;
  const x = (t) => PAD.l + (t / maxT) * (W - PAD.l - PAD.r);
  const y = (d) => H - PAD.b - (d / maxD) * (H - PAD.t - PAD.b);
  return { x, y, maxT, maxD };
}

function panel(result, idx) {
  const { x, y, maxT, maxD } = scaleFns([result]);
  const renderPts = result.timeline
    .map((p) => `${x(p.tMs).toFixed(1)},${y(p.displayDistM).toFixed(1)}`)
    .join(" ");
  const sentDots = result.sent
    .map((s) => `<circle cx="${x(s.tMs).toFixed(1)}" cy="${y(s.distM).toFixed(1)}" r="1.6" fill="#9aa4b2"/>`)
    .join("");
  const yTop = idx * (H + 12);
  return `
<g transform="translate(0 ${yTop})">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0f1218" stroke="#232a35"/>
  <text x="${PAD.l}" y="12" fill="#e6edf3" font-size="11" font-family="monospace">${result.name}  ·  route ${result.routeLenM}m  ·  ${(maxT / 1000).toFixed(1)}s</text>
  <line x1="${PAD.l}" y1="${H - PAD.b}" x2="${W - PAD.r}" y2="${H - PAD.b}" stroke="#2b3341"/>
  <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${H - PAD.b}" stroke="#2b3341"/>
  <text x="4" y="${PAD.t + 4}" fill="#6b7480" font-size="9" font-family="monospace">${maxD.toFixed(0)}m</text>
  ${sentDots}
  <polyline points="${renderPts}" fill="none" stroke="#4c8dff" stroke-width="1.4"/>
</g>`;
}

export function renderTimelineSvg(results) {
  const totalH = results.length * (H + 12);
  const panels = results.map((r, i) => panel(r, i)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <rect width="${W}" height="${totalH}" fill="#0b0e13"/>
  ${panels}
  <text x="${PAD.l}" y="${totalH - 4}" fill="#6b7480" font-size="9" font-family="monospace">파란선=displayDistM(보간)  회색점=수신 패킷(정답)</text>
</svg>`;
}

/** SVG 는 Read 툴이 이미지로 못 여니 chromium 으로 PNG 도 굽는다(눈 검토용). */
export async function svgToPng(svg, pngPath) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    const el = await page.$("svg");
    await el.screenshot({ path: pngPath });
  } finally {
    await browser.close();
  }
}

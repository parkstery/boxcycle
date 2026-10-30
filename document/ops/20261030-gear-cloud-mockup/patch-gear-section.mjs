// mockup.html 의 톱니 절을 실제 버튼 크기(넓은 화면·폰 가로) 비교로 바꾼다.
import fs from "node:fs";
const file = new URL("./mockup.html", import.meta.url);
let h = fs.readFileSync(file, "utf8");
if (!h.includes(".acct{white-space:nowrap;")) h = h.replace(".acct{", ".acct{white-space:nowrap;");
const old = h.match(/<path fill-rule="evenodd" d="(M10\.3[^"]+)"/)[1];
const nw = h.match(/<path fill-rule="evenodd" d="(M10\.11[^"]+)"/)[1];
const tool = (w, ht, s, d, cap) =>
  `<figure><div class="x4wrap"><div class="x4"><div class="tool" style="width:${w}px;height:${ht}px"><svg style="width:${s}px;height:${s}px" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="${d}"/></svg></div></div></div><figcaption>${cap}</figcaption></figure>`;
const big = (d, cap) =>
  `<figure class="big"><svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="${d}"/></svg><figcaption>${cap}</figcaption></figure>`;
const sec =
  `<h2>② RouteDock 주행 설정 톱니 — 지도 위 접힘 상태, 4배 확대</h2><div class="row"><div class="card gear">` +
  tool(30, 30, 24, old, "<b>현재</b> 넓은 화면<br>30×30") +
  tool(26, 30, 24, old, "<b>현재</b> 폰 가로(≤700px)<br>26×30 → 타원으로 찌그러짐") +
  tool(30, 30, 24, nw, "<b>제안</b> 넓은 화면<br>30×30 · 이빨 8개 균등") +
  tool(26, 26, 20, nw, "<b>제안</b> 폰 가로(≤700px)<br>26×26 정원 · 톱니 20px") +
  `</div></div><div class="row"><div class="card gear">` +
  big(old, "<b>현재</b> 모양 — 이빨 6개") +
  big(nw, "<b>제안</b> 모양 — 이빨 8개, 같은 모양·같은 간격") +
  `</div></div>`;
const start = h.indexOf("<h2>② ");
const end = h.indexOf("</body>");
h = h.slice(0, start) + sec + h.slice(end);
const extra =
  ".x4wrap{width:200px;height:150px;display:grid;place-items:center;background:linear-gradient(135deg,#3f5a2e,#6b7d4a 50%,#4a6a3a);border-radius:8px}.x4{transform:scale(4)}.gear figure{width:200px}.gear .big{width:260px}.big svg{width:160px;height:160px}";
if (!h.includes(".x4wrap{")) h = h.replace("</style>", extra + "</style>");
fs.writeFileSync(file, h);

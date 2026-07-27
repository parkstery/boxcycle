/**
 * 어깨 단일 매니폴드 프로토타입 v2 — **해부학적 회색 인체 마네킹** (몸통+양팔, A-pose).
 *
 * 목적(사용자 지시): 의류·자전거 없이 회색 피부 인체로 어깨 해부학 연결을 검증.
 *   포함 덩어리: 두상·목·승모근·쇄골선·흉곽·삼각근·상완·겨드랑이·복부·골반상단.
 *   팔은 A-pose 30° 벌림(겨드랑이·삼각근 연결 보이게). 단일 BufferGeometry(매니폴드).
 *   합격: 목→승모근→쇄골→삼각근→상완, 흉곽→겨드랑이→상완이 사람 연속 표면.
 *   실패: 지붕형 어깨·빈 상의·막대 팔·세로 주름·틈·중첩.
 *
 * 산출: .out/proto-shoulder/{body-4view, shoulder-3view, wireframe, topology}.png
 * 실행: node scripts/rider-preview/proto-shoulder.mjs
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { createServer } from "vite";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.window = globalThis;
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    const finish = (b) => { this.result = b; this.onloadend?.({ target: this }); this.onload?.({ target: this }); };
    if (blob instanceof ArrayBuffer) return void queueMicrotask(() => finish(blob));
    if (ArrayBuffer.isView(blob)) return void queueMicrotask(() => finish(blob.buffer));
    if (typeof blob?.arrayBuffer === "function") return void blob.arrayBuffer().then(finish);
    this.onerror?.(new Error("unsupported blob"));
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(webRootOf());
function webRootOf() { return path.join(__dirname, "..", ".."); }

// ── 위상 파라미터 ────────────────────────────────────────────────────────
const SEG = 24;             // 몸통·팔 링 둘레 정점(짝수). j=0 정면(+x), 시계방향.
const shY = 0.92;           // 어깨선 높이(로컬)

// ── 해부학적 몸통 프로파일 ───────────────────────────────────────────────
// [y, rx(좌우반경), rz(앞뒤반경), cx(앞볼록 오프셋 x)]. 흉곽은 앞으로 볼록(cx>0).
const TORSO = [
  [0.00, 0.150, 0.108, 0.000], // 골반 상단(넓음)
  [0.14, 0.132, 0.100, 0.004], // 복부(잘록)
  [0.30, 0.140, 0.112, 0.012], // 명치(앞 볼록 시작)
  [0.46, 0.162, 0.128, 0.018], // 흉곽 하(앞가슴)
  [0.62, 0.178, 0.130, 0.016], // 흉곽 최대
  [0.76, 0.190, 0.120, 0.008], // 흉곽 상(쇄골 아래, 좌우 넓어짐)
  [shY,  0.200, 0.108, 0.000], // 쇄골선/어깨선(좌우 최대) = armhole 링 하단
  [1.00, 0.150, 0.098, -0.004],// 승모근(목으로 경사·좁아짐) = armhole 링 상단
  [1.06, 0.088, 0.082, -0.004],// 목뿌리
];
const NECK_TOP_I = TORSO.length - 1;

// armhole: 어깨선 링(6)~승모근 링(7) 사이 옆면 호.
const ARM_RING_LO = 6, ARM_RING_HI = 7;
const ARC = 7;              // armhole 호 정점 수(옆면)

// ── 지오메트리 빌드 ──────────────────────────────────────────────────────
const pos = [], idx = [];
const dbgBoundary = []; // topology debug: armhole 경계 정점 인덱스
const dbgStitchTris = []; // topology debug: 스티치 삼각형(정점 3개씩)
function addVert(x, y, z) { pos.push(x, y, z); return pos.length / 3 - 1; }

// 몸통 링 격자.
const ringIdx = [];
for (let i = 0; i < TORSO.length; i++) {
  const [y, rx, rz, cx] = TORSO[i];
  const row = [];
  for (let j = 0; j < SEG; j++) {
    const a = (Math.PI * 2 * j) / SEG;
    const x = (cx ?? 0) + Math.cos(a) * rz; // 앞뒤(얇음)+앞볼록
    const z = Math.sin(a) * rx;             // 좌우(넓음)
    row.push(addVert(x, y, z));
  }
  ringIdx.push(row);
}

function arcRange(sign) {
  const center = sign > 0 ? Math.round(SEG / 4) : Math.round((3 * SEG) / 4);
  const half = Math.floor(ARC / 2), set = [];
  for (let k = -half; k <= half; k++) set.push(((center + k) % SEG + SEG) % SEG);
  return set;
}
const arcL = arcRange(+1), arcR = arcRange(-1);
const arcSet = new Set([...arcL, ...arcR]);

// 몸통 옆면 사각형 — armhole 밴드(LO)의 호는 스킵(개구부).
for (let i = 0; i < TORSO.length - 1; i++) {
  for (let j = 0; j < SEG; j++) {
    const j2 = (j + 1) % SEG;
    if (i === ARM_RING_LO && arcSet.has(j) && arcSet.has(j2)) continue;
    idx.push(ringIdx[i][j], ringIdx[i + 1][j], ringIdx[i][j2], ringIdx[i][j2], ringIdx[i + 1][j], ringIdx[i + 1][j2]);
  }
}
// 몸통 하단 캡(골반).
{
  const cBot = addVert(0, TORSO[0][0], 0);
  for (let j = 0; j < SEG; j++) idx.push(cBot, ringIdx[0][(j + 1) % SEG], ringIdx[0][j]);
}

// ── 목 + 두상 — 목뿌리 링에서 위로. ──
{
  const neckRings = [
    [1.06, 0.088, 0.082], // 목뿌리(TORSO 마지막과 동일 위치 → 공유 위해 그 링 사용)
    [1.14, 0.070, 0.068], // 목 중간
    [1.20, 0.066, 0.064], // 목 상단(턱 아래)
  ];
  // 첫 목 링 = TORSO 마지막 링(목뿌리) 재사용.
  let prev = ringIdx[NECK_TOP_I];
  for (let s = 1; s < neckRings.length; s++) {
    const [y, rx, rz] = neckRings[s];
    const row = [];
    for (let j = 0; j < SEG; j++) {
      const a = (Math.PI * 2 * j) / SEG;
      row.push(addVert(Math.cos(a) * rz, y, Math.sin(a) * rx));
    }
    for (let j = 0; j < SEG; j++) {
      const j2 = (j + 1) % SEG;
      idx.push(prev[j], row[j], prev[j2], prev[j2], row[j], row[j2]);
    }
    prev = row;
  }
  // 두상 — 목 상단에서 달걀형 링 스택.
  const headBase = 1.20, headR = 0.092, headH = 0.24;
  const headRings = [
    [headBase + 0.02, 0.052, 0.056],
    [headBase + headH * 0.35, headR * 0.9, headR * 0.98],
    [headBase + headH * 0.62, headR, headR],
    [headBase + headH * 0.9, headR * 0.72, headR * 0.78],
  ];
  for (let s = 0; s < headRings.length; s++) {
    const [y, rx, rz] = headRings[s];
    const row = [];
    for (let j = 0; j < SEG; j++) {
      const a = (Math.PI * 2 * j) / SEG;
      row.push(addVert(Math.cos(a) * rz, y, Math.sin(a) * rx));
    }
    for (let j = 0; j < SEG; j++) {
      const j2 = (j + 1) % SEG;
      idx.push(prev[j], row[j], prev[j2], prev[j2], row[j], row[j2]);
    }
    prev = row;
  }
  const cTop = addVert(0, 1.20 + 0.24, 0);
  for (let j = 0; j < SEG; j++) idx.push(cTop, prev[j], prev[(j + 1) % SEG]);
}

// ── 팔 (A-pose 30° 벌림) + 삼각근 전이 + armhole 스티치. ──
const APOSE_DEG = 30;
function buildArm(sign, arc) {
  // armhole 경계 고리(M 정점) — 팔 첫 링으로 재사용.
  const boundary = [];
  for (const j of arc) boundary.push(ringIdx[ARM_RING_LO][j]);
  for (let k = arc.length - 1; k >= 0; k--) boundary.push(ringIdx[ARM_RING_HI][arc[k]]);
  const M = boundary.length;
  for (const vi of boundary) dbgBoundary.push(vi);

  // 경계 중심.
  const bc = [0, 0, 0];
  for (const vi of boundary) { bc[0] += pos[vi * 3]; bc[1] += pos[vi * 3 + 1]; bc[2] += pos[vi * 3 + 2]; }
  bc[0] /= M; bc[1] /= M; bc[2] /= M;

  // A-pose 축: 어깨에서 아래(-y)·바깥(±z) 30°. 방향 = (0, -cos, ±sin).
  const a = (APOSE_DEG * Math.PI) / 180;
  const axis = new THREE.Vector3(0, -Math.cos(a), sign * Math.sin(a)).normalize();
  // 축 수직 basis (링 평면).
  const up = Math.abs(axis.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const bx = new THREE.Vector3().crossVectors(axis, up).normalize(); // 링 x
  const bz = new THREE.Vector3().crossVectors(bx, axis).normalize(); // 링 z
  const start = new THREE.Vector3(bc[0], bc[1], bc[2]);

  // 팔 섹션: 축 거리 t, 반경 r. 삼각근(볼록)→상완→팔꿈치→전완→손목.
  // 삼각근은 어깨를 덮는 큰 볼륨(armhole 바로 밑 최대), 이후 상완으로 테이퍼.
  const secs = [
    { t: 0.00, r: 0.085 },  // armhole 경계 높이(첫 링 = boundary, r 참고용)
    { t: 0.06, r: 0.088 },  // 삼각근 최대(어깨 덮음, 볼록)
    { t: 0.16, r: 0.072 },  // 삼각근 하
    { t: 0.30, r: 0.058 },  // 상완 상(이두)
    { t: 0.46, r: 0.050 },  // 상완 중
    { t: 0.60, r: 0.046 },  // 팔꿈치
    { t: 0.80, r: 0.040 },  // 전완
    { t: 0.98, r: 0.034 },  // 손목
  ];
  // 링 스택: 링0=boundary(재사용), 이후 축을 따라 이동하며 축수직 원.
  const armRing = [boundary];
  for (let s = 1; s < secs.length; s++) {
    const { t, r } = secs[s];
    const center = start.clone().addScaledVector(axis, t);
    const row = [];
    for (let m = 0; m < M; m++) {
      // 경계 정점 m 의 방위각(경계 평면 기준)을 팔 링 방위각으로.
      const bxp = pos[boundary[m] * 3] - bc[0], byp = pos[boundary[m] * 3 + 1] - bc[1], bzp = pos[boundary[m] * 3 + 2] - bc[2];
      const ang = Math.atan2(
        bxp * bz.x + byp * bz.y + bzp * bz.z,  // bz 성분
        bxp * bx.x + byp * bx.y + bzp * bx.z,  // bx 성분
      );
      const p = center.clone().addScaledVector(bx, Math.cos(ang) * r).addScaledVector(bz, Math.sin(ang) * r);
      row.push(addVert(p.x, p.y, p.z));
    }
    armRing.push(row);
  }
  // 팔 옆면 사각형 (M 1:1) — 첫 밴드(boundary→삼각근)는 topology debug 로 표시.
  for (let s = 0; s < armRing.length - 1; s++) {
    for (let m = 0; m < M; m++) {
      const m2 = (m + 1) % M;
      const A = armRing[s][m], B = armRing[s][m2], C = armRing[s + 1][m], D = armRing[s + 1][m2];
      idx.push(A, C, B, B, C, D);
      if (s === 0) { dbgStitchTris.push(A, C, B, B, C, D); }
    }
  }
  // 손목 캡.
  const lastRow = armRing[armRing.length - 1];
  const cEnd = addVert(...start.clone().addScaledVector(axis, secs[secs.length - 1].t).toArray());
  for (let m = 0; m < M; m++) idx.push(cEnd, lastRow[m], lastRow[(m + 1) % M]);
}
buildArm(+1, arcL);
buildArm(-1, arcR);

// ── 메시 ────────────────────────────────────────────────────────────────
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push(0, 0);
geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
geo.setIndex(idx);
geo.computeVertexNormals();
const root = new THREE.Group();
const skin = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }));
skin.name = "mannequin";
root.add(skin);

// topology debug 데이터를 GLB 에 함께 넣진 않고, 뷰어에 JSON 으로 전달.
const dbg = {
  boundary: [...new Set(dbgBoundary)].map((vi) => [pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]]),
  stitchTris: dbgStitchTris.map((vi) => [pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]]),
};

const exporter = new GLTFExporter();
const data = await exporter.parseAsync(root, { binary: true });
const outDir = path.join(__dirname, ".out", "proto-shoulder");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "proto-shoulder.glb"), Buffer.from(data));
fs.writeFileSync(path.join(outDir, "proto-debug.json"), JSON.stringify(dbg));
console.log(`[proto] verts=${pos.length / 3}, tris=${idx.length / 3}, boundary=${dbg.boundary.length}, stitchTris=${dbg.stitchTris.length / 3}`);

// ── 뷰어(회색 셰이드 / wireframe / topology) ─────────────────────────────
const VIEWER = `<!doctype html><meta charset=utf-8><style>
html,body{margin:0;background:#20232a}
#grid{display:grid;gap:2px}
.cell{position:relative}.label{position:absolute;top:4px;left:6px;font:600 12px system-ui;color:#cbd5e1;background:rgba(0,0,0,.5);padding:2px 6px;border-radius:3px}canvas{display:block}
</style><div id=grid></div>
<script type=importmap>{"imports":{"three":"/node_modules/three/build/three.module.js","three/examples/jsm/loaders/GLTFLoader.js":"/node_modules/three/examples/jsm/loaders/GLTFLoader.js"}}</script>
<script type=module>
import * as THREE from "three"; import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
const params=new URLSearchParams(location.search); const mode=params.get("mode")||"body";
const SETS={
  body:[["FRONT",[1,0.12,0]],["BACK",[-1,0.12,0]],["LEFT",[0,0.08,1]],["Q34",[1,0.35,0.9]]],
  shoulder:[["SH-FRONT",[1,0.28,0]],["SH-BACK",[-1,0.28,0]],["SH-Q34",[1,0.5,0.8]]],
  wire:[["WIRE-FRONT",[1,0.12,0]],["WIRE-Q34",[1,0.35,0.9]]],
  topo:[["TOPO-FRONT",[1,0.28,0.2]],["TOPO-Q34",[1,0.45,0.85]]],
};
const views=SETS[mode]; const cols=mode==="body"?2:mode==="shoulder"?3:2;
const CELL=360; const grid=document.getElementById("grid"); grid.style.gridTemplateColumns="repeat("+cols+","+CELL+"px)";
const isShoulder=mode==="shoulder"||mode==="topo";
const dbg=await fetch("/scripts/rider-preview/.out/proto-shoulder/proto-debug.json").then(r=>r.json());
new GLTFLoader().load("/scripts/rider-preview/.out/proto-shoulder/proto-shoulder.glb",(g)=>{
  const m=g.scene; const fullBox=new THREE.Box3().setFromObject(m);
  let box=fullBox;
  if(isShoulder){ const h=fullBox.max.y-fullBox.min.y; box=fullBox.clone(); box.min.y=fullBox.max.y-h*0.42; }
  const ctr=box.getCenter(new THREE.Vector3()); const rad=box.getSize(new THREE.Vector3()).length()/2;
  for(const [name,dir] of views){
    const cell=document.createElement("div"); cell.className="cell"; const lb=document.createElement("div"); lb.className="label"; lb.textContent=name; cell.appendChild(lb); grid.appendChild(cell);
    const r=new THREE.WebGLRenderer({antialias:true}); r.setSize(CELL,CELL); r.setClearColor(mode==="topo"?0x14161b:0x20232a,1); cell.appendChild(r.domElement);
    const sc=new THREE.Scene(); const mm=m.clone(true);
    if(mode==="wire"){ mm.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:0x8fd6ff,wireframe:true});}}); sc.add(mm); }
    else if(mode==="topo"){
      // 회색 반투명 바디 + 스티치 삼각형(주황) + 경계 정점(빨강 점)
      mm.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshStandardMaterial({color:0x2a2d35,roughness:0.9,transparent:true,opacity:0.55,side:THREE.DoubleSide});}}); sc.add(mm);
      // 스티치 삼각형
      const sp=[]; for(const p of dbg.stitchTris) sp.push(p[0],p[1],p[2]);
      const sg=new THREE.BufferGeometry(); sg.setAttribute("position",new THREE.Float32BufferAttribute(sp,3)); sg.computeVertexNormals();
      sc.add(new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:0xff8c2a,side:THREE.DoubleSide})));
      // 경계 정점(빨강 점)
      const bp=[]; for(const p of dbg.boundary) bp.push(p[0],p[1],p[2]);
      const bg=new THREE.BufferGeometry(); bg.setAttribute("position",new THREE.Float32BufferAttribute(bp,3));
      sc.add(new THREE.Points(bg,new THREE.PointsMaterial({color:0xff3355,size:8,sizeAttenuation:false})));
      sc.add(new THREE.HemisphereLight(0xffffff,0x404050,1.0));
    } else {
      sc.add(mm); sc.add(new THREE.HemisphereLight(0xffffff,0x404050,1.0));
      const k=new THREE.DirectionalLight(0xffffff,1.5); k.position.set(3,5,2); sc.add(k);
      const f=new THREE.DirectionalLight(0xcfe0ff,0.6); f.position.set(-3,1,-3); sc.add(f);
    }
    const cam=new THREE.PerspectiveCamera(35,1,0.01,100); const d=new THREE.Vector3(...dir).normalize();
    const fr=isShoulder?0.95:1.02;
    cam.position.copy(ctr).add(d.multiplyScalar(rad/Math.sin(35*Math.PI/180/2)*fr)); cam.lookAt(ctr);
    r.render(sc,cam);
  }
  document.title="READY"; window.__READY__=true;
});
</script>`;
const tmp = path.join(webRoot, "public", "__proto_shoulder.html");
fs.writeFileSync(tmp, VIEWER);
const server = await createServer({ root: webRoot, server: { port: 0 }, logLevel: "error" });
await server.listen();
const port = server.config.server.port || server.httpServer.address().port;
const browser = await chromium.launch();
async function shoot(mode, file, w) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${port}/__proto_shoulder.html?mode=${mode}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__READY__ === true, { timeout: 15000 });
  await page.waitForTimeout(200);
  await page.locator("#grid").screenshot({ path: path.join(outDir, file) });
  await page.close();
  console.log(`[proto] ${mode} → ${file}`);
}
await shoot("body", "body-4view.png", 740);
await shoot("shoulder", "shoulder-3view.png", 1090);
await shoot("wire", "wireframe.png", 740);
await shoot("topo", "topology.png", 740);
await browser.close(); await server.close();
try { fs.unlinkSync(tmp); } catch {}
console.log("[proto] done.");

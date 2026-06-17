/**
 * 저폴리 자전거+라이더 GLB 프로토타입 생성.
 * 좌표: +X 진행(동), +Y 위, +Z 좌우(바퀴 축). 지면 y=0.
 * 실행: npm run gen:rider-glb (apps/web)
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.window = globalThis;
globalThis.FileReader = class FileReaderPoly {
  result = null;
  onload = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    const finish = (buf) => {
      this.result = buf;
      this.onloadend?.({ target: this });
      this.onload?.({ target: this });
    };
    try {
      if (blob instanceof ArrayBuffer) {
        queueMicrotask(() => finish(buf));
        return;
      }
      if (ArrayBuffer.isView(blob)) {
        queueMicrotask(() => finish(blob.buffer));
        return;
      }
      if (typeof blob?.arrayBuffer === "function") {
        void blob.arrayBuffer().then(finish);
        return;
      }
      this.onerror?.(new Error("unsupported blob"));
    } catch (e) {
      this.onerror?.(e);
    }
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "rider", "prototype");
const outFile = path.join(outDir, "rider-lowpoly.glb");

const COL = {
  tire: 0x1e293b,
  rim: 0x64748b,
  frame: 0x334155,
  frameDark: 0x1e293b,
  bar: 0x0f172a,
  jersey: 0x1d4ed8,
  jerseyDark: 0x1e40af,
  skin: 0xfde68a,
  helmet: 0x1e3a8a,
  short: 0x1e3a8a,
  shadow: 0x000000,
};

const WHEEL_R = 0.26;
const REAR_X = -0.5;
const FRONT_X = 0.52;
const HUB_Y = WHEEL_R;

function mat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
  });
}

/** Y축 실린더를 from→to 방향으로 배치 */
function tube(from, to, radius, color) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-4) return new THREE.Group();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 8);
  geo.translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** 바퀴 — XY 평면 원(축 Z), 허브 y=바닥+반경 */
function wheel(hubX) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R, WHEEL_R * 0.11, 10, 22),
    mat(COL.tire),
  );
  tire.position.set(hubX, HUB_Y, 0);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R * 0.62, WHEEL_R * 0.04, 8, 18),
    mat(COL.rim),
  );
  rim.position.set(hubX, HUB_Y, 0);
  g.add(tire, rim);
  return g;
}

function box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

const root = new THREE.Group();
root.name = "RiderBike";

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.62, 28),
  mat(COL.shadow, 0.26),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0, 0.015, 0);
root.add(shadow);

root.add(wheel(REAR_X));
root.add(wheel(FRONT_X));

const rear = [REAR_X, HUB_Y, 0];
const front = [FRONT_X, HUB_Y, 0];
const bb = [-0.04, 0.4, 0];
const seat = [-0.14, 0.74, 0];
const headTube = [0.36, 0.66, 0];
const barCenter = [0.4, 0.84, 0];

root.add(tube(rear, bb, 0.025, COL.frame));
root.add(tube(rear, seat, 0.022, COL.frame));
root.add(tube(bb, headTube, 0.028, COL.frame));
root.add(tube(seat, headTube, 0.024, COL.frameDark));
root.add(tube(front, headTube, 0.022, COL.frameDark));
root.add(tube(seat, bb, 0.02, COL.frame));

root.add(box(0.14, 0.04, 0.08, COL.frameDark, seat[0], seat[1] + 0.02, 0));
root.add(tube([barCenter[0] - 0.12, barCenter[1], 0], [barCenter[0] + 0.12, barCenter[1], 0], 0.018, COL.bar));
root.add(tube([barCenter[0], barCenter[1], -0.1], [barCenter[0], barCenter[1], 0.1], 0.016, COL.bar));
root.add(tube(headTube, barCenter, 0.018, COL.frameDark));

const pelvis = [-0.12, 0.8, 0];
const shoulder = [0.02, 1.02, 0];
const headC = [0.1, 1.2, 0];

/** Mapbox nodeOverride — Z축 회전(페달) */
function crankAssembly() {
  const crank = new THREE.Group();
  crank.name = "crank";
  crank.position.set(bb[0], bb[1], bb[2]);
  const armLen = 0.14;
  crank.add(tube([0, 0, 0], [0, armLen, 0], 0.012, COL.frameDark));
  crank.add(tube([0, 0, 0], [0, -armLen, 0], 0.012, COL.frameDark));
  crank.add(box(0.07, 0.02, 0.05, COL.rim, 0, armLen, 0));
  crank.add(box(0.07, 0.02, 0.05, COL.rim, 0, -armLen, 0));
  return crank;
}
root.add(crankAssembly());

/** 허벅지·정강이 — hip/knee pivot, Mapbox nodeOverride (길이 ≈ IK 상수와 동기) */
function legAssembly(side) {
  const sign = side === "l" ? 1 : -1;
  const hipZ = 0.068 * sign;
  const leg = new THREE.Group();
  leg.name = `leg_${side}`;
  leg.position.set(pelvis[0], pelvis[1] - 0.06, hipZ);

  const knee = [0.03, -0.17, -0.02 * sign];
  leg.add(tube([0, 0, 0], knee, 0.046, COL.short));

  const shin = new THREE.Group();
  shin.name = `leg_${side}_shin`;
  shin.position.set(knee[0], knee[1], knee[2]);
  const foot = [0.035, -0.15, 0.01 * sign];
  shin.add(tube([0, 0, 0], foot, 0.04, COL.short));
  shin.add(box(0.055, 0.028, 0.045, COL.skin, foot[0], foot[1], foot[2]));
  leg.add(shin);
  return leg;
}

root.add(tube(pelvis, shoulder, 0.09, COL.jersey));
root.add(legAssembly("l"));
root.add(legAssembly("r"));

root.add(tube(shoulder, [barCenter[0] - 0.04, barCenter[1] - 0.02, 0.06], 0.035, COL.jersey));
root.add(tube(shoulder, [barCenter[0] - 0.04, barCenter[1] - 0.02, -0.06], 0.035, COL.jerseyDark));

const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat(COL.skin));
head.position.set(headC[0], headC[1], headC[2]);
root.add(head);

const helmet = new THREE.Mesh(
  new THREE.SphereGeometry(0.115, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
  mat(COL.helmet),
);
helmet.position.set(headC[0], headC[1] + 0.02, headC[2]);
helmet.rotation.x = -0.2;
root.add(helmet);

root.add(tube(shoulder, headC, 0.045, COL.jersey));

const exporter = new GLTFExporter();
const data = await exporter.parseAsync(root, { binary: true });
if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
  throw new Error("GLTFExporter returned unexpected data");
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, Buffer.from(data));
console.info(`[gen:rider-glb] wrote ${outFile} (${fs.statSync(outFile).size} bytes)`);

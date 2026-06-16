/**
 * 저폴리 자전거+라이더 GLB 프로토타입 생성.
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
        queueMicrotask(() => finish(blob));
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

function box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

function wheel(radius, x, y, z) {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.12, 16);
  geo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1e293b }));
  tire.position.set(x, y, z);
  const rimGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 0.14, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: 0x64748b }));
  rim.position.set(x, y, z);
  const g = new THREE.Group();
  g.add(tire, rim);
  return g;
}

const root = new THREE.Group();
root.name = "RiderBike";

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.02;
root.add(shadow);

root.add(wheel(0.34, -0.55, 0.34, 0));
root.add(wheel(0.34, 0.55, 0.34, 0));
root.add(box(1.05, 0.06, 0.06, 0x475569, 0, 0.42, 0.34, 0, 0, -0.18));
root.add(box(0.55, 0.05, 0.05, 0x334155, -0.22, 0.28, 0.34, 0, 0, 0.55));
root.add(box(0.42, 0.05, 0.05, 0x334155, 0.28, 0.52, 0.34, 0, 0, -0.42));
root.add(box(0.05, 0.32, 0.05, 0x334155, 0.05, 0.38, 0.34));
root.add(box(0.38, 0.05, 0.05, 0x1e293b, 0.42, 0.62, 0.34));
root.add(box(0.05, 0.18, 0.05, 0x1e293b, 0.42, 0.56, 0.34));
root.add(box(0.28, 0.42, 0.18, 0x1d4ed8, -0.02, 0.78, 0.34, 0, 0, 0.22));

const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xfde68a }),
);
head.position.set(0.08, 1.08, 0.34);
root.add(head);

const helmet = new THREE.Mesh(
  new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  new THREE.MeshBasicMaterial({ color: 0x1e3a8a }),
);
helmet.position.set(0.08, 1.1, 0.34);
helmet.rotation.x = -0.25;
root.add(helmet);
root.add(box(0.34, 0.08, 0.12, 0x1e40af, 0.12, 0.72, 0.34, 0, 0, -0.35));
root.add(box(0.1, 0.28, 0.1, 0x1d4ed8, -0.18, 0.72, 0.34, 0, 0, 0.5));

const exporter = new GLTFExporter();
const data = await exporter.parseAsync(root, { binary: true });
if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
  throw new Error("GLTFExporter returned unexpected data");
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, Buffer.from(data));
console.info(`[gen:rider-glb] wrote ${outFile} (${fs.statSync(outFile).size} bytes)`);

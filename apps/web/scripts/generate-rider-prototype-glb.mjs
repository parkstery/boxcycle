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
  helmetShell: 0xf1f5f9,
  helmetVisor: 0x334155,
  helmetStripe: 0xe8a33d,
  short: 0x1e3a8a,
  shadow: 0x000000,
  gold: 0xe8a33d,
  shoe: 0x0f172a,
};

const WHEEL_R = 0.26;
const REAR_X = -0.5;
const FRONT_X = 0.52;
const HUB_Y = WHEEL_R;

function mat(color, opacity = 1, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    transparent: opacity < 1,
    opacity,
  });
}

/** Y축 실린더를 from→to 방향으로 배치 */
function tube(from, to, radius, color, opts = {}) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-4) return new THREE.Group();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 16);
  geo.translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(geo, mat(color, 1, opts));
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** 바퀴 — XY 평면 원(축 Z), 허브 y=바닥+반경 */
function wheel(hubX) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R, WHEEL_R * 0.11, 14, 36),
    mat(COL.tire, 1, { roughness: 1.0 }),
  );
  tire.position.set(hubX, HUB_Y, 0);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R * 0.62, WHEEL_R * 0.04, 12, 30),
    mat(COL.rim, 1, { metalness: 0.5, roughness: 0.35 }),
  );
  rim.position.set(hubX, HUB_Y, 0);
  g.add(tire, rim);

  const rimMat = mat(COL.rim, 1, { metalness: 0.5, roughness: 0.35 });
  const spokeR = WHEEL_R * 0.62;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, spokeR, 6),
      rimMat,
    );
    spoke.position.set(hubX, HUB_Y + (Math.sin(angle) * spokeR) / 2, (Math.cos(angle) * spokeR) / 2);
    spoke.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, Math.sin(angle), Math.cos(angle)).normalize(),
    );
    g.add(spoke);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12),
    mat(COL.frameDark, 1, { metalness: 0.5, roughness: 0.35 }),
  );
  hub.position.set(hubX, HUB_Y, 0);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);

  const disc = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 6, 16), rimMat);
  disc.position.set(hubX, HUB_Y, 0.03);
  g.add(disc);

  return g;
}

function box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 1, opts));
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

const frameOpts = { metalness: 0.5, roughness: 0.35 };
root.add(tube(rear, bb, 0.025, COL.frame, frameOpts));
root.add(tube(rear, seat, 0.022, COL.frame, frameOpts));
root.add(tube(bb, headTube, 0.028, COL.frame, frameOpts));
root.add(tube(seat, headTube, 0.024, COL.frameDark, frameOpts));
root.add(tube(front, headTube, 0.022, COL.frameDark, frameOpts));
root.add(tube(seat, bb, 0.02, COL.frame, frameOpts));

/** 물통 — 다운튜브(bb→headTube) 중간점 부근, 튜브에 대략 수직으로 세워 배치 */
const downTubeMid = [(bb[0] + headTube[0]) / 2, (bb[1] + headTube[1]) / 2 + 0.05, 0];
const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 10), mat(COL.gold));
bottle.position.set(downTubeMid[0], downTubeMid[1], downTubeMid[2]);
bottle.rotation.z = -0.55;
root.add(bottle);

const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mat(COL.frameDark, 1, frameOpts));
saddle.scale.set(1.9, 0.45, 1.0);
saddle.position.set(seat[0], seat[1] + 0.02, 0);
root.add(saddle);
root.add(tube([barCenter[0] - 0.12, barCenter[1], 0], [barCenter[0] + 0.12, barCenter[1], 0], 0.018, COL.bar, frameOpts));
root.add(tube([barCenter[0], barCenter[1], -0.1], [barCenter[0], barCenter[1], 0.1], 0.016, COL.bar, frameOpts));
root.add(tube(headTube, barCenter, 0.018, COL.frameDark, frameOpts));

/** ⚠️ pelvis 는 riderGlbPedalPose.ts PELVIS 와 동기 — 다리 IK 기준이므로 변경 금지 */
const pelvis = [-0.12, 0.8, 0];
/** 에어로 자세 — 상체 전경사(수평 대비 ~32°). 직립(0.02,1.02)은 산책 자세로 보였음. */
const shoulder = [0.14, 0.96, 0];
/** 머리를 낮추고 앞으로 — 전방 주시. */
const headC = [0.28, 1.07, 0];

/** Mapbox nodeOverride — Z축 회전(페달) */
function crankAssembly() {
  const crank = new THREE.Group();
  crank.name = "crank";
  crank.position.set(bb[0], bb[1], bb[2]);
  const armLen = 0.14;
  crank.add(tube([0, 0, 0], [0, armLen, 0], 0.012, COL.frameDark, frameOpts));
  crank.add(tube([0, 0, 0], [0, -armLen, 0], 0.012, COL.frameDark, frameOpts));
  crank.add(box(0.07, 0.02, 0.05, COL.rim, 0, armLen, 0, 0, 0, 0, frameOpts));
  crank.add(box(0.07, 0.02, 0.05, COL.rim, 0, -armLen, 0, 0, 0, 0, frameOpts));
  return crank;
}
root.add(crankAssembly());

/** 허벅지·정강이 — hip/knee pivot (riderGlbPedalPose.ts 상수와 동기) */
function legAssembly(side) {
  const sign = side === "l" ? 1 : -1;
  const hipZ = 0.068 * sign;
  const leg = new THREE.Group();
  leg.name = `leg_${side}`;
  leg.position.set(pelvis[0] + 0.02, pelvis[1] - 0.08, hipZ);

  const knee = [0.04, -0.208, -0.022 * sign];
  leg.add(tube([0, 0, 0], knee, 0.05, COL.short));

  const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 12), mat(COL.short));
  kneeJoint.position.set(knee[0], knee[1], knee[2]);
  leg.add(kneeJoint);

  const shin = new THREE.Group();
  shin.name = `leg_${side}_shin`;
  shin.position.set(knee[0], knee[1], knee[2]);
  const ankle = [0.065, -0.22, 0.012 * sign];
  shin.add(tube([0, 0, 0], ankle, 0.038, COL.short));
  shin.add(box(0.095, 0.032, 0.05, COL.shoe, ankle[0] + 0.015, ankle[1] - 0.014, ankle[2]));
  shin.add(box(0.095, 0.008, 0.05, 0xf1f5f9, ankle[0] + 0.015, ankle[1] - 0.014 - 0.02, ankle[2]));
  leg.add(shin);
  return leg;
}

/** 저지(천) — 프레임 금속과 달리 부드러운 광 */
const jerseyOpts = { roughness: 0.7 };

/**
 * torso — 상체 전체(몸통·팔·머리·헬멧)를 하나의 이름 있는 노드로 묶어
 * Mapbox nodeOverride 로 페달링 스웨이(로컬 X축 롤)를 건다. pivot = pelvis.
 * 다리(leg_*)·crank·hipCover 는 밖(정적 기준) — riderGlbPedalPose.ts 와 동기.
 */
const torso = new THREE.Group();
torso.name = "torso";
torso.position.set(pelvis[0], pelvis[1], pelvis[2]);
/** 절대좌표 → torso 로컬(pelvis 기준) */
const rel = (p) => [p[0] - pelvis[0], p[1] - pelvis[1], p[2] - pelvis[2]];

torso.add(tube([0, 0, 0], rel([0.06, 0.92, 0]), 0.082, COL.jersey, jerseyOpts));
const chestVolume = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16), mat(COL.jersey, 1, jerseyOpts));
chestVolume.position.set(...rel(shoulder));
chestVolume.scale.set(1.15, 0.9, 1.5);
torso.add(chestVolume);
/** 등 골드 스트라이프 — 몸통 전경사(rz≈-0.55)에 맞춰 등면을 따라 배치 */
torso.add(box(0.02, 0.22, 0.035, COL.gold, 0.12, 0.12, 0, 0, 0, -0.55));
/**
 * 골반 덮개(빕숏) — 상체를 앞으로 눕히면 몸통 튜브 하단이 힙에서 들려
 * 다리가 몸에서 분리돼 보인다(07-07 1차 시도 롤백 원인). 양쪽 고관절(z±0.068)을
 * 덮는 타원구로 상체·허벅지를 시각적으로 잇는다. 다리 IK 는 무관(정적 메시).
 */
const hipCover = new THREE.Mesh(new THREE.SphereGeometry(0.088, 18, 14), mat(COL.short));
hipCover.position.set(pelvis[0], pelvis[1] - 0.045, 0);
hipCover.scale.set(1.0, 0.85, 1.25);
root.add(hipCover);
root.add(legAssembly("l"));
root.add(legAssembly("r"));

/** 팔 — 어깨→팔꿈치(상완, jersey색) → 손(전완, 맨살) 양쪽 */
function armAssembly(side) {
  const sign = side === "l" ? 1 : -1;
  const upperColor = side === "l" ? COL.jersey : COL.jerseyDark;
  const shoulderPt = [shoulder[0], shoulder[1], 0.1 * sign];
  const elbow = [0.29, 0.86, 0.09 * sign];
  const handPt = [barCenter[0] - 0.04, barCenter[1] - 0.02, 0.07 * sign];

  const g = new THREE.Group();
  g.add(tube(shoulderPt, elbow, 0.034, upperColor, jerseyOpts));
  g.add(tube(elbow, handPt, 0.028, COL.skin));

  const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 12), mat(upperColor, 1, jerseyOpts));
  elbowJoint.position.set(elbow[0], elbow[1], elbow[2]);
  g.add(elbowJoint);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), mat(COL.skin));
  hand.position.set(handPt[0], handPt[1], handPt[2]);
  g.add(hand);

  /** 자식들은 절대좌표 — torso(pivot=pelvis) 로컬로 상대화 */
  g.position.set(-pelvis[0], -pelvis[1], -pelvis[2]);
  return g;
}
torso.add(armAssembly("l"));
torso.add(armAssembly("r"));

const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), mat(COL.skin));
head.position.set(...rel(headC));
torso.add(head);

/** 로드 헬멧 — 쉘·바이저·스트라이프 */
function helmetAssembly() {
  const g = new THREE.Group();
  g.name = "helmet";
  const hx = headC[0];
  const hy = headC[1];
  const hz = headC[2];

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.122, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mat(COL.helmetShell, 1, { roughness: 0.4 }),
  );
  shell.scale.set(1.08, 0.92, 1.12);
  shell.position.set(hx, hy + 0.04, hz);
  shell.rotation.x = -0.12;
  g.add(shell);

  const visor = box(0.14, 0.025, 0.07, COL.helmetVisor, hx + 0.09, hy + 0.08, hz, -0.42);
  g.add(visor);

  /** 벤트 3개 — 쉘 상면, 진행방향(X) 등간격, 전경사에 맞춰 표면 근처에 파묻히게 */
  for (const dx of [-0.05, 0, 0.05]) {
    g.add(box(0.02, 0.012, 0.1, COL.helmetVisor, hx + dx, hy + 0.135, hz, -0.12));
  }

  g.add(box(0.16, 0.018, 0.09, COL.helmetStripe, hx - 0.01, hy + 0.1, hz, -0.08));

  const rear = box(0.08, 0.04, 0.06, COL.helmetShell, hx - 0.1, hy + 0.06, hz, 0.15);
  g.add(rear);

  /** 자식들은 절대좌표 — torso(pivot=pelvis) 로컬로 상대화 */
  g.position.set(-pelvis[0], -pelvis[1], -pelvis[2]);
  return g;
}
torso.add(helmetAssembly());

torso.add(tube(rel(shoulder), rel(headC), 0.045, COL.jersey, jerseyOpts));
root.add(torso);

const exporter = new GLTFExporter();
const data = await exporter.parseAsync(root, { binary: true });
if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
  throw new Error("GLTFExporter returned unexpected data");
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, Buffer.from(data));
console.info(`[gen:rider-glb] wrote ${outFile} (${fs.statSync(outFile).size} bytes)`);

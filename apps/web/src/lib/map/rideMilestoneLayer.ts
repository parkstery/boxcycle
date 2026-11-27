import mapboxgl, { type CustomLayerInterface, type Map as MapboxMap } from "mapbox-gl";
import {
  AnimationMixer, BoxGeometry, Camera, CanvasTexture, Color, DoubleSide, Group, HemisphereLight,
  LoopOnce, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Scene,
  SkinnedMesh, SRGBColorSpace, Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { offsetLngLatByBearingMeters } from "../geo/geo";
import type { RideMilestone } from "../route/rideMilestones";
import { preservedRiderAssetUrl, resolvePreservedRiderModel } from "../riderPrototype/config";
import { disposeRiderObject } from "../riderPrototype/preservedRiderRig";
import { resolveBeforeIdByRank } from "./layerOrder";

const LAYER_ID = "boxcycle-ride-milestones";
const PULSE_MS = 1150;
const DEG_TO_RAD = Math.PI / 180;
const ROAD_GREEN = 0xc7f780;
const FINISH_GOLD = 0xffce63;
const DARK = 0x172627;
const HALF_FLASH = new Color(0xf6ffdf);

export type RideMilestonePresentation = {
  next?: { gate: RideMilestone; remainingM: number };
  crossing?: { gate: RideMilestone; startedAt: number };
  arrival?: { gate: RideMilestone; startedAt: number };
};

function addBox(group: Group, material: MeshBasicMaterial, size: [number, number, number], pos: [number, number, number]) {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.position.set(...pos);
  group.add(mesh);
}

function paintTexture(width: number, height: number, paint: (pen: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const pen = canvas.getContext("2d");
  if (pen) paint(pen);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function addRoadPaint(surface: Group, material: MeshBasicMaterial, width: number, length: number, forward: number, across: number) {
  const mesh = new Mesh(new PlaneGeometry(width, length), material);
  mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  mesh.position.set(forward, 0.16, across);
  surface.add(mesh);
}

function addSignFace(group: Group, texture: CanvasTexture, width: number, height: number, pos: [number, number, number]) {
  const face = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: texture }));
  face.position.set(...pos);
  face.rotation.y = -Math.PI / 2;
  group.add(face);
}

function buildRoadMilestone(label: Exclude<RideMilestone["label"], "FINISH">) {
  const half = label === "HALF";
  const group = new Group();
  const surface = new Group();
  group.add(surface);
  const band = new MeshBasicMaterial({ map: paintTexture(128, 32, (pen) => {
    pen.fillStyle = "#172627";
    pen.fillRect(0, 0, 128, 32);
    pen.fillStyle = "#c7f780";
    pen.fillRect(4, 4, 120, 24);
  }) });
  const pulseMaterial = new MeshBasicMaterial({ color: ROAD_GREEN, transparent: true, depthWrite: false });
  const pulse = new Group();
  pulse.position.y = 0.05;
  pulse.visible = false;
  surface.add(pulse);
  for (const side of [-1, 1]) {
    const across = side * 1.4;
    addRoadPaint(surface, band, 1.9, half ? 0.98 : 0.70, 0, across);
    addRoadPaint(pulse, pulseMaterial, 1.9, half ? 1.25 : 0.75, 0, across);
  }
  let signTrim: MeshBasicMaterial | undefined;
  if (half) {
    const across = 3.45;
    const dark = new MeshBasicMaterial({ color: DARK });
    signTrim = new MeshBasicMaterial({ color: ROAD_GREEN });
    addBox(group, dark, [0.14, 1.05, 0.16], [0, 0.525, across]);
    addBox(group, signTrim, [0.16, 0.57, 1.55], [0, 1.06, across]);
    const texture = paintTexture(256, 86, (pen) => {
      pen.fillStyle = "#172627";
      pen.fillRect(0, 0, 256, 86);
      pen.fillStyle = "#f1ffde";
      pen.font = "800 58px system-ui";
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillText("HALF", 128, 43);
    });
    addSignFace(group, texture, 1.36, 0.45, [-0.085, 1.06, across]);
  } else {
    const texture = paintTexture(128, 160, (pen) => {
      pen.fillStyle = "#172627";
      pen.fillRect(0, 0, 128, 160);
      pen.fillStyle = "#efffd8";
      pen.font = "800 108px system-ui";
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillText(label, 64, 82);
    });
    addRoadPaint(surface, new MeshBasicMaterial({ map: texture }), 1.65, 2.2, -1.65, 1.4);
  }
  return { group, surface, pulse, pulseMaterial, signTrim };
}

function buildFinishGate() {
  const group = new Group();
  const surface = new Group();
  group.add(surface);
  const dark = new MeshBasicMaterial({ color: DARK });
  const accent = new MeshBasicMaterial({ color: FINISH_GOLD });
  const halfWidth = 3.9;
  const height = 4.1;
  for (const side of [-1, 1]) {
    const across = side * halfWidth;
    addBox(group, dark, [0.8, 0.15, 0.8], [0, 0.08, across]);
    addBox(group, dark, [0.48, height, 0.53], [0, height / 2, across]);
    addBox(group, accent, [0.06, height - 0.28, 0.12], [-0.26, height / 2, across]);
    addBox(group, accent, [0.58, 0.2, 0.63], [0, height - 0.1, across]);
  }
  addBox(group, dark, [0.63, 0.86, 8.5], [0, height + 0.22, 0]);
  addBox(group, accent, [0.66, 0.10, 8.5], [0, height + 0.69, 0]);
  const header = paintTexture(512, 96, (pen) => {
    pen.fillStyle = "#172627";
    pen.fillRect(0, 0, 512, 96);
    pen.fillStyle = "#ffedba";
    for (const start of [13, 440]) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if ((row + col) % 2 === 0) pen.fillRect(start + col * 19, 19 + row * 19, 19, 19);
        }
      }
    }
    pen.font = "800 60px system-ui";
    pen.textAlign = "center";
    pen.fillText("FINISH", 256, 69);
  });
  addSignFace(group, header, 7.4, 0.79, [-0.33, height + 0.22, 0]);
  const checker = paintTexture(512, 64, (pen) => {
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 16; col++) {
        pen.fillStyle = (row + col) % 2 === 0 ? "#fff9e9" : "#172627";
        pen.fillRect(col * 32, row * 32, 32, 32);
      }
    }
  });
  addRoadPaint(surface, new MeshBasicMaterial({ map: checker }), 7.8, 0.975, 0, 0);
  const pulse = new Mesh(
    new RingGeometry(0.88, 1, 36),
    new MeshBasicMaterial({ color: FINISH_GOLD, transparent: true, depthWrite: false, side: DoubleSide }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.24;
  pulse.visible = false;
  surface.add(pulse);
  return { group, surface, pulse };
}

/** The map owns the GL context. This layer owns only its renderer and meshes. */
export class RideMilestoneLayer implements CustomLayerInterface {
  readonly id = LAYER_ID;
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;
  private scene = new Scene();
  private camera = new Camera();
  private matrix = new Matrix4();
  private axis = new Matrix4().makeRotationX(Math.PI / 2);
  private yaw = new Matrix4();
  private scale = new Vector3();
  private marker: mapboxgl.Marker | null = null;
  private markerElement: HTMLDivElement | null = null;
  private markerGate: RideMilestone | null = null;
  private checkpoints = {
    "¼": buildRoadMilestone("¼"),
    HALF: buildRoadMilestone("HALF"),
    "¾": buildRoadMilestone("¾"),
  };
  private finish = buildFinishGate();
  private renderer: WebGLRenderer | null = null;
  private frame: RideMilestonePresentation = {};
  private reducedMotion = false;
  private riderLoadStarted = false;
  private disposed = false;
  private rider: { group: Group; mixer: AnimationMixer; duration: number } | null = null;
  private framedArrival: number | null = null;
  private map: MapboxMap;

  constructor(map: MapboxMap) {
    this.map = map;
    for (const { group } of [...Object.values(this.checkpoints), this.finish]) {
      group.visible = false;
      this.scene.add(group);
    }
    this.scene.add(new HemisphereLight(0xfff7e8, 0x7a746a, 2.6));
    map.on("style.load", this.attach);
    map.on("idle", this.attach);
    map.on("zoomend", this.syncApproach);
  }

  onAdd(_map: MapboxMap, gl: WebGL2RenderingContext) {
    try {
      this.renderer = new WebGLRenderer({ canvas: this.map.getCanvas(), context: gl });
      this.renderer.autoClear = false;
    } catch {
      // Keep the distance marker available if the renderer cannot use the map context.
    }
    this.syncApproach();
  }

  onRemove() {
    this.renderer?.dispose();
    this.renderer = null;
    this.syncApproach();
  }

  private attach = () => {
    if (this.disposed || !this.map.style || this.map.getLayer(this.id)) return;
    if (!this.frame.next && !this.frame.crossing && !this.frame.arrival) return;
    try {
      if (this.map.getStyle().layers?.length) this.map.addLayer(this, resolveBeforeIdByRank(this.map, this.id));
    } catch {
      // A style replacement can temporarily reject addLayer. Retry on style.load/idle.
    }
  };

  update(frame: RideMilestonePresentation, reducedMotion: boolean) {
    if (!frame.next && !frame.crossing && !frame.arrival &&
        !this.frame.next && !this.frame.crossing && !this.frame.arrival) return;
    this.frame = frame;
    this.reducedMotion = reducedMotion;
    if (!reducedMotion && (frame.next?.gate.label === "FINISH" || frame.arrival)) this.loadRider();
    this.updateMarker();
    this.attach();
    this.syncApproach();
    if (frame.arrival && this.framedArrival !== frame.arrival.startedAt) {
      this.framedArrival = frame.arrival.startedAt;
      this.frameArrival(frame.arrival.gate);
    }
    this.map.triggerRepaint();
  }

  private syncApproach = () => {
    const container = this.map.getContainer?.();
    if (!container) return;
    const current = this.renderer && this.map.getZoom() >= 6 && (this.frame.arrival ?? this.frame.next)?.gate.label;
    if (current) container.dataset.rideMilestone = current;
    else delete container.dataset.rideMilestone;
  };

  private updateMarker() {
    const gate = this.frame.arrival?.gate ?? this.frame.next?.gate;
    if (gate?.label !== "FINISH") {
      this.marker?.remove();
      this.marker = null;
      this.markerElement = null;
      this.markerGate = null;
      return;
    }
    if (!this.marker || !this.markerElement) {
      this.markerElement = document.createElement("div");
      this.markerElement.className = "ride-milestone-label";
      this.marker = new mapboxgl.Marker({
        element: this.markerElement, anchor: "bottom", occludedOpacity: 0,
      }).setLngLat(gate.position).addTo(this.map);
    }
    if (this.markerGate !== gate) {
      this.markerGate = gate;
      this.marker.setLngLat(gate.position);
      this.marker.setAltitude?.(5.15);
    }
    const remaining = this.frame.next?.remainingM ?? 0;
    const text = this.frame.arrival ? "완주" : `${gate.label} · ${Math.ceil(remaining)} m`;
    if (this.markerElement.textContent !== text) this.markerElement.textContent = text;
  }

  private frameArrival(gate: RideMilestone) {
    if (!this.renderer) return;
    const behind = offsetLngLatByBearingMeters(gate.position, gate.headingDeg + 180, 11);
    const eye = offsetLngLatByBearingMeters(behind, gate.headingDeg + 90, 5);
    const target = offsetLngLatByBearingMeters(gate.position, gate.headingDeg, 2);
    const ground = Math.max(this.map.queryTerrainElevation(eye) ?? 0, this.map.queryTerrainElevation(target) ?? 0);
    const camera = this.map.getFreeCameraOptions();
    camera.position = mapboxgl.MercatorCoordinate.fromLngLat(eye, ground + 8.5);
    camera.lookAtPoint(target, undefined, (this.map.queryTerrainElevation(target) ?? 0) + 1.7);
    this.map.setFreeCameraOptions(camera);
  }

  private loadRider() {
    if (this.riderLoadStarted) return;
    this.riderLoadStarted = true;
    const url = resolvePreservedRiderModel() === "rider15"
      ? preservedRiderAssetUrl("rider-gestures.glb")
      : `${import.meta.env.BASE_URL}rider/celebration/rider15-gestures.glb`;
    void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(({ scene, animations }) => {
      const clip = animations.find((animation) => animation.name === "Celebrate_Open");
      if (this.disposed || !clip) {
        disposeRiderObject(scene);
        return;
      }
      scene.traverse((node) => { node.frustumCulled = false; });
      scene.visible = false;
      const mixer = new AnimationMixer(scene);
      const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      this.rider = { group: scene, mixer, duration: clip.duration };
      this.scene.add(scene);
      this.map.triggerRepaint();
    }).catch(() => {
      // Gate, distance and completion label still work without a gesture asset.
    });
  }

  render(_gl: WebGL2RenderingContext, projection: number[]) {
    const renderer = this.renderer;
    if (!renderer || this.map.getZoom() < 6) return;
    const { next, crossing, arrival } = this.frame;
    if (!next && !crossing && !arrival) return;
    const now = performance.now();
    const event = arrival ?? crossing;
    const elapsed = event ? now - event.startedAt : Infinity;
    if (!next && !arrival && elapsed >= PULSE_MS) return;
    renderer.resetState();
    if (next && next.gate !== event?.gate) this.drawMilestone(next.gate, Infinity, projection);
    if (event && (arrival || elapsed < PULSE_MS)) this.drawMilestone(event.gate, elapsed, projection);
    if (arrival && this.rider) {
      const { group, mixer, duration } = this.rider;
      mixer.setTime(Math.min(duration - 0.001, elapsed / 1000));
      this.drawAt(group, arrival.gate, projection);
    }
    if (arrival || (crossing && elapsed < PULSE_MS && !this.reducedMotion)) this.map.triggerRepaint();
  }

  private drawMilestone(gate: RideMilestone, elapsed: number, projection: number[]) {
    const progress = elapsed / PULSE_MS;
    const flashing = !this.reducedMotion && progress >= 0 && progress < 1;
    if (gate.label === "FINISH") {
      const { group, surface, pulse } = this.finish;
      pulse.visible = flashing;
      if (flashing) {
        pulse.scale.setScalar(2.5 + 10 * progress);
        pulse.material.opacity = 0.9 * (1 - progress);
      }
      this.followRoadGrade(surface, gate);
      this.drawAt(group, gate, projection);
      return;
    }
    const { group, surface, pulse, pulseMaterial, signTrim } = this.checkpoints[gate.label];
    pulse.visible = flashing;
    if (flashing) {
      pulse.position.x = 18 * progress;
      pulseMaterial.opacity = 0.9 * (1 - progress);
    }
    signTrim?.color.setHex(ROAD_GREEN).lerp(HALF_FLASH, flashing ? 1 - progress : 0);
    this.followRoadGrade(surface, gate);
    this.drawAt(group, gate, projection);
  }

  private followRoadGrade(surface: Group, gate: RideMilestone) {
    if (!this.map.getTerrain()) {
      surface.rotation.set(0, 0, 0);
      return;
    }
    const slopeAt = (bearingDeg: number) => {
      const start = this.map.queryTerrainElevation(offsetLngLatByBearingMeters(gate.position, bearingDeg + 180, 3));
      const end = this.map.queryTerrainElevation(offsetLngLatByBearingMeters(gate.position, bearingDeg, 3));
      return start != null && end != null ? Math.atan2(end - start, 6) : 0;
    };
    surface.rotation.set(-slopeAt(gate.headingDeg + 90), 0, slopeAt(gate.headingDeg));
  }

  private drawAt(object: Group, gate: RideMilestone, projection: number[]) {
    const terrain = this.map.queryTerrainElevation(gate.position, { exaggerated: true }) ?? 0;
    const coord = mapboxgl.MercatorCoordinate.fromLngLat(gate.position, terrain);
    const scale = coord.meterInMercatorCoordinateUnits();
    this.matrix.makeTranslation(coord.x, coord.y, coord.z)
      .scale(this.scale.set(scale, -scale, scale))
      .multiply(this.axis)
      .multiply(this.yaw.makeRotationY((90 - gate.headingDeg) * DEG_TO_RAD));
    this.camera.projectionMatrix.fromArray(projection).multiply(this.matrix);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    object.visible = true;
    this.renderer?.render(this.scene, this.camera);
    object.visible = false;
  }

  dispose() {
    this.disposed = true;
    this.marker?.remove();
    this.map.off("style.load", this.attach);
    this.map.off("idle", this.attach);
    this.map.off("zoomend", this.syncApproach);
    if (this.map.style && this.map.getLayer(this.id)) this.map.removeLayer(this.id);
    this.onRemove();
    this.rider?.mixer.stopAllAction();
    this.rider?.group.traverse((node) => {
      if (node instanceof SkinnedMesh) node.skeleton.dispose();
    });
    disposeRiderObject(this.scene);
  }
}

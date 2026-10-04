import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import {
  RIDER_HELMET_SHELL_MATERIAL_NAME,
  RIDER_JERSEY_MATERIAL_NAME,
  RIDER_VISUAL_KIT_PEER,
  RIDER_VISUAL_KIT_SELF,
  applyRiderVisualKit,
  resolveRiderVisualKit,
} from "../../src/lib/riderPrototype/riderVisualKit.ts";

function meshWith(name: string, rgb: { r: number; g: number; b: number }): Mesh {
  const material = new MeshStandardMaterial({
    name,
    color: new Color(rgb.r, rgb.g, rgb.b),
  });
  return new Mesh(new SphereGeometry(0.1, 4, 4), material);
}

describe("riderVisualKit", () => {
  it("self kit 은 GLB 기본 오렌지와 같다", () => {
    const kit = resolveRiderVisualKit("self");
    assert.equal(kit, RIDER_VISUAL_KIT_SELF);
    assert.equal(kit.helmet.r, 1);
    assert.equal(kit.jersey.r, 1);
    assert.notEqual(kit.helmet.r, RIDER_VISUAL_KIT_PEER.helmet.r);
  });

  it("peer kit 은 iso-peer teal 과 구분된다", () => {
    const kit = resolveRiderVisualKit("peer");
    assert.equal(kit, RIDER_VISUAL_KIT_PEER);
    assert.ok(kit.jersey.g > kit.jersey.r);
    assert.ok(Math.abs(kit.helmet.r - RIDER_VISUAL_KIT_SELF.helmet.r) > 0.2);
  });

  it("applyRiderVisualKit — self 는 기본 오렌지, peer 는 teal, 비대상 머티리얼은 유지", () => {
    const root = new Group();
    const helmet = meshWith(RIDER_HELMET_SHELL_MATERIAL_NAME, RIDER_VISUAL_KIT_SELF.helmet);
    const jersey = meshWith(RIDER_JERSEY_MATERIAL_NAME, RIDER_VISUAL_KIT_SELF.jersey);
    const shorts = meshWith("Rider | black shorts", { r: 0.01, g: 0.01, b: 0.01 });
    root.add(helmet, jersey, shorts);

    applyRiderVisualKit(root, "peer");
    assert.ok((helmet.material as MeshStandardMaterial).color.equals(
      new Color(RIDER_VISUAL_KIT_PEER.helmet.r, RIDER_VISUAL_KIT_PEER.helmet.g, RIDER_VISUAL_KIT_PEER.helmet.b),
    ));
    assert.ok((jersey.material as MeshStandardMaterial).color.equals(
      new Color(RIDER_VISUAL_KIT_PEER.jersey.r, RIDER_VISUAL_KIT_PEER.jersey.g, RIDER_VISUAL_KIT_PEER.jersey.b),
    ));
    assert.ok((shorts.material as MeshStandardMaterial).color.equals(new Color(0.01, 0.01, 0.01)));

    applyRiderVisualKit(root, "self");
    assert.ok((helmet.material as MeshStandardMaterial).color.equals(
      new Color(RIDER_VISUAL_KIT_SELF.helmet.r, RIDER_VISUAL_KIT_SELF.helmet.g, RIDER_VISUAL_KIT_SELF.helmet.b),
    ));
    assert.ok((jersey.material as MeshStandardMaterial).color.equals(
      new Color(RIDER_VISUAL_KIT_SELF.jersey.r, RIDER_VISUAL_KIT_SELF.jersey.g, RIDER_VISUAL_KIT_SELF.jersey.b),
    ));
  });
});

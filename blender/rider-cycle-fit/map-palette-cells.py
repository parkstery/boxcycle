"""팔레트 UV 셀 ↔ 신체 부위 매핑 — 팬츠 셀을 특정한다(F5-1).

라이더는 머티리얼 1개 + 128x16 팔레트 텍스처를 UV 로 찍는 방식이다. 팬츠만 색을 바꾸려면
"팬츠 폴리곤이 쓰는 UV 셀"을 알아야 한다. 각 UV 셀마다 그 셀을 쓰는 폴리곤들의 위치·
지배적 vertex group(뼈 웨이트)을 집계해 부위를 추정한다.

실행:
  blender --background --python map-palette-cells.py -- <riderGlb> <outJson>
"""
import bpy, sys, os, json
from mathutils import Vector

_A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_A[0])
OUT = os.path.abspath(_A[1]) if len(_A) > 1 else "palette-cells.json"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

obj = bpy.data.objects["RTW_RIDER_LOD0"]
me = obj.data
uvl = me.uv_layers[0].data
mat = me.materials[0]

# 팔레트 이미지에서 각 UV 셀의 실제 색을 읽는다
img = None
for n in mat.node_tree.nodes:
    if n.type == "TEX_IMAGE" and "basecolor" in (n.image.name if n.image else ""):
        img = n.image
        break
px = list(img.pixels) if img else []
W, H = (img.size if img else (0, 0))


def sample(u, v):
    if not px:
        return None
    x = min(W - 1, max(0, int(u * W)))
    y = min(H - 1, max(0, int(v * H)))
    i = (y * W + x) * 4
    return [round(px[i], 4), round(px[i + 1], 4), round(px[i + 2], 4)]


vg_names = [g.name for g in obj.vertex_groups]


def dominant_group(vi):
    v = me.vertices[vi]
    best, bw = None, 0.0
    for g in v.groups:
        if g.weight > bw:
            bw, best = g.weight, g.group
    return vg_names[best] if best is not None else None


cells = {}
for poly in me.polygons:
    us = [uvl[li].uv for li in poly.loop_indices]
    cu = sum(u[0] for u in us) / len(us)
    cv = sum(u[1] for u in us) / len(us)
    key = (round(cu, 2), round(cv, 2))
    c = cells.setdefault(key, {
        "uv": [key[0], key[1]], "polys": 0, "groups": {},
        "minZ": 1e9, "maxZ": -1e9, "sumZ": 0.0, "n": 0,
    })
    c["polys"] += 1
    for vi in poly.vertices:
        g = dominant_group(vi)
        if g:
            c["groups"][g] = c["groups"].get(g, 0) + 1
        z = (obj.matrix_world @ me.vertices[vi].co).z
        c["minZ"] = min(c["minZ"], z)
        c["maxZ"] = max(c["maxZ"], z)
        c["sumZ"] += z
        c["n"] += 1

rows = []
for k, c in cells.items():
    top = sorted(c["groups"].items(), key=lambda kv: -kv[1])[:4]
    rows.append({
        "uv": c["uv"],
        "polys": c["polys"],
        "paletteColor": sample(c["uv"][0], c["uv"][1]),
        "topGroups": [{"group": g, "verts": n} for g, n in top],
        "zRangeMM": [round(c["minZ"] * 1000, 1), round(c["maxZ"] * 1000, 1)],
        "zMeanMM": round(c["sumZ"] / max(1, c["n"]) * 1000, 1),
    })
rows.sort(key=lambda r: -r["polys"])

json.dump({"glb": GLB, "paletteSize": [W, H], "cells": rows},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
for r in rows[:25]:
    print("uv %s polys %5d color %s  z %s  %s" % (
        r["uv"], r["polys"], r["paletteColor"], r["zRangeMM"],
        ", ".join("%s:%d" % (g["group"], g["verts"]) for g in r["topGroups"])))

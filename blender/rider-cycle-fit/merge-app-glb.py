"""자전거 GLB + V2 라이더 노드 GLB → **앱 제품 GLB** 로 병합한다 (F18 §2-3).

앱 계약: 노드 10개(`crank`·`torso`·`leg_l`·`leg_l_shin`·`leg_r`·`leg_r_shin`·
`arm_l`·`arm_l_fore`·`arm_r`·`arm_r_fore`)가 이름 그대로 존재해야 한다.
Mapbox 가 `nodeOverrideNames` + `setFeatureState` 로 이 이름을 찾아 회전시킨다.

- 자전거: `generate-rider-prototype-glb.mjs` 를 `RTW_RIDER=0` 로 구운 것(`crank` 출처)
- 라이더: `decompose-v2-rider.py` 산출(스킨 없는 강체 9노드)
- 두 임포트가 각각 `RiderBike` 루트를 만들므로 **하나로 합치고 중복 루트를 지운다**

실행: blender --background --python merge-app-glb.py -- <cycleGlb> <riderGlb> <outGlb>
"""
import bpy, sys, os, json

A = sys.argv[sys.argv.index("--") + 1:]
CYCLE, RIDER, OUT = A[0], A[1], A[2]

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for c in (bpy.data.meshes, bpy.data.objects, bpy.data.armatures):
    for b in list(c):
        try:
            c.remove(b)
        except Exception:
            pass

WANT = ["crank", "torso", "leg_l", "leg_l_shin", "leg_r", "leg_r_shin",
        "arm_l", "arm_l_fore", "arm_r", "arm_r_fore"]

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(CYCLE))
cycle_objs = [o for o in bpy.data.objects if o not in before]
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(RIDER))
rider_objs = [o for o in bpy.data.objects if o not in before]

# 임포트가 이름을 .001 로 바꿨을 수 있다 — 원래 이름으로 되돌린다.
def canon(objs):
    for o in objs:
        base = o.name.split(".")[0]
        if base in WANT and o.name != base and not bpy.data.objects.get(base):
            o.name = base


canon(cycle_objs)
canon(rider_objs)

# 루트 통합: 자전거 쪽 RiderBike 를 정본 루트로, 라이더 루트의 자식을 그리로 옮긴다.
root = next((o for o in cycle_objs if o.name.split(".")[0] == "RiderBike"), None)
if root is None:
    root = bpy.data.objects.new("RiderBike", None)
    bpy.context.collection.objects.link(root)
    for o in cycle_objs:
        if o.parent is None:
            o.parent = root
root.name = "RiderBike"

for o in list(rider_objs):
    if o.name.split(".")[0] == "RiderBike":
        for ch in list(o.children):
            m = ch.matrix_world.copy()
            ch.parent = root
            ch.matrix_world = m
        bpy.data.objects.remove(o, do_unlink=True)

bpy.context.view_layer.update()
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False,
                          export_yup=True, export_skins=False, export_animations=False)

names = {o.name for o in bpy.data.objects}
rep = {
    "out": OUT,
    "bytes": os.path.getsize(OUT) if os.path.exists(OUT) else 0,
    "objects": len(bpy.data.objects),
    "required": WANT,
    "missing": [n for n in WANT if n not in names],
    "hierarchy": {n: (bpy.data.objects[n].parent.name if bpy.data.objects.get(n)
                      and bpy.data.objects[n].parent else None)
                  for n in WANT if n in names},
}
print("@@MERGE@@" + json.dumps(rep, ensure_ascii=False))

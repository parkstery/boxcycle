"""Inspect fixed Blender source for collar, arm and knee surface corrections."""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector

src, dest = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=src)
rows = []
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    rows.append(dict(name=o.name, vertices=len(pts),
        bounds=[[min(p[i] for p in pts), max(p[i] for p in pts)] for i in range(3)],
        materials=[m.name if m else None for m in o.data.materials],
        collections=[c.name for c in o.users_collection]))
Path(dest).write_text(json.dumps(rows, indent=2), encoding='utf-8')
for r in rows:
    if any('RIDER' in c for c in r['collections']):
        print(json.dumps(r))

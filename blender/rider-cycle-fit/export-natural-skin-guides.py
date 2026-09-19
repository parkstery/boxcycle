"""Read-only extraction of authored deformation guides, in glTF world axes."""
import bpy, json, sys
from pathlib import Path

out = Path(sys.argv[sys.argv.index('--') + 1])
result = {}
for obj in bpy.data.objects:
    if obj.type != 'MESH' or not obj.vertex_groups:
        continue
    names = {g.index: g.name for g in obj.vertex_groups}
    rows = []
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        rows.append({'p': [p.x, p.z, -p.y], 'w': {
            names[g.group]: g.weight for g in v.groups if g.weight > 0
        }})
    result[obj.name] = rows
out.write_text(json.dumps(result), encoding='utf8')
print('Exported guide objects:', list(result))

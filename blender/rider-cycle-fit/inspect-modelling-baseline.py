"""Read frozen Stage-0 inputs; inventory and render without exporting or fitting."""
import bpy
import sys
import json
import math
from pathlib import Path
from mathutils import Vector

manifest_path = Path(sys.argv[sys.argv.index('--') + 1])
out = manifest_path.parent
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
settings = manifest['renderSettings']


def inventory(objects):
    meshes = [o for o in objects if o.type == 'MESH']
    points = [o.matrix_world @ v.co for o in meshes if o.name != 'groundShadow' for v in o.data.vertices]
    if not points or not all(math.isfinite(c) for p in points for c in p):
        raise RuntimeError('Empty or non-finite geometry')
    lo = [min(v[i] for v in points) for i in range(3)]
    hi = [max(v[i] for v in points) for i in range(3)]
    return {
        'axis': 'Blender world: +X forward, +Z up; glTF (x,y,z) = Blender (x,z,-y)',
        'unit': 'meter', 'origin': 'Imported origin unchanged; groundShadow excluded from AABB',
        'aabb': {'min': lo, 'max': hi, 'size': [hi[i] - lo[i] for i in range(3)]},
        'armatures': {o.name: [b.name for b in o.data.bones] for o in objects if o.type == 'ARMATURE'},
        'meshesWithVertexGroups': {o.name: [g.name for g in o.vertex_groups] for o in meshes if o.vertex_groups},
        'meshObjects': len(meshes),
        'nodes': [{'name': o.name, 'type': o.type, 'parent': o.parent.name if o.parent else None,
                   'matrixWorld': [list(row) for row in o.matrix_world],
                   'vertices': len(o.data.vertices) if o.type == 'MESH' else None,
                   'materials': [m.name if m else None for m in o.data.materials] if o.type == 'MESH' else []}
                  for o in sorted(objects, key=lambda o: o.name)],
    }


def studio():
    scene = bpy.context.scene
    scene.render.engine = settings['engine']
    scene.cycles.device = settings['device']
    scene.cycles.samples = settings['samples']
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = settings['resolution']
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('Baseline studio')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.16, 0.18, 0.21, 1)
    bg.inputs[1].default_value = 0.5
    for pos, power, size in [((3, -4, 5), 450, 4), ((-2, 3, 3), 350, 3)]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        light = bpy.context.object
        light.data.energy = power
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector(settings['target']) - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = settings['orthographicScale']
    scene.camera = cam
    return scene, cam


result = {'candidateId': manifest['candidateId'], 'pose': settings['pose']}
bpy.ops.wm.open_mainfile(filepath=str(out / manifest['selectedRiderBlend']))
bpy.context.view_layer.update()
result['sourceBlend'] = inventory(list(bpy.context.scene.objects))
result['sourceBlend']['actions'] = [a.name for a in bpy.data.actions]

for label, relative in [('current', manifest['selectedCycleContainer']), ('modelling', manifest['selectedRider'])]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(out / relative))
    bpy.context.view_layer.update()
    result[label] = inventory(list(bpy.context.scene.objects))
    shadow = bpy.data.objects.get('groundShadow')
    if shadow:
        shadow.hide_render = True
    scene, cam = studio()
    for view, location in settings['views'].items():
        cam.location = location
        cam.rotation_euler = (Vector(settings['target']) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(out / f'{label}-{view}.png')
        bpy.ops.render.render(write_still=True)

(out / 'inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print('STAGE_0_INVENTORY_AND_RENDERS_COMPLETE')

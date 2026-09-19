"""Local collar/forearm/elbow/knee corrections on a frozen appearance LOD.
No pose changes or app promotion. Source -> isolated candidate only.
"""
import bpy, bmesh, sys, json, math, hashlib
from pathlib import Path
from mathutils import Vector

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
collection = bpy.data.collections['RIDER - riding pose']
TORSO = 'Rider anatomical torso shoulders and pelvis'
report = {'source': str(source), 'stage': 'appearance corrections; static only', 'changes': {}}


def world_vertices(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def signature(o):
    values = [[list(p) for p in world_vertices(o)], [list(f.vertices) for f in o.data.polygons],
              [f.material_index for f in o.data.polygons], [m.name for m in o.data.materials]]
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


def topology(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    result = {'boundaryEdges': sum(e.is_boundary for e in bm.edges),
              'nonmanifoldEdges': sum(not e.is_manifold for e in bm.edges)}
    visited = set(); components = 0
    for v in bm.verts:
        if v in visited: continue
        components += 1; todo = [v]; visited.add(v)
        while todo:
            for e in todo.pop().link_edges:
                v2 = e.other_vert(e.verts[0]) if False else None
                for v2 in e.verts:
                    if v2 not in visited: visited.add(v2); todo.append(v2)
    result['components'] = components
    bm.free(); return result


def activate(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True); bpy.context.view_layer.objects.active = o


def clean(o):
    # Repair coincident UV seam vertices without moving the surface.
    o.data = o.data.copy()
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-10)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(o.data); bm.free(); o.data.update()


def union(a, b):
    activate(a)
    mod = a.modifiers.new('Remove internal capped junction surfaces', 'BOOLEAN')
    mod.operation = 'UNION'; mod.solver = 'EXACT'; mod.object = b
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(b, do_unlink=True)
    clean(a)


def local_smooth(o, center, radius, name):
    center = Vector(center)
    vg = o.vertex_groups.new(name=name)
    for v in o.data.vertices:
        distance = (o.matrix_world @ v.co - center).length
        w = max(0, 1 - (distance / radius) ** 2) ** 2
        if w > 0: vg.add([v.index], w, 'REPLACE')
    activate(o)
    mod = o.modifiers.new('Blend continuous skin around joint', 'SMOOTH')
    mod.factor = .52; mod.iterations = 18; mod.vertex_group = vg.name
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Smooth normals only near the repaired connection, retain flat body style.
    for f in o.data.polygons:
        if (o.matrix_world @ f.center - center).length < radius:
            f.use_smooth = True


def render(tag, views):
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
    scene.cycles.samples = 16; scene.cycles.use_denoising = True
    scene.render.resolution_x = 950; scene.render.resolution_y = 850
    scene.render.resolution_percentage = 100
    cam = scene.camera; cam.data.type = 'ORTHO'
    for name, pos, target, scale in views:
        cam.location = pos
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = scale
        scene.render.filepath = str(output / f'{tag}-{name}.png')
        bpy.ops.render.render(write_still=True)


views = [
    ('collar', (2.3, -3, 2.05), (.23, 0, 1.355), .45),
    ('front-joints', (4, 0, 1.65), (.16, 0, .97), 1.05),
    ('right-arm', (1.4, -3, 1.65), (.32, -.22, 1.08), .66),
    ('left-knee', (1.6, 3, 1.0), (.05, .10, .76), .6),
    ('full', (3, -5, 2.7), (0, 0, .83), 2.26),
]
before = {o.name: signature(o) for o in bpy.data.objects if o.type == 'MESH'}
render('before', views[:3])

# Replace both overlapping old collar parts using the actual imported neck rings.
neck = bpy.data.objects['Mesh_57']
nv = world_vertices(neck)
assert len(nv) == 46, 'Neck topology changed; inspect source before using ring indices'
upper, lower = nv[:22], nv[23:45]
verts = []; sides = 44
def loop(t, offset):
    raw = [lower[j].lerp(upper[j], t) for j in range(22)]
    center = sum(raw, Vector()) / 22
    ring = []
    for i in range(sides):
        j = i // 2; p = raw[j].lerp(raw[(j + 1) % 22], .5 * (i % 2))
        ring.append(p + (p-center).normalized() * offset)
    return ring
# Annular cloth band with a closed, modest-thickness top edge, not a rolled torus.
for t, off in [(.29,.0045), (.46,.0030), (.46,.0006), (.29,.0006)]:
    verts.extend(loop(t, off))
faces = []
for k in range(4):
    for j in range(sides):
        faces.append((k*sides+j, k*sides+(j+1)%sides,
                      ((k+1)%4)*sides+(j+1)%sides, ((k+1)%4)*sides+j))
me = bpy.data.meshes.new('Neck conforming collar surface'); me.from_pydata(verts, [], faces); me.update()
collar = bpy.data.objects.new('Jersey fitted round collar', me); collection.objects.link(collar)
me.materials.append(bpy.data.materials['Rider | orange jersey'])
clean(collar)
for f in me.polygons: f.use_smooth = True
for n in ['Mesh_58','Mesh_59']: bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
report['changes']['collar'] = {'removed': ['Mesh_58','Mesh_59'], 'new': collar.name,
                              'neckRingInterpolation': [.29,.46], 'topology': topology(collar)}

torso = bpy.data.objects[TORSO]; clean(torso)
elbows = []
for sg, name in [(-1,'Mesh_110'), (1,'Mesh_132')]:
    o = bpy.data.objects[name]; clean(o)
    E = Vector((.285, sg*.225, 1.006)); W = Vector((.453, sg*.218, .893))
    axis = W-E; length = axis.length; axis.normalize()
    inv = o.matrix_world.inverted(); max_before = 0; max_after = 0
    for v in o.data.vertices:
        p = o.matrix_world @ v.co; along = (p-E).dot(axis); t = along/length
        radial = p-E-axis*along
        # Keep the final wrist/cuff region exact; thin the forearm belly.
        if t < .72: scale = .75
        elif t < .92:
            u = (t-.72)/.20; scale = .75+.25*u*u*(3-2*u)
        else: scale = 1
        v.co = inv @ (E+axis*along+radial*scale)
        if .08 < t < .72:
            max_before = max(max_before, radial.length)
            max_after = max(max_after, radial.length*scale)
    o.data.update()
    report['changes'][name] = {'radialScale': .75, 'wristPreservedFromAxisFraction': .92,
        'bellyMaxRadiusBeforeM': max_before, 'bellyMaxRadiusAfterM': max_after,
        'elbow': list(E), 'wrist': list(W)}
    union(torso, o)
    local_smooth(torso, E, .09, f'Elbow skin blend {sg}')
    elbows.append(list(E))

for upper_name, shin_name, center in [
    ('Mesh_154','Mesh_155',(.035,-.095,.681)),
    ('Mesh_164','Mesh_165',(.13,.103,.756)),
]:
    a,b = bpy.data.objects[upper_name],bpy.data.objects[shin_name]
    clean(a); clean(b); union(a,b)
    local_smooth(a, center, .115, 'Continuous knee skin')
    report['changes'][upper_name] = {'mergedShin': shin_name, 'blendCenter': center,
                                    'topology': topology(a)}
report['changes'][TORSO] = {'mergedForearms': ['Mesh_110','Mesh_132'],
                          'elbowCenters': elbows, 'topology': topology(torso)}
changed = {TORSO,'Mesh_58','Mesh_59','Mesh_110','Mesh_132','Mesh_154','Mesh_155','Mesh_164','Mesh_165'}
unchanged = [n for n in before if n not in changed]
assert all(n in bpy.data.objects and signature(bpy.data.objects[n]) == before[n] for n in unchanged)
report['unchangedMeshCount'] = len(unchanged)
report['unchangedObjects'] = unchanged
for name in [TORSO,'Mesh_154','Mesh_164',collar.name]:
    assert topology(bpy.data.objects[name]) == {'boundaryEdges':0,'nonmanifoldEdges':0,'components':1}, (name,topology(bpy.data.objects[name]))
report['triangles'] = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles(); report['triangles'] += len(o.data.loop_triangles)
render('after', views)
activate(torso)
bpy.ops.wm.save_as_mainfile(filepath=str(output/'rider_surface_corrected.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'MESH': o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'rider_surface_corrected.glb'),
    use_selection=True, export_format='GLB', export_animations=False)
(output/'build-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('SURFACE_CORRECTIONS_DONE', json.dumps({'triangles':report['triangles'],'unchangedMeshes':len(unchanged)}),flush=True)

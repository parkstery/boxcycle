"""안장 일반/표식 증거 6장을 2열 contact sheet로 묶는다."""
import bpy, sys, os, json

out_dir = sys.argv[sys.argv.index("--") + 1]
mf = json.load(open(os.path.join(out_dir, "render-manifest.json"), encoding="utf-8"))
ids = mf["saddleContactEvidence"]["requiredEvidenceImages"]
cell_w, cell_h = 450, 350
canvas = bpy.data.images.new("saddle-contact-sheet", width=cell_w * 2, height=cell_h * 3, alpha=True)
pixels = [0.08, 0.08, 0.08, 1.0] * (cell_w * 2 * cell_h * 3)
for i, iid in enumerate(ids):
    img = bpy.data.images.load(os.path.join(out_dir, iid + ".png"), check_existing=False)
    img.scale(cell_w, cell_h)
    src = list(img.pixels)
    col, row = i % 2, i // 2
    x0, y0 = col * cell_w, (2 - row) * cell_h
    for y in range(cell_h):
        dst = ((y0 + y) * cell_w * 2 + x0) * 4
        off = y * cell_w * 4
        pixels[dst:dst + cell_w * 4] = src[off:off + cell_w * 4]
    bpy.data.images.remove(img)
canvas.pixels[:] = pixels
path_out = os.path.join(out_dir, "contact-sheet-saddle-evidence.png")
canvas.filepath_raw = path_out
canvas.file_format = "PNG"
canvas.save()
mf["saddleContactEvidence"]["contactSheet"] = os.path.abspath(path_out)
json.dump(mf, open(os.path.join(out_dir, "render-manifest.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
print(path_out)

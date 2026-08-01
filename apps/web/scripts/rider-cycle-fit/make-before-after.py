"""기준 후보(왼쪽)와 Stage 2 후보(오른쪽)의 동일 카메라 PNG를 한 장에 배열한다."""
import bpy, sys, os, json

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
before, after = argv[0], argv[1]
ids = [
    # 다리 비율(허벅지·정강이 길이) 변화를 사용자가 직접 볼 수 있도록 맨 위에 둔다(F10-R1 §5-4).
    "RIDER_ONLY_SIDE_L",
    "STATIC_SIDE_L", "STATIC_FRONT", "STATIC_REAR", "STATIC_Q_FRONT",
    "PHASE_0_FULL", "PHASE_90_FULL", "PHASE_180_FULL", "PHASE_270_FULL",
]
cell_w, cell_h = 450, 350
canvas = bpy.data.images.new("before-after", width=cell_w * 2, height=cell_h * len(ids), alpha=True)
pixels = [0.08, 0.08, 0.08, 1.0] * (cell_w * 2 * cell_h * len(ids))


def paste(src_path, col, row):
    img = bpy.data.images.load(src_path, check_existing=False)
    img.scale(cell_w, cell_h)
    src = list(img.pixels)
    y0 = (len(ids) - 1 - row) * cell_h
    x0 = col * cell_w
    width = cell_w * 2
    for y in range(cell_h):
        dst = ((y0 + y) * width + x0) * 4
        off = y * cell_w * 4
        pixels[dst:dst + cell_w * 4] = src[off:off + cell_w * 4]
    bpy.data.images.remove(img)


for row, iid in enumerate(ids):
    paste(os.path.join(before, iid + ".png"), 0, row)
    paste(os.path.join(after, iid + ".png"), 1, row)
canvas.pixels[:] = pixels
out = os.path.join(after, "before-after.png")
canvas.filepath_raw = out
canvas.file_format = "PNG"
canvas.save()
bm = json.load(open(os.path.join(before, "render-manifest.json"), encoding="utf-8"))
am = json.load(open(os.path.join(after, "render-manifest.json"), encoding="utf-8"))
json.dump({
    "image": "before-after.png",
    "left": {"candidateId": bm["candidateId"], "inputHash": bm.get("inputHash", "not-recorded")},
    "right": {"candidateId": am["candidateId"], "inputHash": am["inputHash"]},
    "views": ids,
    "sameCameraIds": True,
    "comparisonLimited": bm.get("inputHash") != am.get("inputHash"),
    "reason": (
        "동일 inputHash·scale·렌더 하네스의 새 기준선 비교."
        if bm.get("inputHash") == am.get("inputHash")
        else "inputHash 불일치/누락으로 PASS 근거로 사용하지 않는다."
    ),
}, open(os.path.join(after, "before-after-manifest.json"), "w", encoding="utf-8"),
    ensure_ascii=False, indent=2)
print(out)

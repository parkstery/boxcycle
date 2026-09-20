#!/usr/bin/env python3
"""Build same-camera source/DQS comparison sheets and pixel-diff evidence."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


VIEWS = ("side", "front", "knee", "34")


def font(size: int):
    for candidate in ("C:/Windows/Fonts/consola.ttf", "C:/Windows/Fonts/arial.ttf"):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def diff_metrics(before: Image.Image, after: Image.Image) -> dict:
    a = before.convert("RGB")
    b = after.convert("RGB")
    if a.size != b.size:
        raise ValueError(f"image size mismatch: {a.size} vs {b.size}")
    width, height = a.size
    pa, pb = a.load(), b.load()
    sq = 0
    changed = 0
    compared = 0
    max_channel = 0
    # The metadata differs by design. Exclude only its rectangle; the model and
    # the rest of the viewport stay in the comparison.
    for y in range(height):
        for x in range(width):
            if x < 310 and y < 170:
                continue
            da = pa[x, y]
            db = pb[x, y]
            diffs = (abs(da[0] - db[0]), abs(da[1] - db[1]), abs(da[2] - db[2]))
            peak = max(diffs)
            max_channel = max(max_channel, peak)
            if peak > 3:
                changed += 1
            sq += sum(v * v for v in diffs)
            compared += 3
    return {
        "comparedPixels": compared // 3,
        "changedPixelsOver3": changed,
        "changedPercentOver3": changed / max(compared // 3, 1) * 100,
        "rgbRmse": math.sqrt(sq / max(compared, 1)),
        "maxChannelDelta": max_channel,
        "excludedRect": [0, 0, 310, 170],
    }


def make_sheet(candidate_dir: Path, candidate_id: str, views: tuple[str, str], name: str) -> Path:
    tile_w, tile_h = 720, 554
    header_h = 70
    sheet = Image.new("RGB", (tile_w * 2, header_h + tile_h * 2), (18, 21, 24))
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 14), f"Candidate {candidate_id} | STATIC_BIND_FEASIBILITY | UNAPPROVED",
              fill=(240, 244, 246), font=font(22))
    draw.text((18, 42), "Left: source original    Right: DQS bind evaluation    identical camera/light",
              fill=(166, 176, 184), font=font(16))
    for row, view in enumerate(views):
        for col, mode in enumerate(("source", "bind")):
            image_path = candidate_dir / f"{mode}-{view}-{candidate_id}.png"
            image = Image.open(image_path).convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
            sheet.paste(image, (col * tile_w, header_h + row * tile_h))
    output = candidate_dir / name
    sheet.save(output)
    return output


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: make-static-bind-report.py <candidate-dir>")
    candidate_dir = Path(sys.argv[1]).resolve()
    manifest_path = candidate_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    candidate_id = manifest["candidateId"]

    image_metrics = {}
    for view in VIEWS:
        source = Image.open(candidate_dir / f"source-{view}-{candidate_id}.png")
        bind = Image.open(candidate_dir / f"bind-{view}-{candidate_id}.png")
        image_metrics[view] = diff_metrics(source, bind)
        diff = ImageChops.difference(source.convert("RGB"), bind.convert("RGB"))
        diff = diff.point(lambda value: min(255, value * 8))
        diff.save(candidate_dir / f"diff-x8-{view}-{candidate_id}.png")

    overview = make_sheet(candidate_dir, candidate_id, ("side", "34"),
                          f"comparison-overview-{candidate_id}.png")
    detail = make_sheet(candidate_dir, candidate_id, ("front", "knee"),
                        f"comparison-detail-{candidate_id}.png")
    report = {
        "candidateId": candidate_id,
        "stage": manifest["stage"],
        "status": manifest["status"],
        "geometryMetrics": manifest.get("metrics"),
        "imageDiffMetrics": image_metrics,
        "comparisonSheets": [str(overview), str(detail)],
        "interpretation": (
            "Vertex displacement measures pose alignment. Edge-length deltas measure local shape distortion. "
            "Pixel differences exclude the metadata rectangle only."
        ),
    }
    report_path = candidate_dir / "static-bind-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"report": str(report_path), "sheets": report["comparisonSheets"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()

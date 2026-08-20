import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { decodePngRgba } from "./decode-png.ts";
import {
  extractMarkers,
  S0_FILES,
  S0_KNOWN,
  S0_SELF_X_MAX,
  S0_SELF_X_MIN,
} from "./extract-marker-pixels.ts";
import { loadRaster } from "./load-raster.ts";

const R4 = resolve(import.meta.dirname, "../../../../document/ops/sync-relay/S44R4-shots");
const R5 = resolve(import.meta.dirname, "../../../../document/ops/sync-relay/S44R5-shots");

describe("S4-4R7 마커 픽셀 추출", () => {
  it("S0: 알려진 self 정답 635.7~636.4 을 R4 PNG 에서 재현한다", () => {
    const xs: number[] = [];
    for (const file of S0_FILES) {
      const img = decodePngRgba(readFileSync(resolve(R4, file)));
      const r = extractMarkers(img);
      assert.equal(r.failReasons.length, 0, `${file} ${r.failReasons.join(";")}`);
      assert.ok(r.self, `${file} self 없음`);
      const x = r.self!.x;
      xs.push(x);
      assert.ok(
        Math.abs(x - S0_KNOWN[file]) < 0.15,
        `${file} selfX=${x} known=${S0_KNOWN[file]}`,
      );
    }
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    assert.ok(min >= S0_SELF_X_MIN - 0.05, `min ${min}`);
    assert.ok(max <= S0_SELF_X_MAX + 0.05, `max ${max}`);
  });

  it("S1: self 는 live 파랑 네임태그, peer 는 peer 틸 네임태그로 가른다", () => {
    const img = decodePngRgba(readFileSync(resolve(R4, "F000.png")));
    const r = extractMarkers(img);
    assert.match(r.self!.reason, /#1d4ed8/);
    assert.match(r.peer!.reason, /#0f766e/);
    assert.ok(r.self!.nametagN >= 6);
    assert.ok(r.peer!.nametagN >= 6);
    assert.ok(r.peer!.x < r.self!.x, "판별은 색으로 했고, 이 샷에서 peer 가 왼쪽에 놓일 뿐 위치로 고르지 않았다");
  });

  it("S2: R5 JPEG 480 은 네임태그가 없어 판별에 쓰지 않는다", () => {
    const img = loadRaster(resolve(R5, "F000.jpg"));
    const r = extractMarkers(img, { jpeg: true });
    assert.equal(img.width, 480);
    assert.equal(img.height, 270);
    assert.equal(r.self, null);
    assert.equal(r.peer, null);
    assert.ok(r.failReasons.some((x) => x.includes("네임태그")));
  });
});

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodePngRgba, type RgbaImage } from "./decode-png.ts";

const PS = `
param([string]$InPath, [string]$OutPath)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($InPath)
try {
  $w = $bmp.Width
  $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $bd = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $n = [Math]::Abs($bd.Stride) * $h
    $bgra = New-Object byte[] $n
    [Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $bgra, 0, $n)
    $rgba = New-Object byte[] ($w * $h * 4)
    $stride = [Math]::Abs($bd.Stride)
    for ($y = 0; $y -lt $h; $y++) {
      for ($x = 0; $x -lt $w; $x++) {
        $s = $y * $stride + $x * 4
        $d = ($y * $w + $x) * 4
        $rgba[$d] = $bgra[$s+2]
        $rgba[$d+1] = $bgra[$s+1]
        $rgba[$d+2] = $bgra[$s]
        $rgba[$d+3] = $bgra[$s+3]
      }
    }
    $hdr = New-Object byte[] 8
    [BitConverter]::GetBytes([int]$w).CopyTo($hdr, 0)
    [BitConverter]::GetBytes([int]$h).CopyTo($hdr, 4)
    [IO.File]::WriteAllBytes($OutPath, $hdr + $rgba)
  } finally {
    $bmp.UnlockBits($bd)
  }
} finally {
  $bmp.Dispose()
}
`;

export function loadRaster(filePath: string): RgbaImage {
  if (filePath.toLowerCase().endsWith(".png")) {
    return decodePngRgba(readFileSync(filePath));
  }
  const dir = mkdtempSync(join(tmpdir(), "s44r7-"));
  const ps1 = join(dir, "dump.ps1");
  const out = join(dir, "rgba.bin");
  writeFileSync(ps1, PS, "utf8");
  try {
    execFileSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, "-InPath", filePath, "-OutPath", out],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const buf = readFileSync(out);
    const width = buf.readInt32LE(0);
    const height = buf.readInt32LE(4);
    return { width, height, data: new Uint8Array(buf.subarray(8)) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

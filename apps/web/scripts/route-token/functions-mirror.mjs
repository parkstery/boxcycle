import fs from "node:fs";
import path from "node:path";

const PLACEHOLDER_SECRET = "MAPBOX_ACCESS_TOKEN=harness-emulator-placeholder-not-real\n";

/**
 * 추적 중인 functions/package.json 을 수정하지 않고 Emulator entry 를 지정한다.
 * mirror 는 .runner-cache 아래에만 생성·삭제한다.
 */
export function prepareFunctionsMirror(functionsDir, cacheRoot) {
  const mirrorDir = path.join(cacheRoot, "functions-mirror");
  if (fs.existsSync(mirrorDir)) {
    fs.rmSync(mirrorDir, { recursive: true, force: true });
  }
  fs.mkdirSync(mirrorDir, { recursive: true });

  fs.cpSync(path.join(functionsDir, "lib"), path.join(mirrorDir, "lib"), { recursive: true });

  const pkg = JSON.parse(fs.readFileSync(path.join(functionsDir, "package.json"), "utf8"));
  pkg.main = "lib/index.harness.js";
  fs.writeFileSync(path.join(mirrorDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  const nodeModulesTarget = path.join(functionsDir, "node_modules");
  const nodeModulesLink = path.join(mirrorDir, "node_modules");
  if (!fs.existsSync(nodeModulesTarget)) {
    throw new Error("functions/node_modules 가 없습니다. npm install 을 실행하세요.");
  }
  fs.symlinkSync(nodeModulesTarget, nodeModulesLink, "junction");

  return mirrorDir;
}

export function writeMirrorSecret(mirrorDir) {
  const secretPath = path.join(mirrorDir, ".secret.local");
  if (fs.existsSync(secretPath)) {
    const body = fs.readFileSync(secretPath, "utf8");
    if (body !== PLACEHOLDER_SECRET) {
      throw new Error(`${secretPath} 에 harness 이외 내용이 있습니다.`);
    }
    return secretPath;
  }
  fs.writeFileSync(secretPath, PLACEHOLDER_SECRET, "utf8");
  return secretPath;
}

export function removeFunctionsMirror(cacheRoot) {
  const mirrorDir = path.join(cacheRoot, "functions-mirror");
  if (!fs.existsSync(mirrorDir)) return;
  fs.rmSync(mirrorDir, { recursive: true, force: true });
}

export function assertTrackedPackageUnchanged(pkgPath, expectedBytes) {
  const actual = fs.readFileSync(pkgPath);
  if (!actual.equals(expectedBytes)) {
    throw new Error("functions/package.json 추적 파일이 변경되었습니다.");
  }
  const pkg = JSON.parse(actual.toString("utf8"));
  if (pkg.main !== "lib/index.js") {
    throw new Error(`functions/package.json main 이 lib/index.js 가 아닙니다: ${pkg.main}`);
  }
}

export function assertNoTrackedSecret(secretPath) {
  if (!fs.existsSync(secretPath)) return;
  const body = fs.readFileSync(secretPath, "utf8");
  if (body === PLACEHOLDER_SECRET) {
    throw new Error("functions/.secret.local harness placeholder 가 남아 있습니다.");
  }
  throw new Error("functions/.secret.local 이 존재합니다.");
}

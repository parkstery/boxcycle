import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const EXTENSIONS = [".tsx", ".ts", ".mjs", ".js"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const base = join(dirname(parentPath), specifier);
    if (base.endsWith(".css") || base.endsWith(".tsx") || base.endsWith(".ts")) {
      return { url: pathToFileURL(base).href, shortCircuit: true };
    }
    if (existsSync(base)) return nextResolve(pathToFileURL(base).href, context);
    for (const ext of EXTENSIONS) {
      if (existsSync(base + ext)) {
        return { url: pathToFileURL(base + ext).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) {
    return { format: "module", source: "export {};\n", shortCircuit: true };
  }
  if (url.endsWith(".tsx") || url.endsWith(".ts")) {
    const filename = fileURLToPath(url);
    const source = readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2023,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}

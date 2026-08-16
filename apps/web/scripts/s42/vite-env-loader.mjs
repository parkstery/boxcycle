import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const VITE_ENV = {
  DEV: true,
  MODE: "test",
  PROD: false,
  SSR: true,
  BASE_URL: "/",
  VITE_FIREBASE_API_KEY: "",
  VITE_FIREBASE_AUTH_DOMAIN: "",
  VITE_FIREBASE_PROJECT_ID: "",
  VITE_FIREBASE_STORAGE_BUCKET: "",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "",
  VITE_FIREBASE_APP_ID: "",
  VITE_FIREBASE_DATABASE_URL: "",
  VITE_USE_EMULATOR: "",
};

const SRC_MARKER = "/src/";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const base = join(dirname(parentPath), specifier);
    for (const extra of ["", ".ts", ".tsx", ".js", ".mjs"]) {
      const candidate = base + extra;
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  const normalized = url.replaceAll("\\", "/");
  if (!normalized.includes(SRC_MARKER) || result.source == null) return result;
  const text =
    typeof result.source === "string"
      ? result.source
      : Buffer.from(result.source).toString("utf8");
  if (!text.includes("import.meta.env")) return result;
  return {
    format: result.format ?? "module",
    source: text.replaceAll("import.meta.env", `(${JSON.stringify(VITE_ENV)})`),
    shortCircuit: true,
  };
}

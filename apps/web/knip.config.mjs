// 코드 정련(20261022-code-tidy) 측정 설정. dev-tools.json 에 등록된 스크립트는 진입점으로 본다.
import { readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync(new URL("./dev-tools.json", import.meta.url), "utf8"));
const registered = registry.tools
  .filter((t) => t.path?.startsWith("apps/web/"))
  .map((t) => t.path.slice("apps/web/".length));

export default {
  entry: [
    "src/main.tsx",
    "scripts/test-quick.mjs",
    "scripts/**/*.test.{ts,tsx,mjs}",
    "e2e/**/*.spec.ts",
    ...registered,
  ],
  project: ["src/**/*.{ts,tsx,mjs}", "scripts/**/*.{ts,tsx,mjs}", "e2e/**/*.ts"],
  ignore: ["**/*.d.mts"],
};

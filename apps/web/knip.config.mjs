// 코드 정련(20261022-code-tidy) 측정 설정. dev-tools.json 에 등록된 도구도 진입점으로 본다.
import { readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync(new URL("./dev-tools.json", import.meta.url), "utf8"));
const registered = registry.tools
  .filter((t) => t.path?.startsWith("apps/web/"))
  .map((t) => t.path.slice("apps/web/".length));

export default {
  entry: [
    "src/main.tsx",
    // scripts/ 는 제품이 아니라 하네스·시험 도구다(npm script·HTML 픽스처·HARNESS.md 로 실행).
    // 전부 진입점으로 두고, 죽은 코드 판정은 제품 소스(src)에 집중한다 — P2 조사 결과.
    "scripts/**/*.{ts,tsx,mjs}",
    "e2e/**/*.spec.ts",
    ...registered,
  ],
  project: ["src/**/*.{ts,tsx,mjs}", "scripts/**/*.{ts,tsx,mjs}", "e2e/**/*.ts"],
  ignore: ["**/*.d.mts"],
};

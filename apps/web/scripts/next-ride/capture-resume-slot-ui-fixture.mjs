/**
 * 실제 NextRideCard를 Vite로 마운트한 뒤 740×300 캡처.
 * 손코딩 HTML 위장 금지 — 컴포넌트+CSS import. auth/앱 우회 없음.
 */
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../..");
const outDir = path.resolve(
  webRoot,
  "../../document/ops/20261006-calories-resume/fixtures",
);
const outPng = path.join(outDir, "resume-slot-ui-740x300.png");

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const server = await createServer({
    configFile: false,
    root: webRoot,
    appType: "spa",
    plugins: [react({ fastRefresh: false })],
    server: {
      host: "127.0.0.1",
      port: 5199,
      strictPort: true,
    },
    publicDir: false,
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime"],
    },
  });

  await server.listen();
  const addr = server.resolvedUrls?.local?.[0];
  if (!addr) {
    await server.close();
    throw new Error("vite listen failed — no local URL");
  }
  const url = new URL("/scripts/next-ride/resume-slot-ui-fixture.html", addr).href;
  console.log("fixture url", url);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 740, height: 300 } });
    page.on("pageerror", (err) => console.error("pageerror", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("console", msg.text());
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.getByRole("group", { name: /다음 주행/ }).waitFor({ state: "visible", timeout: 45_000 });
    await page.getByTitle("이어달리기 종료").waitFor({ state: "visible" });
    await page.screenshot({ path: outPng, fullPage: false });
    console.log("captured", outPng);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

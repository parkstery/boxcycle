/**
 * 만료 안내·오프라인 재시도의 문구와 44px 터치.
 * 667×300, 844×390. Firebase 에뮬레이터는 띄우지 않는다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { createServer } = require("vite");
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("../..", import.meta.url));

const fixture = `
import React from "react";
import { createRoot } from "react-dom/client";
import { AuthSessionGate } from "/src/components/auth/AuthSessionGate.tsx";
import { GuestEntryCard } from "/src/components/auth/GuestEntryCard.tsx";
function App() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  if (mode === "offline") {
    return React.createElement(AuthSessionGate, {
      configured: true,
      authInitialized: true,
      authSigningIn: false,
      userSignedOut: false,
      authOffline: true,
      busy: false,
      error: null,
      onStartGuest() {},
      onGoogleSignIn() {},
      onRetryAuth() {},
    });
  }
  return React.createElement(GuestEntryCard, {
    busy: false,
    error: null,
    expiryKind: "guest-expired",
    onStartGuest() {},
    onGoogleSignIn() {},
  });
}
createRoot(document.getElementById("root")).render(React.createElement(App));
`;

test("expiry notice and offline retry stay tappable at phone landscape sizes", { timeout: 90000 }, async () => {
  const server = await createServer({
    root,
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
    plugins: [
      {
        name: "notice-viewport-fixture",
        enforce: "pre",
        resolveId(id) {
          if (id === "/notice-fixture.js") return "\0notice-fixture";
        },
        load(id) {
          if (id === "\0notice-fixture") return fixture;
        },
        configureServer(s) {
          s.middlewares.use(async (req, res, next) => {
            if (req.url?.split("?")[0] !== "/notice-viewport") return next();
            res.setHeader("Content-Type", "text/html");
            res.end(
              await s.transformIndexHtml(
                "/notice-viewport",
                '<html><body><div id="root"></div><script type="module" src="/notice-fixture.js"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  let browser;
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    for (const viewport of [
      { width: 667, height: 300 },
      { width: 844, height: 390 },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/notice-viewport?mode=expired`);
      await page.getByText("30일간 사용하지 않으면").waitFor();
      const start = page.getByRole("button", { name: "시작", exact: true });
      const startBox = await start.boundingBox();
      assert.ok(startBox, `${viewport.width} expiry start box`);
      assert.ok(startBox.height + 0.001 >= 44, `${viewport.width} start height ${startBox.height}`);
      assert.ok(startBox.y >= 0 && startBox.y + startBox.height <= viewport.height + 1, `${viewport.width} start in view`);
      await page.goto(`http://127.0.0.1:${port}/notice-viewport?mode=offline`);
      await page.getByText("연결을 확인하지 못했습니다.").waitFor();
      const retry = page.getByRole("button", { name: "재시도" });
      const retryBox = await retry.boundingBox();
      assert.ok(retryBox, `${viewport.width} retry box`);
      assert.ok(retryBox.height + 0.001 >= 44, `${viewport.width} retry height ${retryBox.height}`);
      assert.ok(retryBox.y >= 0 && retryBox.y + retryBox.height <= viewport.height + 1, `${viewport.width} retry in view`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser?.close();
    await server.close();
  }
});

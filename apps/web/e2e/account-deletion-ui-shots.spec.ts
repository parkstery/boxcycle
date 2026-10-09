/**
 * 계정 탈퇴 UI 촬영 — 게스트 로그아웃(=데이터 삭제) 확인 + 정식 계정 탈퇴 확인(컴포넌트 마크업).
 * 산출: document/ops/20261006-account-deletion/shots-15/
 *
 * 실행(에뮬레이터 래퍼 안): playwright test account-deletion-ui-shots --workers=1 --retries=0
 */
import { test, expect } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, "../../../document/ops/20261006-account-deletion/shots-15");

test.describe("계정 탈퇴 UI 촬영", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOTS, { recursive: true });
  });

  test("게스트 — 로그아웃(데이터 삭제) 확인 화면", async ({ page }) => {
    test.skip(!LIVE, "Firebase 에뮬레이터 필요");
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 690, height: 275 });
    await page.goto("/");
    const gate = page.getByRole("dialog", { name: "시작" });
    await expect(gate).toBeVisible({ timeout: 30_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 30_000 });

    await page.getByRole("button", { name: "사용자 정보" }).click();
    const sheet = page.getByRole("dialog", { name: "사용자 정보" });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet.getByRole("button", { name: "이 기기 데이터 지우기" })).toHaveCount(0);
    await sheet.getByRole("button", { name: "로그아웃", exact: true }).click();
    const confirm = sheet.getByRole("group", { name: "로그아웃 확인" });
    await expect(confirm).toContainText("게스트는 로그아웃하면 모든 데이터가 삭제됩니다.");
    await page.screenshot({
      path: path.join(SHOTS, "01-guest-logout-confirm.png"),
      fullPage: true,
    });
  });

  test("정식 계정 — 탈퇴 확인(입력 전 비활성 · 「탈퇴」 입력 후 활성)", async ({ page }) => {
    // Google 팝업 재인증은 헤드리스로 불가 — UserInfoSheet 확인 UI 마크업·CSS 를 직접 렌더해 촬영
    test.setTimeout(60_000);
    const cssPath = path.resolve(__dirname, "../src/components/UserInfoSheet.css");
    const css = fs.readFileSync(cssPath, "utf8");
    const htmlFor = (phrase: string, enabled: boolean) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<style>
  :root {
    --rtw-text: #EDEFF2;
    --rtw-danger: #f87171;
    --rtw-danger-bg: rgba(217, 84, 61, 0.14);
    --rtw-danger-border: rgba(248, 113, 113, 0.45);
  }
  body { margin: 0; background: #0b1220; font-family: system-ui, sans-serif; }
  .wrap { width: 320px; margin: 12px; }
  ${css}
</style></head><body>
<div class="wrap">
  <div class="user-info-sheet__logout-confirm" role="group" aria-label="계정 탈퇴 확인">
    <p class="user-info-sheet__logout-confirm-copy">
      계정과 내 경로·주행 기록·정복 기록·토큰이 즉시 삭제되며 되돌릴 수 없습니다.
      구독 중이면 해지됩니다. 내가 등록한 퍼블릭 경로는 「탈퇴한 라이더」 이름으로 남습니다.
    </p>
    <label class="user-info-sheet__logout-confirm-copy">
      계속하려면 「탈퇴」를 입력하세요
      <input type="text" class="user-info-sheet__confirm-input" value="${phrase}"
        aria-label="탈퇴 확인 문구" readonly />
    </label>
    <div class="user-info-sheet__logout-confirm-row">
      <button type="button" class="user-info-sheet__btn">취소</button>
      <button type="button" class="user-info-sheet__btn user-info-sheet__btn--danger"
        ${enabled ? "" : "disabled"} title="Delete account">탈퇴</button>
    </div>
  </div>
</div>
</body></html>`;

    await page.setViewportSize({ width: 360, height: 320 });
    await page.setContent(htmlFor("", false));
    await expect(page.getByRole("button", { name: "탈퇴" })).toBeDisabled();
    await page.screenshot({ path: path.join(SHOTS, "02-delete-confirm-disabled.png") });

    await page.setContent(htmlFor("탈퇴", true));
    await expect(page.getByRole("button", { name: "탈퇴" })).toBeEnabled();
    await page.screenshot({ path: path.join(SHOTS, "03-delete-confirm-enabled.png") });
  });
});

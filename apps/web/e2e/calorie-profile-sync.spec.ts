/**
 * 체중·강도 기기 간 동기화 — 「새 기기」 흉내(이 기기 저장값 삭제 + 새로고침) 후에도 서버 값이 돌아오고,
 * 다른 기기에서 바꾼 값이 설정 요약·프로필에 반영되는지 본다. 에뮬레이터 전용.
 *
 * 묶음4: 체중·강도 편집은 주행 설정이 아니라 프로필 수정(시안15). 설정은 읽기 전용 요약 + 「프로필 수정」.
 * 열린 프로필 draft 는 열 때 snapshot — 타 기기 변경은 설정 요약에서 먼저 보고, 프로필을 다시 열어 입력을 확인한다.
 *
 * 실행(apps/web): npm run test:e2e:calorie-profile
 */
import { expect, test, type Locator, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dismissAppIntroIfShown, guestStart } from "./rideEntryHelpers";
import { readGuestUid } from "./readGuestUid";

const defaultOutDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.out/calorie-profile");
const evidenceOverride = process.env.CALORIE_PROFILE_EVIDENCE_DIR?.trim();
const OUT_DIR = evidenceOverride ? path.resolve(evidenceOverride) : defaultOutDir;

const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
const DOCS = `http://${FS_HOST}/v1/projects/boxcycle-dc2df/databases/(default)/documents`;
/** 에뮬레이터 관리자 토큰 — 규칙을 건너뛰고 서버 문서를 직접 본다 */
const ADMIN = { Authorization: "Bearer owner" };

async function readCloud(uid: string): Promise<{ weightKg: number | null; intensityId: string | null } | null> {
  const res = await fetch(`${DOCS}/userPrivate/${uid}`, { headers: ADMIN });
  if (res.status === 404) return null;
  const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  const f = json.fields ?? {};
  const w = f.weightKg;
  const weightKg = w ? Number(w.doubleValue ?? w.integerValue ?? NaN) : null;
  const intensityId = (f.intensityId?.stringValue as string | undefined) ?? null;
  return { weightKg: Number.isFinite(weightKg) ? weightKg : null, intensityId };
}

async function writeCloudAsOtherDevice(uid: string, weightKg: number, intensityId: string): Promise<void> {
  const res = await fetch(`${DOCS}/userPrivate/${uid}`, {
    method: "PATCH",
    headers: { ...ADMIN, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: { weightKg: { doubleValue: weightKg }, intensityId: { stringValue: intensityId } },
    }),
  });
  expect(res.status, await res.text()).toBe(200);
}

async function openSettings(page: Page) {
  const sheet = page.getByRole("dialog", { name: "주행 설정" });
  if (!(await sheet.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Trail 메뉴" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "주행 설정" }).click();
  }
  await expect(sheet).toBeVisible();
  return sheet;
}

async function openProfileFromSettings(page: Page) {
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "프로필 수정" }).click();
  const profile = page.getByRole("dialog", { name: "프로필 수정" });
  await expect(profile).toBeVisible();
  return { settings, profile };
}

async function expectCalorieSummary(settings: Locator, weightKg: number, intensityLabel: string) {
  const row = settings.locator(".ride-settings-panel__calories");
  await expect(row).toContainText(`체중 ${weightKg} kg`);
  await expect(row).toContainText(`체력 ${intensityLabel}`);
}

async function saveCalorieInProfile(
  profile: Locator,
  weight: string,
  intensityName: string,
) {
  await profile.getByLabel("체중(kg)").fill(weight);
  await profile.getByRole("button", { name: intensityName, exact: true }).click();
  await profile.getByRole("button", { name: "저장" }).click();
  await expect(profile).toBeHidden();
}

test.describe("체중·강도 기기 간 동기화", () => {
  test.skip(!/^(127\.0\.0\.1|localhost):/.test(FS_HOST), "Firestore 에뮬레이터 전용");

  test("새 기기에서도 다시 묻지 않는다", async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.goto("/");
    await guestStart(page);
    const uid = await readGuestUid(page);

    // 1) 설정 → 프로필 수정 → 입력·저장 → 서버·설정 요약
    let { profile } = await openProfileFromSettings(page);
    await saveCalorieInProfile(profile, "72", "체력 4");
    await expect.poll(() => readCloud(uid), { timeout: 15_000 }).toEqual({ weightKg: 72, intensityId: "hard" });
    let settings = await openSettings(page);
    await expectCalorieSummary(settings, 72, "4");
    await page.keyboard.press("Escape");

    // 2) 「새 기기」 — 이 기기 저장값을 지우고 새로고침(같은 계정)
    await page.evaluate((u) => localStorage.removeItem(`boxcycle_calorie_profile_v1_${u}`), uid);
    await page.reload();
    await dismissAppIntroIfShown(page);
    const gate = page.getByRole("dialog", { name: "시작" });
    if (await gate.isVisible({ timeout: 5_000 }).catch(() => false)) await guestStart(page);
    expect(await readGuestUid(page)).toBe(uid);
    settings = await openSettings(page);
    await expectCalorieSummary(settings, 72, "4");
    const local = await page.evaluate((u) => localStorage.getItem(`boxcycle_calorie_profile_v1_${u}`), uid);
    expect(JSON.parse(local ?? "{}")).toEqual({ weightKg: 72, intensityId: "hard" });
    await page.screenshot({ path: path.join(OUT_DIR, "restored-on-new-device.png") });

    // 3) 다른 기기에서 바꾸면 설정 요약이 갱신되고, 프로필을 다시 열면 입력도 맞다
    await writeCloudAsOtherDevice(uid, 65.5, "light");
    await expectCalorieSummary(settings, 65.5, "2");
    await page.screenshot({ path: path.join(OUT_DIR, "changed-on-other-device-settings-summary.png") });
    ({ profile } = await openProfileFromSettings(page));
    await expect(profile.getByLabel("체중(kg)")).toHaveValue("65.5", { timeout: 15_000 });
    await expect(profile.getByRole("button", { name: "체력 2", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: path.join(OUT_DIR, "changed-on-other-device.png") });
  });

  test("프로필 수정 메뉴 — 사용자 정보에서 열어 체중·강도를 저장한다", async ({ page }) => {
    test.setTimeout(120_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.goto("/");
    await guestStart(page);
    const uid = await readGuestUid(page);

    await page.getByRole("button", { name: "사용자 정보" }).click();
    const info = page.getByRole("dialog", { name: "사용자 정보" });
    await expect(info).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, "account-sheet-edit-button.png") });
    await info.getByRole("button", { name: "프로필 수정" }).click();

    const sheet = page.getByRole("dialog", { name: "프로필 수정" });
    await expect(sheet).toBeVisible();
    // 게스트는 닉네임 칸 대신 안내
    await expect(sheet.getByLabel("닉네임")).toHaveCount(0);
    await expect(sheet.getByText("게스트는 닉네임이 없습니다", { exact: false })).toBeVisible();

    // 체중이 없으면 70kg 에서 시작한다(Chief 10-26)
    await expect(sheet.getByLabel("체중(kg)")).toHaveValue("70");
    // 잘못된 체중은 저장하지 않는다
    await sheet.getByLabel("체중(kg)").fill("500");
    await sheet.getByRole("button", { name: "저장" }).click();
    await expect(sheet.getByRole("alert")).toContainText("30–300kg");
    await expect(sheet).toBeVisible();

    await sheet.getByLabel("체중(kg)").fill("68.5");
    await sheet.getByRole("button", { name: "체력 3" }).click();
    await page.screenshot({ path: path.join(OUT_DIR, "profile-edit-sheet.png") });
    await sheet.getByRole("button", { name: "저장" }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => readCloud(uid), { timeout: 15_000 }).toEqual({ weightKg: 68.5, intensityId: "moderate" });

    // 다시 열면 저장한 값이 보인다
    await info.getByRole("button", { name: "프로필 수정" }).click();
    await expect(sheet.getByLabel("체중(kg)")).toHaveValue("68.5");
    await expect(sheet.getByRole("button", { name: "체력 3" })).toHaveAttribute("aria-pressed", "true");
    // 취소는 아무것도 바꾸지 않는다
    await sheet.getByLabel("체중(kg)").fill("90");
    await sheet.getByRole("button", { name: "취소" }).click();
    await expect(sheet).toBeHidden();
    await page.waitForTimeout(1_000);
    expect(await readCloud(uid)).toEqual({ weightKg: 68.5, intensityId: "moderate" });
  });
});

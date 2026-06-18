import { cert, getApps, initializeApp } from "firebase-admin/app";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export const DEFAULT_FIREBASE_PROJECT_ID = "boxcycle-dc2df";

/** Firebase CLI OAuth (공개 클라이언트 — firebase-tools 와 동일). */
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

function firebaseToolsConfigPath(): string {
  return resolve(homedir(), ".config", "configstore", "firebase-tools.json");
}

function loadFirebaseCliRefreshToken(): string | null {
  try {
    const raw = readFileSync(firebaseToolsConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as { tokens?: { refresh_token?: string } };
    const token = parsed.tokens?.refresh_token?.trim();
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function writeApplicationDefaultCredentialsFromFirebaseCli(): string | null {
  const refreshToken = loadFirebaseCliRefreshToken();
  if (!refreshToken) return null;
  const cred = {
    type: "authorized_user",
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    refresh_token: refreshToken,
  };
  const dir = resolve(homedir(), ".config", "firebase");
  mkdirSync(dir, { recursive: true });
  const filePath = resolve(dir, "boxcycle_cli_adc.json");
  writeFileSync(filePath, JSON.stringify(cred, undefined, 2), "utf8");
  return filePath;
}

export function initFirebaseAdminForCli(input?: {
  projectId?: string;
  serviceAccountPath?: string;
}): void {
  if (getApps().length > 0) return;

  const projectId =
    input?.projectId?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    DEFAULT_FIREBASE_PROJECT_ID;

  if (input?.serviceAccountPath) {
    const raw = readFileSync(resolve(input.serviceAccountPath), "utf8");
    const parsed = JSON.parse(raw) as Parameters<typeof cert>[0];
    initializeApp({ credential: cert(parsed), projectId });
    return;
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const adcPath = writeApplicationDefaultCredentialsFromFirebaseCli();
    if (adcPath) process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  }

  initializeApp({ projectId });
}

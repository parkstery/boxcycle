import assert from "node:assert/strict";
import test from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import { connectDatabaseEmulator, getDatabase, ref, get, set, goOffline } from "firebase/database";
import { sendThumbsUp, subscribeThumbsUp } from "../../src/lib/ride/repo/rtdbThumbsUp.ts";

const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "";
assert.match(host, /^127\.0\.0\.1:\d+$/, "RTDB 에뮬레이터에서만 실행");
const namespace = "boxcycle-dc2df-default-rtdb";
const base = `http://${host}`;
const clients: ReturnType<typeof initializeApp>[] = [];
function database(uid: string | null) {
  const app = initializeApp({ projectId: "boxcycle-dc2df", apiKey: "emulator", databaseURL: `https://${namespace}.firebaseio.com` }, `thumb-test-${uid ?? "anonymous"}`);
  clients.push(app);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", Number(host.split(":")[1]), uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  return db;
}
async function adminWrite(path: string, value: unknown) {
  const response = await fetch(`${base}/${path}.json?ns=${namespace}`, { method: "PUT", body: JSON.stringify(value), headers: { "content-type": "application/json", authorization: "Bearer owner" } });
  assert.equal(response.status, 200, await response.text());
}
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > deadline) assert.fail("수신 시간 초과"); await new Promise((resolve) => setTimeout(resolve, 25)); }
}

test("엄지척 실제 Rules: 수신자 전용·UID 위조/만료/쿨다운/다른 코스/미래모션 거부, 실제 전송/덮어쓰기/취소", async () => {
  const sender = database("sender"), receiver = database("receiver"), stranger = database("stranger"), unauth = database(null);
  const trail = `thumb-test-${Date.now()}`;
  const motion = (extra = {}) => ({ p: "course", d: 10, v: 5, ph: "live", t: Date.now(), tSrv: Date.now(), ...extra });
  const path = `trails/${trail}/thumbsUp/receiver/sender`;
  const event = (extra = {}) => ({ eventId: crypto.randomUUID(), senderUid: "sender", targetUid: "receiver", senderName: "발신자", side: "right", createdAt: Date.now(), expiresAt: Date.now() + 8000, ...extra });
  const received: string[] = [], errors: Error[] = [];
  let stop = () => {};
  try {
    await adminWrite(`trails/${trail}/motion`, { sender: motion(), receiver: motion() });
    for (const db of [sender, stranger, unauth]) await assert.rejects(get(ref(db, `trails/${trail}/thumbsUp/receiver`)), /permission.denied/i);
    await assert.rejects(set(ref(stranger, path), event()), /permission.denied/i);
    await assert.rejects(set(ref(sender, path), event({ senderUid: "stranger" })), /permission.denied/i);
    await assert.rejects(set(ref(sender, path), event({ expiresAt: Date.now() - 1 })), /permission.denied/i);
    await assert.rejects(set(ref(sender, path), event({ expiresAt: Date.now() + 30000 })), /permission.denied/i);
    await adminWrite(`trails/${trail}/motion/receiver`, motion({ p: "other-course" }));
    await assert.rejects(set(ref(sender, path), event()), /permission.denied/i);
    await adminWrite(`trails/${trail}/motion/receiver`, motion({ tSrv: Date.now() + 60000 }));
    await assert.rejects(set(ref(sender, path), event()), /permission.denied/i);
    await adminWrite(`trails/${trail}/motion/receiver`, motion());
    await adminWrite(`trails/${trail}/motion/sender`, motion({ tSrv: Date.now() + 60000 }));
    await assert.rejects(set(ref(sender, path), event()), /permission.denied/i);
    await adminWrite(`trails/${trail}/motion/sender`, motion({ ph: "paused" }));
    await assert.rejects(set(ref(sender, path), event()), /permission.denied/i);
    await adminWrite(`trails/${trail}/motion/sender`, motion());
    stop = subscribeThumbsUp(trail, "receiver", (value) => received.push(value.eventId), (error) => errors.push(error), receiver);
    const first = await sendThumbsUp(trail, "sender", "receiver", "발신자", sender);
    assert.equal(first.side, "left", "빠른 상대가 왼쪽으로 추월하는 표시 정책과 일치");
    await until(() => received.includes(first.eventId));
    await assert.rejects(sendThumbsUp(trail, "sender", "receiver", "발신자", sender), /permission.denied/i);
    await adminWrite(path, { ...first, createdAt: Date.now() - 4000 });
    const second = await sendThumbsUp(trail, "sender", "receiver", "발신자", sender);
    await until(() => received.includes(second.eventId));
    await adminWrite(path, { ...second, createdAt: Date.now() });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(received.filter((id) => id === second.eventId).length, 1, "동일eventId 중복 금지");
    stop();
    await adminWrite(path, event());
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(received.length, 2, "구독 종료 뒤 수신 금지");
    const expired = event({ expiresAt: Date.now() - 1 });
    await adminWrite(path, expired);
    stop = subscribeThumbsUp(trail, "receiver", (value) => received.push(value.eventId), (error) => errors.push(error), receiver);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(received.length, 2, "재접속 시 만료 인사 제외");
    assert.deepEqual(errors, []);
  } finally {
    stop();
    await adminWrite(`trails/${trail}`, null);
    for (const app of clients) { goOffline(getDatabase(app)); await deleteApp(app); }
  }
});

test("응답(11-28): hi 는 reply 일 때만, reply 는 불리언, 추월자의 👍/👋 응답이 원래 발신자에게 도착", async () => {
  const passed = database("passed"), overtaker = database("overtaker");
  const trail = `thumb-reply-${Date.now()}`;
  const motion = () => ({ p: "course", d: 10, v: 5, ph: "live", t: Date.now(), tSrv: Date.now() });
  const toOvertaker = `trails/${trail}/thumbsUp/overtaker/passed`;
  const event = (extra = {}) => ({ eventId: crypto.randomUUID(), senderUid: "passed", targetUid: "overtaker", senderName: "느린", side: "left", createdAt: Date.now(), expiresAt: Date.now() + 8000, ...extra });
  const got: { kind?: string; reply?: boolean; side: string }[] = [], errors: Error[] = [];
  let stop = () => {};
  try {
    await adminWrite(`trails/${trail}/motion`, { passed: motion(), overtaker: motion() });
    await assert.rejects(set(ref(passed, toOvertaker), event({ kind: "hi" })), /permission.denied/i, "응답이 아닌 hi 거부");
    await assert.rejects(set(ref(passed, toOvertaker), event({ kind: "wave" })), /permission.denied/i, "알 수 없는 kind 거부");
    await assert.rejects(set(ref(passed, toOvertaker), event({ reply: "yes" })), /permission.denied/i, "reply 는 불리언");
    stop = subscribeThumbsUp(trail, "passed", (value) => got.push({ kind: value.kind, reply: value.reply, side: value.side }), (error) => errors.push(error), passed);
    const first = await sendThumbsUp(trail, "passed", "overtaker", "느린", passed);
    assert.equal(first.side, "left"); assert.equal(first.reply, undefined);
    const hi = await sendThumbsUp(trail, "overtaker", "passed", "빠른", overtaker, { kind: "hi", reply: true });
    assert.equal(hi.side, "right", "추월자는 뒤에 남은 상대 쪽(오른쪽)으로 응답");
    await until(() => got.length === 1);
    assert.deepEqual(got[0], { kind: "hi", reply: true, side: "right" });
    await adminWrite(`trails/${trail}/thumbsUp/passed/overtaker`, { ...hi, createdAt: Date.now() - 4000 });
    await sendThumbsUp(trail, "overtaker", "passed", "빠른", overtaker, { kind: "thumb", reply: true, side: "left" });
    await until(() => got.length === 2);
    assert.deepEqual(got[1], { kind: undefined, reply: true, side: "left" }, "실제 비켜간 방향(side 지정)이 그대로 전달");
    assert.deepEqual(errors, []);
  } finally {
    stop();
    await adminWrite(`trails/${trail}`, null);
    for (const db of [passed, overtaker]) { goOffline(db); await deleteApp(db.app); }
  }
});

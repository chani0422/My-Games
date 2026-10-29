const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Account, Monetization } = require("./services.js");
const config = {
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "public-test-key",
};
const session = {
  access_token: "test-access",
  refresh_token: "test-refresh",
  expires_in: 3600,
  user: { id: "user-1", email: "pilot@example.test" },
};
const response = (value, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
test("unconfigured login is disabled and sends no request", async () => {
  let calls = 0;
  const a = new Account(
    {},
    {
      fetch: async () => {
        calls++;
      },
    },
  );
  assert.equal(a.enabled, false);
  await assert.rejects(a.sendCode("pilot@example.test"), /準備中/);
  assert.equal(calls, 0);
});
test("email OTP validates fields and accepts only real provider session responses", async () => {
  const calls = [];
  const a = new Account(config, {
    fetch: async (url, opts) => {
      calls.push([url, JSON.parse(opts.body)]);
      return response(url.endsWith("/verify") ? session : {});
    },
  });
  await assert.rejects(a.sendCode("bad"), /メール/);
  await assert.rejects(a.verifyCode("pilot@example.test", "abc"), /コード/);
  assert.equal(calls.length, 0);
  await a.sendCode("pilot@example.test");
  assert.equal(calls[0][1].create_user, true);
  await a.verifyCode("pilot@example.test", "123456");
  assert.equal(a.user.id, "user-1");
  const invalid = new Account(config, { fetch: async () => response({}) });
  await assert.rejects(
    invalid.verifyCode("pilot@example.test", "123456"),
    /確認できません/,
  );
  assert.equal(invalid.user, null);
});
test("backup operations validate identity, use authenticated per-user row and restore payload", async () => {
  const calls = [];
  const a = new Account(config, {
    fetch: async (url, opts) => {
      calls.push([url, opts]);
      if (url.endsWith("/verify")) return response(session);
      if (url.endsWith("/user")) return response(session.user);
      if (opts.method === "POST") return response(null, 204);
      return response([{ progress: { version: 1, pilot: { credits: 30 } } }]);
    },
  });
  await a.verifyCode("pilot@example.test", "123456");
  await a.saveBackup({ version: 1, pilot: { credits: 10 } });
  const save = calls.find(([url]) => url.includes("on_conflict"));
  assert.equal(JSON.parse(save[1].body).user_id, "user-1");
  assert.equal(save[1].headers.Authorization, "Bearer test-access");
  assert.equal((await a.loadBackup()).progress.pilot.credits, 30);
});
test("expired sessions refresh before authentication and deletion requires current user", async () => {
  const calls = [];
  const a = new Account(config, {
    fetch: async (url) => {
      calls.push(url);
      if (url.includes("grant_type")) return response(session);
      if (url.endsWith("/user")) return response(session.user);
      return response({ deleted: true });
    },
  });
  a.session = { ...session, expires_at: 0 };
  await a.deleteAccount();
  assert.ok(calls[0].includes("grant_type=refresh_token"));
  assert.ok(calls[1].endsWith("/user"));
  assert.ok(calls[2].endsWith("/functions/v1/delete-account"));
  assert.equal(a.user, null);
});
test("failed authentication cannot write backup or delete a different account", async () => {
  let writes = 0;
  const a = new Account(config, {
    fetch: async (url) => {
      if (url.includes("/rest/")) writes++;
      return response({ error: "unauthorized" }, 401);
    },
  });
  a.session = { ...session, expires_at: Date.now() / 1000 + 3600 };
  await assert.rejects(a.saveBackup({}), /有効期限/);
  assert.equal(writes, 0);
});
test("ads and billing are unavailable without providers and server verification", async () => {
  const m = new Monetization();
  assert.equal(m.rewardedAvailable, false);
  assert.equal(m.purchasesAvailable, false);
  assert.equal((await m.rewarded("result", "run")).status, "unavailable");
  assert.equal((await m.purchase("skin")).status, "unavailable");
  const noVerifier = new Monetization({
    billing: {
      purchase() {
        throw Error("must not invoke");
      },
    },
  });
  assert.equal((await noVerifier.purchase("skin")).status, "unavailable");
});
test("cancelled ads and invalid receipts never grant entitlements; transactions are idempotent", async () => {
  let verified = 0;
  const m = new Monetization({
    ads: { showRewarded: async () => ({ status: "cancelled" }) },
    billing: {
      purchase: async () => ({
        status: "completed",
        transactionId: "tx",
        receipt: "receipt",
      }),
    },
    verify: async () => {
      verified++;
      return { verified: true, grantId: "server-grant" };
    },
  });
  assert.equal((await m.rewarded("result", "run")).status, "cancelled");
  assert.equal(verified, 0);
  assert.equal((await m.purchase("skin")).status, "verified");
  assert.equal((await m.purchase("skin")).status, "duplicate");
  assert.equal(verified, 1);
  const invalid = new Monetization({
    billing: m.billing,
    verify: async () => ({ verified: false }),
  });
  assert.equal((await invalid.purchase("skin")).status, "unverified");
});

const { Records } = require("./engine.js");
function recordStorage(data) {
  return {
    value: JSON.stringify(data),
    keys: [],
    getItem() {
      return this.value;
    },
    setItem(key, value) {
      this.keys.push(key);
      this.value = value;
    },
  };
}
test("volume defaults to 1 for new and legacy records without changing scores or a saved OFF", () => {
  for (const legacy of [
    undefined,
    {},
    { best: 49123, last: 35000, sound: false, soundDefaultRevision: 1 },
  ]) {
    const storage = recordStorage(legacy),
      records = new Records(storage);
    assert.equal(records.data.volume, 1);
    assert.equal(records.data.best, legacy?.best || 0);
    assert.equal(records.data.last, legacy?.last || 0);
    assert.equal(
      records.data.sound,
      legacy?.soundDefaultRevision === 1 ? false : true,
    );
    assert.deepEqual(Object.keys(JSON.parse(storage.value)).sort(), [
      "best",
      "last",
      "sound",
      "soundDefaultRevision",
      "volume",
    ]);
    assert.deepEqual([...new Set(storage.keys)], ["star-dodge-v1"]);
  }
});
test("loading volume clamps finite numbers to 0–1 and defaults invalid types to 1", () => {
  for (const [value, expected] of [
    [-5, 0],
    [0, 0],
    [0.375, 0.375],
    [1, 1],
    [5, 1],
  ]) {
    const storage = recordStorage({ volume: value });
    assert.equal(new Records(storage).data.volume, expected);
    assert.equal(JSON.parse(storage.value).volume, expected);
  }
  for (const value of [
    undefined,
    null,
    "0.25",
    true,
    false,
    {},
    [],
    NaN,
    Infinity,
    -Infinity,
  ]) {
    assert.equal(new Records(recordStorage({ volume: value })).data.volume, 1);
  }
});
test("volume is saved immediately, survives reload and score updates, and remains independent of SOUND", () => {
  const storage = recordStorage({
      best: 10000,
      last: 8000,
      sound: true,
      soundDefaultRevision: 1,
    }),
    records = new Records(storage);
  records.setVolume(0.37);
  assert.equal(JSON.parse(storage.value).volume, 0.37);
  records.sound(false);
  records.finish(12000);
  const reloaded = new Records(storage);
  assert.equal(reloaded.data.sound, false);
  assert.equal(reloaded.data.volume, 0.37);
  assert.equal(reloaded.data.best, 12000);
  reloaded.setVolume(0);
  assert.equal(new Records(storage).data.volume, 0);
  reloaded.sound(true);
  assert.equal(new Records(storage).data.volume, 0);
});
test("volume setters validate inputs and keep working when persistence is unavailable", () => {
  const records = new Records(recordStorage());
  for (const [value, expected] of [
    [-1, 0],
    [2, 1],
    [0.25, 0.25],
    [NaN, 1],
    [Infinity, 1],
    ["0.25", 1],
    [null, 1],
  ]) {
    records.setVolume(value);
    assert.equal(records.data.volume, expected);
  }
  const denied = new Records({
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  });
  denied.sound(false);
  denied.setVolume(0.4);
  assert.equal(denied.data.volume, 0.4);
  assert.equal(denied.data.sound, false);
  assert.equal(denied.tabOnly, true);
});

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { fresh } = require("./progression.js");
const base = process.env.STAR_DODGE_URL || "http://127.0.0.1:8001/star-dodge/";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const profile = { ...fresh(), credits: 400, bestMs: 30000 };
    await context.addInitScript((profile) => {
      if (!localStorage.getItem("star-dodge-progress-v1"))
        localStorage.setItem("star-dodge-progress-v1", JSON.stringify(profile));
      let api;
      Object.defineProperty(window, "StarDodge", {
        get: () => api,
        set(value) {
          api = value;
          const Base = value.Game;
          value.Game = class extends Base {
            constructor(...args) {
              super(...args);
              window.testGame = this;
            }
          };
        },
      });
    }, profile);
    await page.clock.install();
    await page.goto(base);
    await page.clock.runFor(50);
    await page.getByRole("button", { name: "機体ハンガー" }).click();
    await page.locator('[data-ship="swift"]').click();
    assert.ok((await page.locator("#home").innerText()).includes("280"));
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "初期スキル強化" }).click();
    for (const id of ["speed", "hull", "multi"])
      await page.locator(`[data-upgrade="${id}"]`).click();
    assert.equal(await page.locator('[data-upgrade="sub"]').isDisabled(), true);
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "チャレンジ" }).click();
    await page.locator('[data-claim="survive30"]').click();
    assert.equal(
      await page.locator('[data-claim="survive30"]').isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "アカウント・保存" }).click();
    assert.ok(
      await page
        .getByRole("button", { name: "メールでログイン · 準備中" })
        .isDisabled(),
    );
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "ショップ" }).click();
    assert.ok(
      await page
        .getByRole("button", { name: "ショップ · 準備中" })
        .isDisabled(),
    );
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "フライト開始" }).click();
    await page.clock.runFor(3300);
    assert.equal(await page.evaluate(() => testGame.player.hp), 3);
    assert.equal(await page.evaluate(() => testGame.player.speed), 345);
    assert.deepEqual(await page.evaluate(() => testGame.levels), {
      speed: 2,
      multi: 2,
      sub: 0,
    });
    // Controlled collision fixture executes the ordinary gameover and reward path.
    await page.evaluate(() => {
      testGame.ticks = 1800;
      testGame.time = 30;
      testGame.rockAt = 100;
      testGame.itemAt = 100;
      testGame.mainAt = 100;
      testGame.player.hp = 1;
      testGame.bullets = [];
      testGame.rocks = [
        {
          x: testGame.player.x,
          y: testGame.player.y,
          radius: 16,
          hp: 999,
          maxHp: 999,
          speed: 0,
          rotation: 0,
          spin: 0,
          shape: Array(10).fill(1),
        },
      ];
    });
    await page.clock.runFor(50);
    assert.equal(await page.evaluate(() => testGame.state), "result");
    assert.ok(
      (await page.locator("#panel .flight-reward").innerText()).includes(
        "+6 CR",
      ),
    );
    const credits = await page.evaluate(
      () => JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
    );
    assert.equal(credits, 96);
    await page.clock.runFor(1000);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
      ),
      96,
    );
    await page.getByRole("button", { name: "ホームへ", exact: true }).click();
    await page.reload();
    await page.clock.runFor(50);
    assert.ok((await page.locator("#home").innerText()).includes("スウィフト"));
    await page.getByRole("button", { name: "フライト開始" }).click();
    assert.equal(await page.evaluate(() => testGame.player.hp), 3);
    assert.deepEqual(await page.evaluate(() => testGame.levels), {
      speed: 2,
      multi: 2,
      sub: 0,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS: home → unlock ship → upgrade skills → claim mission → play → earn once → reload; disabled login/shop behave honestly",
    );
    const offline = await browser.newContext();
    const op = await offline.newPage();
    await op.goto(base);
    await op.evaluate(() => navigator.serviceWorker.ready);
    await op.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offline.setOffline(true);
    await op.reload({ waitUntil: "domcontentloaded" });
    assert.ok(
      await op.getByRole("button", { name: "フライト開始" }).isVisible(),
    );
    await op.getByRole("button", { name: "フライト開始" }).click();
    await op.waitForFunction(() => document.getElementById("overlay").hidden);
    await offline.close();
    console.log(
      "PASS: installed service worker reloads and starts the game offline",
    );
    const auth = await browser.newContext({ serviceWorkers: "block" });
    let backup = null,
      sends = 0,
      deletions = 0;
    await auth.route("**/config.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: 'window.STAR_DODGE_CONFIG={supabaseUrl:"https://test.supabase.co",supabasePublishableKey:"public-test"}',
      }),
    );
    await auth.route("https://test.supabase.co/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          "authorization,apikey,content-type,prefer",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      };
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      let data = {};
      if (path.endsWith("/otp")) sends++;
      if (path.endsWith("/verify"))
        data = {
          access_token: "test-access",
          refresh_token: "test-refresh",
          expires_in: 3600,
          user: { id: "pilot-1", email: "pilot@example.test" },
        };
      if (path.endsWith("/user"))
        data = { id: "pilot-1", email: "pilot@example.test" };
      if (path.includes("pilot_backups")) {
        if (req.method() === "POST") backup = req.postDataJSON();
        else
          data = backup
            ? [
                {
                  progress: backup.progress,
                  updated_at: new Date().toISOString(),
                },
              ]
            : [];
      }
      if (path.endsWith("/delete-account")) deletions++;
      await route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    const ap = await auth.newPage();
    await ap.goto(base);
    await ap.getByRole("button", { name: "アカウント・保存" }).click();
    await ap.getByLabel("メールアドレス").fill("pilot@example.test");
    await ap
      .getByRole("button", { name: "確認コードを送る", exact: true })
      .click();
    await ap
      .getByText("確認コードを送信しました。メールをご確認ください。", {
        exact: true,
      })
      .waitFor();
    assert.equal(sends, 1);
    await ap.getByLabel("確認コード", { exact: true }).fill("123456");
    await ap.getByRole("button", { name: "ログイン", exact: true }).click();
    await ap.getByRole("button", { name: "クラウドにバックアップ" }).click();
    await ap
      .getByText("育成と記録をクラウドに保存しました。", { exact: true })
      .waitFor();
    assert.equal(backup.user_id, "pilot-1");
    await ap.getByRole("button", { name: "バックアップを確認する" }).click();
    await ap.getByRole("button", { name: "このバックアップで復元" }).click();
    await ap.getByText("育成と記録を復元しました。", { exact: true }).waitFor();
    await ap.getByText("アカウントの削除", { exact: true }).click();
    await ap.getByRole("button", { name: "削除の確認へ" }).click();
    await ap
      .getByRole("button", { name: "アカウントを完全に削除する" })
      .click();
    await ap
      .getByText("アカウントとクラウドデータを削除しました。", { exact: true })
      .waitFor();
    assert.equal(deletions, 1);
    assert.ok(
      await ap.getByRole("button", { name: "確認コードを送る" }).isVisible(),
    );
    await auth.close();
    console.log(
      "PASS: mocked Supabase — email OTP UI, backup, explicit restore and authenticated account deletion",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

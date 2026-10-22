/* Optional network adapters. The default game does not contact external services. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarServices = api;
})(globalThis, () => {
  "use strict";
  class Account {
    constructor(
      config = {},
      { fetch: fetcher = globalThis.fetch, storage } = {},
    ) {
      this.fetch = fetcher?.bind(globalThis);
      this.storage = storage;
      this.key = config.supabasePublishableKey || "";
      try {
        const u = new URL(config.supabaseUrl);
        this.url =
          u.protocol === "https:" && !u.username && !u.password ? u.origin : "";
      } catch {
        this.url = "";
      }
      this.enabled = !!(this.url && this.key);
      this.session = null;
      try {
        const s = JSON.parse(storage?.getItem("star-dodge-session") || "null");
        if (
          s &&
          typeof s.access_token === "string" &&
          typeof s.refresh_token === "string"
        )
          this.session = s;
      } catch {}
    }
    get user() {
      return this.session?.user || null;
    }
    persist() {
      try {
        if (this.session)
          this.storage?.setItem(
            "star-dodge-session",
            JSON.stringify(this.session),
          );
        else this.storage?.removeItem("star-dodge-session");
      } catch {}
    }
    async request(
      path,
      { method = "GET", body, authenticated = false, headers = {} } = {},
    ) {
      if (!this.enabled)
        throw Error("アカウント接続は準備中です。ゲストのまま遊べます。");
      const response = await this.fetch(this.url + path, {
        method,
        headers: {
          apikey: this.key,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(authenticated
            ? { Authorization: "Bearer " + this.session?.access_token }
            : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        if (response.status === 401)
          throw Error(
            "ログインの有効期限が切れました。もう一度ログインしてください。",
          );
        if (response.status === 429)
          throw Error("少し時間をおいてから、もう一度お試しください。");
        throw Error(
          "接続できませんでした。コードや接続設定を確認してください。",
        );
      }
      if (
        response.status === 204 ||
        response.headers?.get("content-length") === "0"
      )
        return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    async sendCode(email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw Error("メールアドレスを確認してください。");
      await this.request("/auth/v1/otp", {
        method: "POST",
        body: { email, create_user: true },
      });
    }
    async verifyCode(email, token) {
      if (!/^\d{6,10}$/.test(token))
        throw Error("メールに届いた確認コードを入力してください。");
      const s = await this.request("/auth/v1/verify", {
        method: "POST",
        body: { email, token, type: "email" },
      });
      if (!s?.access_token || !s?.refresh_token || !s?.user?.id)
        throw Error("ログインを確認できませんでした。");
      this.session = {
        ...s,
        expires_at: Date.now() / 1000 + (s.expires_in || 3600),
      };
      this.persist();
      return this.user;
    }
    async authenticate() {
      if (!this.session) throw Error("先にログインしてください。");
      if ((this.session.expires_at || 0) < Date.now() / 1000 + 60) {
        const s = await this.request(
          "/auth/v1/token?grant_type=refresh_token",
          {
            method: "POST",
            body: { refresh_token: this.session.refresh_token },
          },
        );
        if (!s?.access_token || !s?.refresh_token || !s?.user?.id) {
          this.session = null;
          this.persist();
          throw Error("もう一度ログインしてください。");
        }
        this.session = {
          ...s,
          expires_at: Date.now() / 1000 + (s.expires_in || 3600),
        };
        this.persist();
      }
      const user = await this.request("/auth/v1/user", { authenticated: true });
      if (!user?.id) throw Error("ログインを確認できませんでした。");
      this.session.user = user;
      return user;
    }
    async saveBackup(snapshot) {
      const user = await this.authenticate();
      await this.request("/rest/v1/pilot_backups?on_conflict=user_id", {
        method: "POST",
        authenticated: true,
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: { user_id: user.id, progress: snapshot },
      });
    }
    async loadBackup() {
      const user = await this.authenticate();
      const rows = await this.request(
        "/rest/v1/pilot_backups?user_id=eq." +
          encodeURIComponent(user.id) +
          "&select=progress,updated_at",
        { authenticated: true },
      );
      return Array.isArray(rows) ? rows[0] || null : null;
    }
    async logout() {
      try {
        if (this.session)
          await this.request("/auth/v1/logout", {
            method: "POST",
            authenticated: true,
          });
      } catch {
        /* Local sign-out still succeeds when offline. */
      } finally {
        this.session = null;
        this.persist();
      }
    }
    async deleteAccount() {
      await this.authenticate();
      await this.request("/functions/v1/delete-account", {
        method: "POST",
        authenticated: true,
      });
      this.session = null;
      this.persist();
    }
  }
  class Monetization {
    constructor({ ads = null, billing = null, verify = null } = {}) {
      this.ads = ads;
      this.billing = billing;
      this.verify = verify;
      this.busy = false;
      this.transactions = new Set();
    }
    get rewardedAvailable() {
      return !!(this.ads && this.verify);
    }
    get purchasesAvailable() {
      return !!(this.billing && this.verify);
    }
    async transact(kind, payload) {
      if (this.busy) throw Error("処理中です。");
      const provider = kind === "rewarded" ? this.ads : this.billing;
      if (!provider || !this.verify) return { status: "unavailable" };
      this.busy = true;
      try {
        const result =
          kind === "rewarded"
            ? await provider.showRewarded(payload)
            : await provider.purchase(payload);
        if (result?.status !== "completed") return { status: "cancelled" };
        if (
          !result.transactionId ||
          this.transactions.has(result.transactionId)
        )
          return { status: "duplicate" };
        const verified = await this.verify({
          kind,
          transactionId: result.transactionId,
          receipt: result.receipt,
          payload,
        });
        if (!verified?.verified || !verified.grantId)
          return { status: "unverified" };
        this.transactions.add(result.transactionId);
        return { status: "verified", grantId: verified.grantId };
      } finally {
        this.busy = false;
      }
    }
    rewarded(placement, runId) {
      return this.transact("rewarded", { placement, runId });
    }
    purchase(productId) {
      return this.transact("purchase", { productId });
    }
  }
  return { Account, Monetization };
});

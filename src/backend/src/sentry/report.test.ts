import { HttpsError } from "firebase-functions/https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureWithoutWaiting, resetSentryForTest, withSentryReporting } from "./report";

import type { CallableRequest } from "firebase-functions/https";

/**
 * 何をSentryへ送り、何を送らないか([X3])。
 *
 * ここが緩むと、パスワード間違いや入力不備といった**利用者の通常操作**で
 * Sentryが埋まり、本当の障害が埋もれる。逆に締めすぎると、検知したい失敗が消える。
 */

const { init, captureException, flush } = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
}));

vi.mock("@sentry/node", () => ({ init, captureException, flush }));

const request = { data: {} } as CallableRequest;

beforeEach(() => {
  process.env.SENTRY_DSN = "https://examplepublickey@o0.ingest.sentry.io/0";
  resetSentryForTest();
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.SENTRY_DSN;
});

describe("withSentryReporting", () => {
  it("成功したハンドラの戻り値をそのまま返す", async () => {
    const wrapped = withSentryReporting(async () => ({ ok: true }));

    await expect(wrapped(request)).resolves.toEqual({ ok: true });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("想定外の例外を送り、送信完了を待ってから投げ直す", async () => {
    const error = new Error("想定していない失敗");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error);
    expect(flush).toHaveBeenCalled();
  });

  it("クライアントへ返す失敗(HttpsError)は送らない", async () => {
    /*
      パスワード間違いや入力不備は制御フローであって障害ではない。
      ここを送ると利用者の通常操作でSentryが埋まる。
    */
    const error = new HttpsError("unauthenticated", "サインインが必要です");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("HttpsErrorでもinternalは送る(サーバー側が壊れた合図のため)", async () => {
    const error = new HttpsError("internal", "受け付けられませんでした");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("HttpsErrorでもunavailableは送る(依存先へ届かなかった合図のため)", async () => {
    /*
      [X3-4]。このリポジトリの`unavailable`は全て本物の障害を包んでいる —
      再帰削除の失敗・Identity Platformの更新失敗・Resendへの送信失敗など。
      ここを除外していたため、**まさに検知したい障害**が届いていなかった。
    */
    const error = new HttpsError("unavailable", "削除できませんでした", {
      reason: "data-deletion-failed",
    });
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it.each([
    ["invalid-argument", "入力内容を確認してください"],
    ["failed-precondition", "パスワードの入力が必要です"],
    ["permission-denied", "試行回数が多すぎます"],
    ["resource-exhausted", "送信の間隔を空けてください"],
  ] as const)("利用者の通常操作(%s)は送らない", async (code, message) => {
    /* ここが緩むと、通常操作だけで無料枠(5,000件/月)を食い潰す。 */
    const error = new HttpsError(code, message);
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("お問い合わせの送信失敗でflushまで進む(積まれたイベントを取り残さないため)", async () => {
    /*
      [X3-5]の回帰テスト。A11のメール送信が失敗すると、`mailer.ts`が
      `captureWithoutWaiting`でイベントを積み(flushしない)、`contact/functions.ts`が
      `unavailable`のHttpsErrorを投げる。この経路でflushが呼ばれないと、Cloud Functions
      gen2がインスタンスを凍結した場合に**積まれたイベントごと失われる**。
    */
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));
    expect(flush).not.toHaveBeenCalled();

    const error = new HttpsError("unavailable", "問い合わせを送信できませんでした", {
      reason: "send-failed",
    });
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(flush).toHaveBeenCalled();
  });

  it("Sentryへの送信が失敗しても、元の例外をそのまま投げ直す", async () => {
    /* Sentryの都合で呼び出し元のエラーが差し替わってはいけない。 */
    captureException.mockImplementationOnce(() => {
      throw new Error("Sentryが落ちた");
    });
    const error = new Error("元の失敗");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
  });
});

describe("同じ種類のイベントの抑制([X3-6])", () => {
  /*
    無料枠(5,000件/月)を1つの障害で使い切らせないための歯止め。
    `sendContactMessage`(A11)はサインイン不要で叩けるうえ、失敗した呼び出しには
    実質的なレート制限がかかっていない(宛先未設定は送信枠の確保より前で投げ、
    送信失敗は枠を戻す)。枠を戻すのはA11の要件なので、送る側で絞る。

    **締めすぎると検知そのものを落とす**ので、種類ごとの1件目は必ず通ること・
    種類が違えば通ることを、抑制が効くことと同じ重さで固定する。
  */

  afterEach(() => {
    vi.useRealTimers();
  });

  it("同じ種類を続けて投げても2件目は送らない", () => {
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("種類が違えば両方送る(別の障害を取りこぼさないため)", () => {
    /*
      **ステータスコードが種類を分けるのは意図したもの。** 429(レート制限)と
      500(サーバ障害)は別の障害で、どちらも知りたい。そのぶんこの経路の上限は
      「1件/10分」ではなく「ステータスの種類数/10分」になるが、有限の小さな集合で
      頭打ちになる(`report.ts`の`buildSuppressionKey`)。
    */
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 429)"));

    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it("HttpsErrorはコードとdetails.reasonで種類を分ける", () => {
    const unlinkFailed = new HttpsError("unavailable", "解除できませんでした", {
      reason: "unlink-failed",
    });
    const sendFailed = new HttpsError("unavailable", "送信できませんでした", {
      reason: "send-failed",
    });

    captureWithoutWaiting(unlinkFailed);
    captureWithoutWaiting(sendFailed);
    captureWithoutWaiting(sendFailed);

    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it("メッセージに混ざったUID・メールアドレスで種類が割れない", () => {
    /*
      伏せずに判定すると、同じ障害が利用者ごとに別の種類として数えられ、
      利用者の数だけイベントが通る = 抑制が効かなくなる。
    */
    captureWithoutWaiting(new Error("users/abc123def456 を削除できませんでした"));
    captureWithoutWaiting(new Error("users/zzz999yyy888 を削除できませんでした"));

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("String()が投げる値でも、キーの生成で送信ごと落とさない", () => {
    /*
      `withSentryReporting`は**全callableの想定外例外**を通すので、`Error`を継承しない
      値が来ることがある。`Object.create(null)`は`toString`を持たないため`String()`が
      TypeErrorを投げる(`Symbol`は`String()`が特別扱いするので投げない)。
      ここで投げると外側のcatchに落ち、**イベントごと送られなくなる**。
    */
    expect(() => String(Object.create(null) as object)).toThrow(TypeError);

    captureWithoutWaiting(Object.create(null) as object);

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("Errorでないプレーンオブジェクトは1つの種類に丸まる(承知のうえの限界)", () => {
    /*
      `String({a: 1})`も`String({b: 2})`も`[object Object]`になるため、
      **この分岐だけは「別種の障害を取りこぼさない」が成り立たない**。
      内容をキーにすると非有界なキーを作りかねないので、こちらを選んでいる
      (`report.ts`の`buildSuppressionKey`)。挙動を変えるときはこのテストも読むこと。
    */
    captureWithoutWaiting({ reason: "まったく別の失敗A" });
    captureWithoutWaiting({ cause: "まったく別の失敗B" });

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("抑制窓(10分)を過ぎれば、まだ直っていないことが分かるよう再び送る", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T00:00:00Z"));

    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));

    vi.setSystemTime(new Date("2026-08-23T00:09:59Z"));
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));
    expect(captureException).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-08-23T00:10:00Z"));
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  /**
   * 記録を上限まで埋める。
   *
   * 生の例外をそのまま渡す呼び出し元(`withSentryReporting`・`signup-allowlist`・
   * `login-notification`)では、メッセージに毎回変わる値が混ざる例外が続くと
   * こうなりうる。
   */
  const floodSuppressionEntries = (): void => {
    for (let index = 0; index < 200; index += 1) {
      captureWithoutWaiting(new Error(`毎回ちがう失敗 ${index}`));
    }
  };

  it("記録が上限に達しても、既に覚えている種類の抑制は守る", () => {
    /*
      **巻き添えを起こさないための回帰テスト。** 記録をまるごと捨てる作りだと、
      キーが毎回変わる経路が1つあるだけで、無関係な種類の抑制まで巻き戻り、
      抑制が全体で無効になる。うるさい経路が効かないこと自体は許容するが、
      他を道連れにはしない。
    */
    const known = new Error("覚えている失敗");

    captureWithoutWaiting(known);
    floodSuppressionEntries();

    captureException.mockClear();
    captureWithoutWaiting(known);

    expect(captureException).not.toHaveBeenCalled();
  });

  it("上限に達したあとの新しい種類は覚えず、送る側に倒れる", () => {
    /* 監視の記録が監視を止めては困る。覚えられないぶんは毎回送る。 */
    floodSuppressionEntries();

    captureException.mockClear();
    const unknown = new Error("記録しきれない失敗");
    captureWithoutWaiting(unknown);
    captureWithoutWaiting(unknown);

    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it("送信に失敗した種類は抑制しない(送れていないものを送った扱いにしないため)", () => {
    /*
      記録を送信の前に置くと、Sentryが落ちていた10分間ぶんの同じ障害を黙って捨てる。
      送れなかったのだから、次の1件は通さないといけない。
    */
    captureException.mockImplementationOnce(() => {
      throw new Error("Sentryが落ちた");
    });
    const error = new Error("メールを送信できませんでした (status 500)");

    captureWithoutWaiting(error);
    captureException.mockClear();
    captureWithoutWaiting(error);

    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("callable経路で抑制しても、積まれたイベントを押し出すためflushは行う", async () => {
    /*
      [X3-5]で塞いだ穴を、抑制で開け直さないための回帰テスト。
      お問い合わせ経路では`mailer.ts`が`captureWithoutWaiting`でイベントを積むため、
      こちらのHttpsErrorを積まない場合でもflushまで進まないと、
      インスタンスの凍結で積まれたイベントごと失われる。
    */
    const error = new HttpsError("unavailable", "問い合わせを送信できませんでした", {
      reason: "send-failed",
    });
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledTimes(1);

    captureException.mockClear();
    flush.mockClear();

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).not.toHaveBeenCalled();
    expect(flush).toHaveBeenCalled();
  });
});

describe("captureWithoutWaiting", () => {
  it("送信完了を待たない(Blocking Functionsの秒数予算を削らないため)", () => {
    captureWithoutWaiting(new Error("失敗"));

    expect(captureException).toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it("クライアントへ返す失敗(HttpsError)は送らない", () => {
    captureWithoutWaiting(new HttpsError("permission-denied", "許可されていません"));

    expect(captureException).not.toHaveBeenCalled();
  });

  it("HttpsErrorでもunavailableは送る(判定を待つ側と共有しているため)", () => {
    /* [X3-4]。`captureAndWait`と同じ`isExpectedFailure`を通す。 */
    captureWithoutWaiting(new HttpsError("unavailable", "認証基盤に接続できませんでした"));

    expect(captureException).toHaveBeenCalled();
  });

  it("Sentryへの送信が失敗しても例外を投げない(呼び出し元を止めないため)", () => {
    captureException.mockImplementationOnce(() => {
      throw new Error("Sentryが落ちた");
    });

    expect(() => captureWithoutWaiting(new Error("失敗"))).not.toThrow();
  });

  it("DSNが空なら初期化も送信もしない", () => {
    process.env.SENTRY_DSN = "";
    resetSentryForTest();

    captureWithoutWaiting(new Error("失敗"));

    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("初期化は1度だけ(インスタンスが使い回される間に繰り返さない)", () => {
    captureWithoutWaiting(new Error("1回目"));
    captureWithoutWaiting(new Error("2回目"));

    expect(init).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledTimes(2);
  });
});

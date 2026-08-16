/**
 * ベータ期間中のサインアップ制限(docs/auth-login-requirements.md 3.10)。
 *
 * Identity PlatformのBlocking Functions(`beforeUserCreated`)で、あらかじめ承認した
 * メールアドレスだけがアカウントを作成できるようにする。3.6のログイン通知が使っている
 * `beforeUserSignedIn`と同じ仕組みで、こちらは**アカウント作成の直前**に発火し、
 * 例外を投げるとアカウントは作成されない。
 *
 * **プロバイダを問わず発火する。** A1・A4の「Googleで続ける」(3.8)から新規アカウントが
 * 作られる経路も同じ関数で塞がるため、Googleログイン用に別の対策は作らない。
 * ただし**A8 アカウント連携は塞がらない** — 既存のパスワードアカウントにGoogleを連携する
 * 操作はアカウントの作成ではなく、このトリガーは発火しない。連携できるのは既に存在する
 * アカウント = 既に承認済みのアカウントなので、これは意図した挙動である。
 *
 * **ログイン通知(3.6)と拒否の向きが逆である点に注意する。** あちらは失敗してもログインを
 * 止めない(例外を投げない)が、こちらは**拒否することが目的**なので、判断が付かない場合も
 * 含めて拒否側へ倒す。
 *
 * この制限はベータ期間中の運用上の措置であり、恒久的な仕様ではない。外す判断は
 * `noindex`の解除・A0の「現在は招待制」の記述と同じタイミングで行う(3.10)。
 */

import { beforeUserCreated, HttpsError } from "firebase-functions/identity";

import { isSignUpAllowed } from "./store";

import type { AuthBlockingEvent } from "firebase-functions/identity";

/**
 * 拒否時にクライアントへ渡す文言。
 *
 * **どのアドレスなら通るかを含めない。** 許可リストの内容を外から探れる状態にしないため
 * (docs/screen-requirements-auth.md A1「遷移条件」)。
 *
 * **画面にこの文字列がそのまま出ることは期待しない。** Blocking Functionsの例外は
 * クライアントSDKにカスタムメッセージのまま届かず`auth/internal-error`に包まれるため、
 * 表示の文言はフロントエンド側で当てる(3.10「エラーの伝わり方」)。ここに文言を置くのは
 * Cloud Functionsのログと、SDKを介さずREST APIを直接叩いた場合の応答のためである。
 */
const NOT_ALLOWED_MESSAGE =
  "現在、アカウントの作成は招待された方のみに限らせていただいています。";

/**
 * 許可リストを確かめられなかったときの文言。
 *
 * 拒否する点は同じだが、**ログで区別できるように理由を分ける**。「承認されていない」と
 * 「確かめられなかった」を同じ文言にすると、障害が起きていることに気づけない。
 */
const UNAVAILABLE_MESSAGE =
  "アカウントの作成を受け付けられませんでした。時間をおいて再度お試しください。";

/**
 * 作成しようとしているアカウントが承認済みかを確かめ、そうでなければ例外を投げる。
 *
 * イベントのハンドラ本体を関数として切り出してあるのは、`beforeUserCreated`が返す
 * `BlockingFunction`がユニットテスト用の入口を型として公開していないため
 * (`login-notification`と同じ事情)。
 */
export const assertSignUpAllowed = async (event: AuthBlockingEvent): Promise<void> => {
  const email = event.data?.email;

  if (email === undefined || email === "") {
    // メールアドレスを持たないアカウント(電話番号のみ等)。本アプリでは作られない想定だが、
    // **判定の材料が無い以上は拒否する。** 素通りさせると、メールアドレスを持たない経路が
    // そのまま許可リストの抜け道になる
    console.warn("メールアドレスが無いため、アカウントの作成を拒否しました");
    throw new HttpsError("permission-denied", NOT_ALLOWED_MESSAGE);
  }

  let allowed: boolean;

  try {
    allowed = await isSignUpAllowed(email);
  } catch (error) {
    // **読み取りに失敗したら拒否する(fail-closed)。** 遮断が目的の機能なので、障害中に
    // 穴が開く方向へ倒さない。開発者自身はAdmin SDK経由でアカウントを作れるため
    // (Blocking FunctionsはAdmin SDKからの作成では発火しない。3.10)、この判断で
    // 締め出されることはない
    console.error("許可リストを読み取れなかったため、アカウントの作成を拒否しました", error);
    throw new HttpsError("internal", UNAVAILABLE_MESSAGE);
  }

  if (!allowed) {
    // 拒否したアドレスはログに残さない。承認されていない誰かが入力したものであり、
    // 追跡に使う予定も無い第三者のメールアドレスを溜め込まないため
    console.warn("承認されていないメールアドレスのため、アカウントの作成を拒否しました");
    throw new HttpsError("permission-denied", NOT_ALLOWED_MESSAGE);
  }
};

/**
 * アカウント作成の直前に許可リストを確かめるBlocking Function。
 *
 * **例外を握り潰さない。** `sendLoginNotification`が`try`で包んで握り潰しているのと
 * 対照的だが、あちらは「失敗してもログインを止めない」ことが要件で、こちらは
 * 「確かめられなければ作らせない」ことが要件だからである。想定外の例外も
 * そのまま外へ出し、アカウントが作られない側に倒す。
 */
export const restrictSignUpToAllowlist = beforeUserCreated(async (event) => {
  await assertSignUpAllowed(event);
});

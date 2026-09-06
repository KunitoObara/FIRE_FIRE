import { HttpsError } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";

import { sendMail } from "../login-notification/mailer";
import { resolveProjectId } from "../project-id";
import { onCallWithSentry } from "../sentry/report";
import { SENTRY_DSN } from "../sentry/secrets";
import { buildContactMail } from "./message";
import { buildThrottleKey, releaseContactSlot, reserveContactSlot } from "./throttle";

/**
 * お問い合わせフォームの送信(docs/screen-requirements-public.md A11)。
 *
 * A10 プライバシーポリシーが問い合わせ先を掲げる以上、受け口が要る。メールアドレスを直接
 * 載せる案ではなくフォームにしたのはPO判断で、公開リポジトリに個人のアドレスを出さずに済むため。
 *
 * **このアプリで唯一、未ログインから叩けるcallableである。** 他の関数はすべてサインイン済みを
 * 前提にしており、`request.auth`で弾ける。ここは弾けないため、代わりに次の3つで守る。
 *
 * - **ハニーポット**: 画面には出さない入力欄。埋まっていれば機械的な送信とみなす
 * - **送信間隔制限**: 同じ送信元からの連投を拒む(`throttle.ts`)
 * - **入力の長さ制限**: 巨大な本文をそのまま上流へ流さない
 *
 * App Checkはプロジェクト全体の設定作業(コンソール設定・サイトキー・既存callableへの影響)を
 * 伴うため、このカードには入れない。`noindex`と招待制で外部からの流入がほぼ無い現状に見合う
 * 強度から始め、足りなくなったら上げる(PO判断)。**その「足りなくなったか」を判断する材料が
 * 初めて出たため、判断そのものは[X29]に切り出してある** — 2026-08-17にprodのこの関数を叩いた
 * 2件は海外のデータセンターIPからで、ハニーポットにも送信間隔制限にも抵触していない([X27]の調査)。
 *
 * **問い合わせの内容はFirestoreに保存しない**(同じくPO判断)。A10の「取得しない情報」の方針と
 * 揃い、未ログインから書けるFirestoreの領域を増やさずに済む。送信に失敗した場合は画面が再送を促す。
 *
 * **この判断は、実際に問い合わせが失われたあとで見直したうえで維持している**([X27])。prodで
 * 2026-08-17に2件、送信に失敗して消えた — `RESEND_API_KEY`にResendのものではない値が登録されて
 * いたためで([X26])、残ったのは「呼び出しが2回あり、いずれもResendが401を返したためcallableが
 * 503を返した」という記録だけだった。**401と503は別のレイヤーの記録で両立する** — 401はResendが
 * この関数へ返した応答(Cloud Logging)、503はこの関数が呼び出し元へ返した応答
 * (`HttpsError("unavailable")`のHTTPマッピング。Cloud Runのリクエストログ)。本文も返信先の
 * アドレスも復旧できない。**それを踏まえたうえで、保存しないほうを選び直した**。
 *
 * - **失敗に気づく手立てのほうを先に用意してある。** 送信失敗はSentryへ上がる —
 *   `mailer.ts`が`captureWithoutWaiting`でstatusコード付きのイベントを積み、ここが投げる
 *   `unavailable`が`captureAndWait`でflushまで進める([X3-4]・[X3-5]、`sentry/report.ts`)。
 *   **X26で1か月気づけなかったのは、この計装が入る前だったから**であって、保存しない設計の
 *   帰結ではない
 * - **退避先を作ると、未ログインから書けるFirestoreの領域が増える。** いま書けるのは
 *   `contactThrottle`(送信時刻だけ。IPすらハッシュ)に限られる。そこへ本文と返信先アドレスを
 *   置くと、保持期間・削除・`firestore.rules`・A10の記載までを一続きで抱えることになる
 * - **リトライでは防げない。** 実際に起きた失敗は401で、何度送り直しても同じ結果になる
 *
 * **覆すときは、A10「取得しない情報」とA11要件の「保存: しない」を同時に直すこと。** 画面と
 * 要件書が「保存しない」と言ったまま保存する状態を作らない。
 */

/** ResendのAPIキー。ログイン通知と同じシークレットを使い回す(docs/ci-cd-setup.md 5章) */
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

/**
 * 問い合わせの宛先。
 *
 * **リポジトリに書かない。** 開発者本人のアドレスで、このリポジトリは公開されている
 * (CLAUDE.md)。`IDENTITY_PLATFORM_WEB_API_KEY`と同じ理由でSecret Managerに置く —
 * 秘密の値だからではなく、リポジトリに置けない値をCIからの非対話デプロイでも解決するため。
 *
 * Resendの共有ドメインから送るため、**宛先はResendアカウントの登録アドレスに限られる**
 * (`mailer.ts`)。問い合わせの宛先は開発者自身なので、この制約は問題にならない。
 */
const CONTACT_RECIPIENT_EMAIL = defineSecret("CONTACT_RECIPIENT_EMAIL");

/** 本文の上限。長文の相談を弾かない程度に広く、上流へ丸ごと流さない程度には狭く */
const MAX_BODY_LENGTH = 2_000;

/** メールアドレスの上限(RFC 5321のローカル部64 + @ + ドメイン255) */
const MAX_EMAIL_LENGTH = 320;

const contactInputSchema = z.object({
  email: z.string().trim().min(1).max(MAX_EMAIL_LENGTH).email(),
  body: z.string().trim().min(1).max(MAX_BODY_LENGTH),
  /**
   * ハニーポット。画面ではCSSで隠した入力欄に対応し、**人が使う限り空のまま**になる。
   * 値が入っていたら機械的な送信とみなすが、**成功として返す**(下記)。
   */
  website: z.string().optional(),
});

/** 画面が出し分けに使う失敗理由(`src/frontend/src/lib/contact/send-contact-message.ts`が読む) */
type ContactFailureReason =
  /** 送信間隔が空いていない */
  | "throttled"
  /** Resendへ送れなかった */
  | "send-failed"
  /** 宛先かAPIキーが未設定。デプロイ側の不備で、利用者にはやり直しを促すしかない */
  | "not-configured";

const failure = (reason: ContactFailureReason, message: string): HttpsError =>
  new HttpsError(reason === "throttled" ? "resource-exhausted" : "unavailable", message, {
    reason,
  });

/**
 * 確保した送信枠を戻す。**戻せなくても送信の失敗を上書きしない** — 呼び出し元は既に
 * 失敗を返そうとしており、ここでの例外に置き換わると原因が分からなくなる。
 */
const releaseSlotQuietly = async (key: string): Promise<void> => {
  try {
    await releaseContactSlot(key);
  } catch (error) {
    console.error("送信間隔の記録を戻せませんでした", error);
  }
};

/**
 * 問い合わせを1件送る。
 *
 * **ハニーポットに引っかかった送信は、成功として返す。** 弾いたことを伝えると、送信側は
 * 何が検知されたのかを試行錯誤で特定できる。人には起こらない経路なので、正規の利用者が
 * この分岐で不利益を受けることもない。
 */
export const sendContactMessage = onCallWithSentry(
  { secrets: [RESEND_API_KEY, CONTACT_RECIPIENT_EMAIL, SENTRY_DSN] },
  async (request) => {
    const input = contactInputSchema.safeParse(request.data ?? {});

    if (!input.success) {
      throw new HttpsError("invalid-argument", "入力内容を確認してください");
    }

    if (input.data.website !== undefined && input.data.website !== "") {
      console.warn("ハニーポットに入力があったため送信しませんでした");
      return { ok: true };
    }

    const recipient = CONTACT_RECIPIENT_EMAIL.value();

    if (recipient === "") {
      console.error("CONTACT_RECIPIENT_EMAILが未設定のため、問い合わせを送信できませんでした");
      throw failure("not-configured", "問い合わせを送信できませんでした");
    }

    // 送信枠の確保は**送る直前**に行う。設定不備で弾く経路より後ろに置かないと、
    // 送れていないのに枠だけ消費して利用者を待たせることになる
    const now = new Date();
    const throttleKey = buildThrottleKey(request.rawRequest.ip);
    const reservation = await reserveContactSlot(throttleKey, now);

    if (reservation.status === "throttled") {
      throw failure("throttled", "送信の間隔を空けてください");
    }

    const mail = buildContactMail(
      { email: input.data.email, body: input.data.body },
      resolveProjectId(),
      now,
    );

    const result = await sendMail(RESEND_API_KEY.value(), {
      to: recipient,
      subject: mail.subject,
      text: mail.text,
    });

    if (result.status !== "sent") {
      // 送れていない以上、確保した枠は戻す。戻さないと、送れなかった利用者が1分待たされる
      await releaseSlotQuietly(throttleKey);

      if (result.status === "not-configured") {
        console.error("RESEND_API_KEYが未設定、または形式が不正なため、問い合わせを送信できませんでした");
        throw failure("not-configured", "問い合わせを送信できませんでした");
      }

      throw failure("send-failed", "問い合わせを送信できませんでした");
    }

    return { ok: true };
  },
);

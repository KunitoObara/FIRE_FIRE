import { HttpsError, onCall } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";

import { sendMail } from "../login-notification/mailer";
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
 * 強度から始め、足りなくなったら上げる(PO判断)。
 *
 * **問い合わせの内容はFirestoreに保存しない**(同じくPO判断)。A10の「取得しない情報」の方針と
 * 揃い、未ログインから書けるFirestoreの領域を増やさずに済む。送信に失敗した場合は画面が再送を促す。
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

/** 実行中のFirebaseプロジェクトID(`login-notification/functions.ts`と同じ判定) */
const currentProjectId = (): string => {
  const fromEnv =
    process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT;

  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv;
  }

  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG ?? "{}") as { projectId?: string };
    return config.projectId ?? "";
  } catch {
    return "";
  }
};

/**
 * 問い合わせを1件送る。
 *
 * **ハニーポットに引っかかった送信は、成功として返す。** 弾いたことを伝えると、送信側は
 * 何が検知されたのかを試行錯誤で特定できる。人には起こらない経路なので、正規の利用者が
 * この分岐で不利益を受けることもない。
 */
export const sendContactMessage = onCall(
  { secrets: [RESEND_API_KEY, CONTACT_RECIPIENT_EMAIL] },
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
      currentProjectId(),
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
        console.error("RESEND_API_KEYが未設定のため、問い合わせを送信できませんでした");
        throw failure("not-configured", "問い合わせを送信できませんでした");
      }

      throw failure("send-failed", "問い合わせを送信できませんでした");
    }

    return { ok: true };
  },
);

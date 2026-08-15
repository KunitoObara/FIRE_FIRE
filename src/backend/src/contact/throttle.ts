import { createHash } from "node:crypto";

import { getFirestore, Timestamp } from "firebase-admin/firestore";

/**
 * 問い合わせの送信間隔制限(docs/screen-requirements-public.md A11)。
 *
 * 公開面に置く入力欄なので、無対策だと送信先の受信箱が埋まる。App Checkはプロジェクト全体の
 * 設定作業を伴うため、ベータ期間の流入量に見合う強度としてハニーポットと**この間隔制限**から
 * 始める(PO判断。足りなくなったらApp Checkへ上げる)。
 *
 * **メモリ上のカウンタでは足りない。** Cloud Functionsのインスタンスは複数立ち、入れ替わりも
 * するため、プロセスに閉じた記録は素通りされる。Firestoreに1件だけ書いて共有する。
 *
 * **記録するのは送信時刻だけで、問い合わせの内容は保存しない**(PO判断)。
 */

/**
 * 送信間隔の記録先。
 *
 * `mfaRecoveryCodes`・`signupAllowlist`と同じく`firestore.rules`でクライアントからの
 * 読み書きを全面的に拒否する。**未ログインから叩けるcallableが書く唯一の領域**なので、
 * 画面側から触れる余地を残さない。
 */
const CONTACT_THROTTLE_COLLECTION = "contactThrottle";

/**
 * 同じ送信元からの次の送信を受け付けるまでの間隔。
 *
 * 打ち間違いの送り直しを妨げない程度に短く、連投を無意味にする程度には長く、で1分にする。
 */
export const CONTACT_MIN_INTERVAL_MS = 60_000;

/**
 * 送信元を表すキー。
 *
 * **IPアドレスをそのまま保存しない。** 問い合わせに使うだけの値をFirestoreに残す理由が無く、
 * A10「取得しない情報」の方針にも反する。ハッシュにすれば同一性の判定だけができる。
 *
 * IPが取れない環境(ローカルのエミュレータ等)では固定のキーに落ちる。そのぶん間隔制限は
 * 全体で1つになるが、開発時に困る場面が無いので受け入れる。
 */
export const buildThrottleKey = (ipAddress: string | undefined): string =>
  createHash("sha256")
    .update(ipAddress === undefined || ipAddress === "" ? "unknown" : ipAddress)
    .digest("hex");

/** 送信枠の確保の結果 */
export type ReserveContactSlotResult =
  /** 確保できた。送信に失敗したら`releaseContactSlot`で戻す */
  | { status: "reserved" }
  /** 前回の送信から間隔が空いていない */
  | { status: "throttled" };

/**
 * 送信枠を確保する。
 *
 * **判定と記録をトランザクションで1つにする。** 読んでから書くまでを分けると、同時に届いた
 * 複数のリクエストがそろって「間隔が空いている」と判定して全部通る。連投を拒むのが目的なので、
 * 並行して投げられたときにこそ効かないと意味が無い。
 *
 * **失敗したら通す。** 止めたいのは連投であって正規の問い合わせではない。Firestoreの一時的な
 * 不調で問い合わせ経路そのものが閉じるほうが、この機能の失敗としては重い(許可リストの
 * `fail-closed`とは目的が逆なので、倒す向きも逆になる)。
 */
export const reserveContactSlot = async (
  key: string,
  now: Date,
): Promise<ReserveContactSlotResult> => {
  const firestore = getFirestore();
  const ref = firestore.collection(CONTACT_THROTTLE_COLLECTION).doc(key);

  try {
    return await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const lastSentAt = snapshot.get("lastSentAt") as unknown;

      if (
        lastSentAt instanceof Timestamp &&
        now.getTime() - lastSentAt.toMillis() < CONTACT_MIN_INTERVAL_MS
      ) {
        return { status: "throttled" as const };
      }

      transaction.set(ref, { lastSentAt: Timestamp.fromDate(now) });

      return { status: "reserved" as const };
    });
  } catch (error) {
    console.error("送信間隔を確認できませんでした", error);
    return { status: "reserved" };
  }
};

/**
 * 確保した送信枠を戻す。
 *
 * 送信に失敗したときに呼ぶ。戻さないと、**送れなかった利用者が1分待たされる** — 待たせる
 * 理由があるのは送れたときだけである。
 *
 * 失敗しても呼び出し元は何もしない(既に送信自体が失敗している)。
 */
export const releaseContactSlot = async (key: string): Promise<void> => {
  await getFirestore().collection(CONTACT_THROTTLE_COLLECTION).doc(key).delete();
};

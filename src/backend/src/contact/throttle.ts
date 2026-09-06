import { createHash } from "node:crypto";

import { getFirestore, Timestamp } from "firebase-admin/firestore";

/**
 * 問い合わせの送信量制限(docs/screen-requirements-public.md A11)。
 *
 * 公開面に置く入力欄なので、無対策だと送信先の受信箱が埋まる。App Checkはプロジェクト全体の
 * 設定作業を伴うため、ベータ期間の流入量に見合う強度としてハニーポットと**この制限**から
 * 始める(PO判断)。
 *
 * **制限は2つある。**
 *
 * - **送信間隔**(`CONTACT_MIN_INTERVAL_MS`) — 連投を拒む
 * - **24時間あたりの件数**(`CONTACT_MAX_PER_WINDOW`) — 間隔を空けた反復を拒む。[X29]で追加
 *
 * 間隔制限だけでは、1分以上空けて叩き続ける送信を止められない。実際に観測された2件
 * ([X27]の調査。2026-08-17にprodへ海外のデータセンターIPから)は6時間以上空いており、
 * **間隔制限には抵触していなかった**。件数の上限はその形の送信に効く。
 *
 * **ただし、観測された2件は互いに別のIPからだった。** 送信元を変えられると、IPを鍵にした
 * 制限はどちらも迂回される。**この上限は「同じ送信元からの反復」しか止められない**ものとして
 * 入れてあり、それ以上を求めるならApp Checkになる — [X29]でPOが「まだ入れない」と判断し、
 * 代わりに再検討の目安(呼び出しが1日3件、または1週間10件)と観測手段を
 * docs/ci-cd-setup.md 16章に残してある。
 *
 * **メモリ上のカウンタでは足りない。** Cloud Functionsのインスタンスは複数立ち、入れ替わりも
 * するため、プロセスに閉じた記録は素通りされる。Firestoreに1件だけ書いて共有する。
 *
 * **記録するのは送信時刻と件数だけで、問い合わせの内容は保存しない**(PO判断)。
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
 * 1つの送信元から受け付ける、窓あたりの件数の上限。
 *
 * 問い合わせを1通送り、書き直しや追記を数通送る余地は残しつつ、機械的な反復は止める線として
 * 5件にする(PO判断)。**再検討の目安(1日3件)より上に置いてある** — 先に鳴るのは
 * アラートのほうで、この上限が実際に働く前に人が判断できる。
 */
export const CONTACT_MAX_PER_WINDOW = 5;

/**
 * 件数を数える窓の長さ。
 *
 * **暦日ではなく「その窓で最初に送れた時刻から24時間」にする。** 暦日にすると日付の境目を
 * どのタイムゾーンで引くかを決めることになり、境目をまたいだ瞬間に上限が戻る。窓を送信側に
 * 合わせて動かせば、どちらも考えずに済む。
 */
export const CONTACT_WINDOW_MS = 24 * 60 * 60 * 1_000;

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

/**
 * 確保できなかった理由。
 *
 * **画面には出さない。** 利用者にとっては「時間をおいてやり直す」で同じなので、callableは
 * どちらも`throttled`として返す(`functions.ts`)。**分けてあるのはログのため** — どちらの
 * 制限が働いたのかが分からないと、[X29]で足した件数の上限が実際に効いているのかを
 * 後から確かめられない。
 */
export type ThrottleReason =
  /** 前回の送信から`CONTACT_MIN_INTERVAL_MS`が経っていない */
  | "interval"
  /** 窓の中で`CONTACT_MAX_PER_WINDOW`件に達している */
  | "window";

/** 送信枠の確保の結果 */
export type ReserveContactSlotResult =
  /** 確保できた。送信に失敗したら`releaseContactSlot`で戻す */
  | { status: "reserved" }
  /** 送信量の制限に抵触した */
  | { status: "throttled"; reason: ThrottleReason };

/**
 * 送信枠を確保する。
 *
 * **判定と記録をトランザクションで1つにする。** 読んでから書くまでを分けると、同時に届いた
 * 複数のリクエストがそろって「間隔が空いている」と判定して全部通る。連投を拒むのが目的なので、
 * 並行して投げられたときにこそ効かないと意味が無い。
 *
 * **失敗したら通す。** 止めたいのは連投であって正規の問い合わせではない。Firestoreの一時的な
 * 不調で問い合わせ経路そのものが閉じるほうが、この機能の失敗としては重い(許可リストの
 * `fail-closed`とは目的が逆なので、倒す向きも逆になる)。**保存された値の形が違うときも同じ
 * 向きに倒す** — 読めない記録で送信経路を閉じない。
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
        return { status: "throttled" as const, reason: "interval" as const };
      }

      const storedWindowStartedAt = snapshot.get("windowStartedAt") as unknown;
      // 窓が閉じていれば、この送信を起点に新しい窓を開く
      const windowStartedAt =
        storedWindowStartedAt instanceof Timestamp &&
        now.getTime() - storedWindowStartedAt.toMillis() < CONTACT_WINDOW_MS
          ? storedWindowStartedAt
          : undefined;
      const storedSentCount = snapshot.get("sentCount") as unknown;
      // `Number.isFinite`まで見る。`NaN`だと`NaN >= 上限`が偽になり、**上限の判定が
      // エラーも出さず素通りしたうえで`NaN + 1`を書き戻す** — 以後この送信元には
      // 二度と効かなくなる。0として扱えば次の書き込みで数値に戻る
      const sentCount =
        windowStartedAt !== undefined && typeof storedSentCount === "number" && Number.isFinite(storedSentCount)
          ? storedSentCount
          : 0;

      if (sentCount >= CONTACT_MAX_PER_WINDOW) {
        return { status: "throttled" as const, reason: "window" as const };
      }

      transaction.set(ref, {
        lastSentAt: Timestamp.fromDate(now),
        windowStartedAt: windowStartedAt ?? Timestamp.fromDate(now),
        sentCount: sentCount + 1,
      });

      return { status: "reserved" as const };
    });
  } catch (error) {
    console.error("送信量の制限を確認できませんでした", error);
    return { status: "reserved" };
  }
};

/**
 * 確保した送信枠を戻す。
 *
 * 送信に失敗したときに呼ぶ。戻さないと、**送れなかった利用者が1分待たされる** — 待たせる
 * 理由があるのは送れたときだけである。
 *
 * **記録ごと消さず、件数を1つ戻す。** 消すと窓もカウントも初期化され、**送信に失敗させ続けれ
 * ば24時間の上限がいくらでも巻き戻せる**。数えるのは送れた分だけなので、この送信の分だけを
 * 引き、窓の起点は残す。件数が0になったら覚えておくことが無いので、そのとき初めて消す。
 *
 * `lastSentAt`は書き戻さない。`set`はマージしないため、`windowStartedAt`と`sentCount`だけを
 * 書けばフィールドごと消える — これが「1分待たせない」の実体である。
 *
 * 失敗しても呼び出し元は何もしない(既に送信自体が失敗している)。
 */
export const releaseContactSlot = async (key: string): Promise<void> => {
  const firestore = getFirestore();
  const ref = firestore.collection(CONTACT_THROTTLE_COLLECTION).doc(key);

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const storedSentCount = snapshot.get("sentCount") as unknown;
    const windowStartedAt = snapshot.get("windowStartedAt") as unknown;

    // `NaN`は`<= 1`が偽になるので、明示的に弾かないと`NaN - 1`を書き戻すことになる
    if (
      typeof storedSentCount !== "number" ||
      !Number.isFinite(storedSentCount) ||
      storedSentCount <= 1 ||
      !(windowStartedAt instanceof Timestamp)
    ) {
      transaction.delete(ref);
      return;
    }

    transaction.set(ref, { windowStartedAt, sentCount: storedSentCount - 1 });
  });
};

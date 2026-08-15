import { LegalDocument } from "@/components/public/LegalDocument";
import { CONTACT_PREPARING_NOTICE } from "@/constants/public";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "プライバシーポリシー | FIRE-FIRE",
};

/**
 * A10 プライバシーポリシー画面(docs/screen-requirements-public.md A10)。
 *
 * A9と同じく文面は雛形で、公開前にPOが内容を確認する。ただし
 * **「取得する情報」「取得しない情報」「外部サービスの利用」の3項は実装から来る事実**であり、
 * 実装を変えたらこちらも直す。
 *
 * - 取得する情報 — Firebase Authentication と `users/{uid}` 配下のFirestore
 * - 取得しない情報 — 生CSVを保存しない(要件定義書 4.2)。ブラウザ内で解析し数値だけを保存する
 * - 外部サービス — Google(Firebase / Google Cloud。認証はIdentity Platform)と
 *   Resend(ログイン通知メール。`src/backend/src/login-notification`)
 *
 * 「取得しない情報」を独立した項にしているのは、扱うのが資産データであるだけに、生CSVを
 * 保存しない設計が利用者にとって最も知りたい部分になるためである。
 */
const PrivacyPage = (): JSX.Element => (
  <LegalDocument title="プライバシーポリシー">
    <p>
      FIRE-FIRE(以下「本サービス」)は、利用者の個人情報および本サービスに登録されたデータの取扱いについて、以下のとおり定めます。
    </p>

    <h2>1. 取得する情報</h2>
    <ul>
      <li>
        <strong>メールアドレス</strong>(アカウント登録時)
      </li>
      <li>
        <strong>Googleアカウントの情報</strong>
        (Googleでログインする場合。メールアドレス・表示名等)
      </li>
      <li>
        <strong>ログインに関する情報</strong>(ログイン日時、接続元の情報等)
      </li>
      <li>
        <strong>利用者が入力・取り込んだデータ</strong>
        (資産残高、入出金明細、不動産、負債、FIRE目標、想定利回り等)
      </li>
    </ul>

    <h2>2. 取得しない情報</h2>
    <p>
      <strong>取り込んだCSVファイルそのものは保存していません。</strong>
      CSVファイルは利用者のブラウザ内で解析され、集計に必要な数値のみがデータベースに保存されます。ファイル自体がサーバーへアップロードされることはありません。
    </p>
    <p>
      また、本サービスは金融機関のIDやパスワードを預かりません。金融機関への接続は行わず、利用者がエクスポートしたファイルを受け取る形のみを採っています。
    </p>

    <h2>3. 利用目的</h2>
    <ul>
      <li>本サービスの提供、表示、集計のため</li>
      <li>ログイン通知メールの送信など、アカウントの安全確保のため</li>
      <li>不具合の調査および不正利用の防止のため</li>
    </ul>
    <p>本サービスは、取得した情報を広告配信および広告目的の分析には利用しません。</p>

    <h2>4. 外部サービスの利用</h2>
    <p>本サービスは、提供にあたり次の外部サービスを利用しています。</p>
    <ul>
      <li>
        <strong>Google(Firebase / Google Cloud)</strong> —
        認証、データの保管、アプリケーションの配信
      </li>
      <li>
        <strong>Resend</strong> — ログイン通知メールの送信
      </li>
    </ul>
    <p>
      いずれも本サービスの提供に必要な範囲で利用するものであり、これら以外の第三者へ個人情報を提供することはありません。ただし、法令に基づく開示の求めがある場合を除きます。
    </p>

    <h2>5. データの保管と削除</h2>
    <ol>
      <li>
        登録データは、アカウントごとに分離して保管し、他の利用者から参照できないよう制御しています。
      </li>
      {/*
        削除できる範囲を実装に合わせて書く。資産分類・不動産・負債には画面から削除する操作が
        あるが(`category-axis-repository.ts` / `property-repository.ts` / `debt-repository.ts`)、
        CSVから取り込んだ資産残高履歴と入出金明細は参照専用で削除の口が無い
        (docs/transaction-import-requirements.md・docs/screen-requirements-dashboard.md)。
      */}
      <li>
        利用者は、本サービス上の操作により、資産分類・不動産・負債の登録データを削除できます。
        <strong>
          CSVから取り込んだ資産残高および入出金明細は参照専用のため、画面からは削除できません
        </strong>
        (取り込み直しによる上書きのみ可能です)。
      </li>
      {/*
        アカウントの削除は登録データの削除とは別物で、実行手段が問い合わせしか無い
        (`deleteUser` 相当の機能も、B10の導線も実装が無い)。**上の操作は代替にならない**ため、
        受け口が準備中であることをそのまま書く。手段の用意は [X4]・[X6]・[X7]。
      */}
      <li>
        登録データの削除と、アカウントそのもの(メールアドレス・認証情報を含む)の削除は別のお求めです。アカウントの削除を希望する場合は、8のお問い合わせ先までご連絡ください。
        <strong>
          お問い合わせ先の用意ができるまでの間は、アカウントの削除のお求めをお受けできません。
        </strong>
      </li>
    </ol>

    <h2>6. Cookie等の利用</h2>
    <p>
      本サービスは、ログイン状態の保持のためにCookieおよびブラウザのストレージを利用します。広告目的のトラッキングには利用していません。
    </p>

    <h2>7. 安全管理</h2>
    <p>
      本サービスは、認証および2要素認証を必須とし、データベース側のアクセス制御によって、利用者本人以外が登録データを参照できないようにしています。
    </p>

    <h2>8. お問い合わせ先</h2>
    <p>{CONTACT_PREPARING_NOTICE}</p>

    <h2>9. 本ポリシーの変更</h2>
    <p>
      本サービスは、必要と判断した場合、本ポリシーを変更することができます。変更後のポリシーは、本サービス上に掲示した時点から効力を生じるものとします。
    </p>

    <p className="mt-10">以上</p>
  </LegalDocument>
);

export default PrivacyPage;

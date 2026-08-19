/**
 * 公開画面(A0・A9・A10・A11・A12)の固定文言(docs/screen-requirements-public.md)。
 *
 * 5画面が同じヘッダー・フッターを共有するため、コピーライトのような複数画面に出る文言は
 * ここに集約する。規約・ポリシーの本文そのものは各画面のJSXに置く(条文の順序と本文が
 * 離れると読みにくくなるため)。
 */

import { Building2, ChartNoAxesCombined, PieChart, Target } from "lucide-react";

import { FIREBASE_CONFIGURATION_MESSAGE } from "@/constants/auth";

/** フッターのコピーライト表記。公開画面の5つで共通 */
export const COPYRIGHT_NOTICE = "© 2026 FIRE-FIRE";

/**
 * A0の「できること」に並べる機能(docs/screen-requirements-public.md A0)。
 *
 * **載せるのは実装済みの機能だけ。** Phase 5〜7(サブスク・証券口座・マイナポータル連携)は
 * 書かず、「近日公開」の予告も置かない — 出さないかもしれないものを載せると、ベータ版で
 * あることの説明と衝突する。
 *
 * **CSV取込はここに入れない。** 取込は手段であって価値ではなく、それは「使い方」の1ステップ目で
 * 説明する。要件が挙げている4つと対応は次のとおり。
 *
 * | 見出し | 対応する機能 |
 * |---|---|
 * | 資産の推移を1枚で見る | 資産推移グラフ(要件定義書 4.4) |
 * | 分類の切り口を自分で決める | 資産分類マスタ(4.3) |
 * | 不動産と負債まで含めて数える | 不動産の利ざや(4.5)・負債(4.8) |
 * | FIRE到達予測日が出る | FIRE目標・達成度・到達予測日(4.6) |
 */
export const TOP_FEATURES: TopFeature[] = [
  {
    id: "asset-trend",
    icon: ChartNoAxesCombined,
    title: "資産の推移を1枚で見る",
    description:
      "資産種別ごとの積み上げグラフで、これまでの動きをまとめて確認できます。負債を差し引いた表示にも切り替えられます。",
  },
  {
    id: "category-axes",
    icon: PieChart,
    title: "分類の切り口を自分で決める",
    description:
      "総資産・純金融資産・投資性資産といった集計の軸は、決め打ちではなく自分で作れます。見たい単位が人によって違うためです。",
  },
  {
    id: "real-estate-debt",
    icon: Building2,
    title: "不動産と負債まで含めて数える",
    description:
      "物件の時価とローン残高から利ざやを自動計算し、住宅ローンなどの負債と合わせて、純資産としての姿を出します。",
  },
  {
    id: "fire-projection",
    icon: Target,
    title: "FIRE到達予測日が出る",
    description:
      "目標額は直接の指定でも、年間支出からの逆算(4%ルール等)でも設定できます。毎月の積立額と想定利回りから到達予測日を算出します。",
  },
];

/**
 * A0の「使い方」の3ステップ(docs/screen-requirements-public.md A0)。
 *
 * **1ステップ目でマネーフォワードを前提として明記する。** このアプリは他サービスがエクスポート
 * したものを再構成する道具であって、家計簿そのものではない(要件定義書 1.1)。それを伏せて
 * 登録させると、登録した人が最初に詰まる。
 */
export const TOP_STEPS: TopStep[] = [
  {
    id: "export",
    title: "マネーフォワードからCSVをエクスポートする",
    description: "資産残高推移と、収入・支出詳細の2種類に対応しています。",
  },
  {
    id: "import",
    title: "FIRE-FIREに取り込む",
    description:
      "取込前に件数と期間のプレビューを出します。CSVファイル自体はサーバーに保存しません。",
  },
  {
    id: "dashboard",
    title: "ダッシュボードで見る",
    description: "資産推移・分類別内訳・収支サマリ・FIRE達成度が、取り込んだ時点の数字で並びます。",
  },
];

/**
 * A0の「ご利用にあたって」に並べる注意(docs/screen-requirements-public.md A0)。
 *
 * ベータ版であることはヒーローのバッジとこのセクションの**2箇所**に書く。バッジだけだと
 * 読み飛ばされ、セクションだけだと画面を下までスクロールした人にしか届かない。
 *
 * データ消失の明記は、A9 利用規約 第4条と揃える(片方だけに書くと、どちらが本当かが読めない)。
 */
export const TOP_BETA_NOTES: TopBetaNote[] = [
  {
    id: "in-development",
    lead: "開発中のサービスです。",
    body: "画面や仕様は予告なく変わることがあります。",
  },
  {
    id: "data-loss",
    lead: "データが失われる可能性があります。",
    body: "取り込み元のCSVはお手元で保管してください(取り込んだCSVファイル自体はサーバーに保存していません)。",
  },
  {
    id: "invite-only",
    lead: "現在は招待制です。",
    body: "お受けできる登録の数を限らせていただいています。",
  },
  {
    id: "not-advice",
    lead: "投資助言を行うものではありません。",
    body: "表示される金額・予測は、ご自身で入力・取り込んだデータをもとにした計算結果です。",
  },
];

/**
 * サインアップの導線に添える注記。
 *
 * **ボタンは置いたうえで期待値だけ先に伝える**(docs/screen-requirements-public.md A0)。
 * ボタンを消すと、招待された人が入口を探すことになる。登録の案内なのでログイン中は出さない。
 *
 * 実際の遮断は認証基盤側で行う(`beforeUserCreated` による事前承認制。X5)。この画面が
 * 置くのは表示だけである。
 */
export const INVITE_ONLY_NOTICE = "現在はベータ版のため、登録は招待制で運用しています。";

/**
 * A9・A10の制定日・最終改定日。
 *
 * **文面そのものは雛形で、公開前にPOが内容を確認する**(docs/screen-requirements-public.md
 * A9・A10)。日付だけは掲示を始める日を入れてあり、本文を改定したときはここを直す。
 * 2画面に同じ日付が出るため、片方だけ古くならないよう定数を共有する。
 */
export const LEGAL_ENACTED_ON = "2026年8月15日";
/** 最終改定日。制定以降まだ改定していないため制定日と同じ */
export const LEGAL_LAST_REVISED_ON = LEGAL_ENACTED_ON;

/**
 * A10からA11 お問い合わせ画面への案内([X6])。
 *
 * **メールアドレスは載せない。** このリポジトリは公開されており、開発者本人のアドレスを
 * 書けない(CLAUDE.md)。取得済みドメイン(`fire-fire.live`)のアドレス整備はドメイン接続と
 * セットの作業で [X4] に切り出してあるが、**それを待たずに受け口を持てる**のがフォームを
 * 用意した理由で、宛先はサーバー側のシークレットにだけ置く
 * (`src/backend/src/contact/functions.ts`)。
 *
 * 文言を3つに割っているのは、真ん中をA11へのリンクにするため(文中リンクを本文ごと
 * JSXに書くと、A10のJSXに文言が戻ってしまう)。
 */
export const CONTACT_NOTICE_PREFIX = "本ポリシーに関するお問い合わせは、";
export const CONTACT_NOTICE_LINK_LABEL = "お問い合わせフォーム";
export const CONTACT_NOTICE_SUFFIX = "からご連絡ください。";

/** A0のフッターからA11へのリンク文言 */
export const CONTACT_LINK_LABEL = "お問い合わせ";

/** A11 お問い合わせ画面の見出しと説明(docs/screen-requirements-public.md A11) */
export const CONTACT_TITLE = "お問い合わせ";
export const CONTACT_DESCRIPTION =
  "本サービスについてのご質問・ご要望・不具合のご連絡は、こちらからお送りください。いただいた内容には、ご入力のメールアドレス宛にご返信します。";

/**
 * ベータ版であることの但し書き。
 *
 * **返信の期限を約束しない。** 開発者1人で運用しているため(CLAUDE.md「Single-user」)、
 * 「◯営業日以内」と書くと守れない日が出る。
 */
export const CONTACT_BETA_NOTICE = "ベータ版のため、ご返信までお時間をいただくことがあります。";

/** 送信できたときの文言。画面は遷移せず、この文言に切り替える */
export const CONTACT_SENT_MESSAGE =
  "お問い合わせを送信しました。ご返信までしばらくお待ちください。";

/**
 * 送信できなかったときの文言(`src/lib/contact/send-contact-message.ts`の失敗理由)。
 *
 * `throttled`だけは利用者の操作で解消できるので、待てばよいことまで書く。それ以外は
 * 利用者にできることが無いため、原因を細かく述べずやり直しを促す。
 */
export const CONTACT_FAILURE_MESSAGES: Record<ContactFailureReason, string> = {
  throttled: "続けての送信はお受けできません。1分ほどおいてから、もう一度お試しください。",
  "send-failed": "お問い合わせを送信できませんでした。時間をおいて再度お試しください。",
  // 宛先・APIキーの設定漏れ。入力をやり直しても直らないが、原因が利用者側に無いことは伝える
  "not-configured":
    "お問い合わせを受け付けられませんでした。サービス側の問題のため、時間をおいて再度お試しください。",
  "invalid-argument": "入力内容をご確認のうえ、もう一度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unavailable: "お問い合わせを送信できませんでした。時間をおいて再度お試しください。",
  unknown: "お問い合わせを送信できませんでした。時間をおいて再度お試しください。",
};

/**
 * B10でアカウントを削除した直後にA0で1回だけ出す文言
 * (docs/auth-login-requirements.md 3.11)。
 *
 * **再登録には招待が要ることまで書く。** 許可リストの該当ドキュメントも削除するため、
 * 同じメールアドレスでもそのままでは登録し直せない(同3.10)。書かないと、登録できない
 * 理由が分からないままA1で弾かれることになる。
 */
export const ACCOUNT_DELETED_NOTICE =
  "アカウントとデータを削除しました。ご利用ありがとうございました。再度ご利用になる場合は、あらためて招待をお受けください。";

/** A0のフッターからA12へのリンク文言 */
export const HELP_LINK_LABEL = "ヘルプ";

/** A12 ヘルプページの見出しと説明(docs/screen-requirements-public.md A12) */
export const HELP_TITLE = "ヘルプ";
export const HELP_DESCRIPTION = "使い方・よくある質問・用語集をまとめています。";

/**
 * A12「使い方」の手順(docs/screen-requirements-public.md A12)。
 *
 * A0の「使い方」(`TOP_STEPS`)は登録前の訪問者への3行の要約で、こちらは実際に使う手順を
 * もう少し詳しく書く。ステップの粒度が違うため`TOP_STEPS`を流用しない。
 */
export const HELP_USAGE_STEPS: HelpUsageStep[] = [
  {
    id: "export",
    title: "マネーフォワードからCSVをエクスポートする",
    description: "「資産残高推移」と「収入・支出詳細」の2種類に対応しています。",
  },
  {
    id: "import",
    title: "CSV取込画面で取り込む",
    description:
      "取込前に件数と期間のプレビューを表示します。ファイル自体はサーバーには保存しません。",
  },
  {
    id: "dashboard",
    title: "ダッシュボードで資産の推移とFIRE達成度を確認する",
    description:
      "資産推移・分類別内訳・収支サマリ・FIRE達成度ゲージが、取り込んだ時点の数字で並びます。",
  },
  {
    id: "fire-goal",
    title: "FIRE目標を設定する",
    description:
      "目標資産額と、毎月の積立額・想定利回りを登録すると、ダッシュボードに到達予測日が表示されます。",
  },
];

/**
 * A12「よくある質問」(docs/screen-requirements-public.md A12)。
 *
 * 問い合わせが増えそうな項目から採る。ここに載っていない・個別の回答が要る用件は、A11
 * お問い合わせフォームへ誘導する。
 */
export const HELP_FAQ_ITEMS: HelpFaqItem[] = [
  {
    id: "csv-source",
    question: "マネーフォワード以外のサービスのCSVは取り込めますか?",
    answer:
      "現在対応しているのは、マネーフォワードが出力する「資産残高推移」と「収入・支出詳細」の2種類のみです。",
  },
  {
    id: "csv-storage",
    question: "取り込んだCSVファイルそのものは保存されますか?",
    answer:
      "保存されません。ファイルはブラウザ内で解析し、集計に必要な数値だけをデータベースに保存します(詳しくはプライバシーポリシーをご覧ください)。",
  },
  {
    id: "accuracy",
    question: "表示されている金額やFIRE到達予測日は正確ですか?",
    answer:
      "ご自身が入力・取り込んだデータと、ご自身が設定した想定利回り等の前提に基づく計算結果です。将来の結果を保証するものではなく、投資助言ではありません。",
  },
  {
    id: "forgot-password",
    question: "パスワードを忘れてしまいました",
    answer:
      "ログイン画面の「パスワードをお忘れの方」から再設定できます。Googleでログインしている場合は、Googleアカウント側でパスワードを管理してください。",
  },
  {
    id: "lost-authenticator",
    question: "2段階認証の認証アプリを機種変更・紛失しました",
    answer:
      "発行済みのリカバリーコードでログインでき、ログイン後に2段階認証を登録し直せます。リカバリーコードも失った場合は、お問い合わせフォームからご連絡ください。",
  },
  {
    id: "delete-account",
    question: "アカウントを削除したい",
    answer:
      "ログイン後、アカウント設定画面からご自身で削除できます。Googleのみでログインしているアカウントは画面から削除できないため、お問い合わせフォームからご連絡ください。",
  },
];

/**
 * A12「用語集」(docs/screen-requirements-public.md A12)。
 *
 * ダッシュボード等の画面に出てくる用語のうち、初見では意味が読み取りにくいものだけを載せる。
 * **資産分類そのもの(純金融資産・投資性資産等)は説明しない。** B4でユーザーが自由に作れる
 * 編集可能なマスタデータであり(要件定義書 4.3)、固定の用語集に載せると決め打ちに見える。
 * ここでは「分類軸」という仕組みの説明にとどめる。
 */
export const HELP_GLOSSARY_TERMS: HelpGlossaryTerm[] = [
  {
    id: "category-axis",
    term: "分類軸",
    description:
      "資産をどの単位で集計するかの切り口です。総資産のほか、純金融資産・投資性資産のように自分で作った単位に切り替えて見られます(資産分類マスタで登録)。",
  },
  {
    id: "total-assets",
    term: "総資産(マネーフォワードの合計)",
    description:
      "分類軸を1つも選んでいない、既定の集計単位です。マネーフォワードの合計をそのまま使います。",
  },
  {
    id: "spread",
    term: "利ざや",
    description:
      "不動産の時価からローン残高を差し引いた額です。時価・ローン残高を更新するたびに計算し直します。",
  },
  {
    id: "fire-achievement",
    term: "FIRE達成度",
    description: "目標資産額に対する、現在の資産額の割合です。",
  },
  {
    id: "projected-date",
    term: "到達予測日",
    description:
      "現在の資産額・毎月の積立額・想定利回りをもとに、目標資産額に到達すると計算される時期です。",
  },
];

/** B11 負債入力画面で使う定数(docs/screen-requirements-dashboard.md B11) */

import { DEBTS_PATH } from "@/constants/routes";

/**
 * 項目名の最大文字数。firestore.rulesの`debts`の検証と一致させる。
 *
 * 分類軸名の40文字ではなくB7の物件名(60文字)に揃える。どちらもユーザーが名付ける
 * 管理対象そのもので、「住宅ローン(〇〇銀行)」のように金融機関名を含む長めの名前が付くため。
 */
export const DEBT_NAME_MAX_LENGTH = 60;

/**
 * 登録できる負債の件数の上限。
 *
 * B4の集計対象の選択肢がそのまま増えるため青天井にはせず、分類軸が持てる集計対象の上限
 * (`assetTypeNames`の50件)に揃える。
 *
 * **ルール側でこの値を担保できるのは分類軸が持つ負債IDの配列(`categoryAxes.debtIds`)だけ。**
 * `firestore.rules`は書き込み対象のドキュメントしか見られず、コレクションの件数を数えられない
 * ため、負債そのものの件数は画面側(「負債を追加」ボタンの無効化)で止める。
 * 件数の歯止めが片側にしか無いことを承知のうえで、値は1つに揃えておく。
 */
export const DEBT_MAX_COUNT = 50;

/**
 * 残債の上限(円)。B7の金額欄(`REAL_ESTATE_AMOUNT_MAX`)と同じ12桁に揃える。
 *
 * 要件に上限の指定は無いが、`firestore.rules`側で数値の範囲を縛るには具体的な値が要る。
 * 個人の負債でこの桁に届くことはなく、桁を1つ打ち間違えた入力を止める歯止めとして働く。
 */
export const DEBT_BALANCE_MAX = 999_999_999_999;

/**
 * 金利(年利%)の上限。0以上100以下で、小数を許す(0.375%のような値があるため)。
 * 下限の0は「無利子」を表す正当な値なので許す。
 */
export const DEBT_INTEREST_RATE_MAX = 100;

/** 1年の月数。「年」「ヶ月」の2欄と総月数の相互変換に使う */
export const MONTHS_PER_YEAR = 12;

/** 残りの返済期間「年」の上限(0〜99の整数) */
export const DEBT_REPAYMENT_YEARS_MAX = 99;

/** 残りの返済期間「ヶ月」の上限(0〜11の整数)。12ヶ月以上は「年」で表す */
export const DEBT_REPAYMENT_MONTHS_MAX = 11;

/**
 * 残りの返済期間の総月数の上限(99年11ヶ月 = 1,199ヶ月)。
 *
 * 年・ヶ月それぞれの上限から導く。片方だけを直したときに総月数の上限と食い違わないよう、
 * 値を手で書かずに計算する。
 */
export const DEBT_REPAYMENT_TOTAL_MONTHS_MAX =
  DEBT_REPAYMENT_YEARS_MAX * MONTHS_PER_YEAR + DEBT_REPAYMENT_MONTHS_MAX;

/**
 * 残債の履歴の件数上限(月1回の更新で50年分)。firestore.rulesの`debts`と一致させる。
 *
 * 件数上限を持つのは`assumptions.entries`(200件)と同じ理由で、ルールに書く数値を
 * 実装時に決め打ちさせないため。この履歴は削除以外で減らず運用年数に応じて単調に増えるので、
 * `byType`のように「資産種別の数で自然に頭打ちになる」性質に頼れない。
 */
export const DEBT_BALANCE_HISTORY_MAX = 600;

/** 数値欄で受け付ける形式。カンマ区切り・全角数字は受け付けない(B7の金額欄と同じ扱い) */
export const DEBT_INTEGER_PATTERN = /^[0-9]+$/u;

/** 金利は小数を許すため整数の形とは別に持つ(`0.375`のような値を通す) */
export const DEBT_DECIMAL_PATTERN = /^[0-9]+(\.[0-9]+)?$/u;

/** 画面上部の説明。マネーフォワードのCSVに負債が含まれないことが、この画面がある理由そのもの */
export const DEBT_SCREEN_NOTICE =
  "負債はマネーフォワードのCSVに含まれないため、すべて手動で入力・更新します。金利と残りの返済期間は参考情報として記録するだけで、返済額や完済日の自動計算・残債の自動更新は行いません。";

/**
 * 不動産のローン残高(B7)との関係の注記。
 *
 * 注記が無いと、B7に入れたローンがダッシュボードに出ないことを不具合と読まれる
 * (docs/screen-requirements-dashboard.md B11)。
 */
export const DEBT_REAL_ESTATE_LOAN_NOTICE =
  "不動産の住宅ローンは不動産登録・編集にも「ローン残高」欄がありますが、あちらは物件ごとの利ざや(時価 - ローン残高)を出すための項目で、ダッシュボードの集計には入りません。ダッシュボードで資産から差し引きたい負債は、この画面に登録してください(両方に入れても二重には差し引かれません)。";

/** 「保存」ボタンの脇に添える、追加・削除が確定するタイミングと履歴の説明 */
export const DEBT_SAVE_NOTICE =
  "追加・削除は「保存」を押すまで確定しません。保存すると、残債が変わった負債はその日の残債が履歴として記録されます(資産推移グラフが各時点の残債を差し引くために使います)。";

/** 各欄の見出し */
export const DEBT_NAME_LABEL = "項目名";
export const DEBT_BALANCE_LABEL = "残債(円)";
export const DEBT_INTEREST_RATE_LABEL = "金利(年利%)";
export const DEBT_REPAYMENT_PERIOD_LABEL = "残りの返済期間";

/** 任意入力の欄に添える補助ラベル(金利・残りの返済期間) */
export const DEBT_OPTIONAL_SUFFIX = "任意";

/** 負債合計の見出し。件数を添えて何件分の合計かを示す */
export const buildDebtTotalLabel = (count: number): string => `負債合計(${count}件)`;

/** 一度も保存されていない行の最終更新日の代わりに出す文言 */
export const DEBT_NOT_SAVED_LABEL = "まだ保存されていません";

/** 保存済みの行に出す最終更新日 */
export const buildDebtUpdatedAtLabel = (updatedAt: string): string => `最終更新 ${updatedAt}`;

/** 「負債を追加」ボタン。行を増やすだけの副次操作なので保存ボタンより目立たせない */
export const DEBT_ADD_ROW_LABEL = "負債を追加";

/** 各行の「削除」ボタン。保存するまでは画面上の行が減るだけ */
export const DEBT_REMOVE_ROW_LABEL = "削除";

/** 負債が1件も登録されていないときの案内。負債が無いこと自体はエラーではない */
export const NO_DEBTS_LABEL = "負債がまだ登録されていません。「負債を追加」から登録してください。";

/** 項目名が未入力のときのエラー */
export const DEBT_NAME_REQUIRED_MESSAGE = `${DEBT_NAME_LABEL}を入力してください。`;

/** 項目名が長すぎるときのエラー */
export const DEBT_NAME_TOO_LONG_MESSAGE = `${DEBT_NAME_LABEL}は${DEBT_NAME_MAX_LENGTH}文字以内で入力してください。`;

/** 残債が未入力のときのエラー */
export const DEBT_BALANCE_REQUIRED_MESSAGE = "残債を入力してください。";

/** 数値欄の形式エラー(HTMLモックのエラー文言に対応) */
export const DEBT_NUMBER_FORMAT_MESSAGE = "半角数字のみ入力してください。";

/** 残債が上限を超えたときのエラー */
export const DEBT_BALANCE_TOO_LARGE_MESSAGE = "残債は12桁以内で入力してください。";

/** 金利が範囲外のときのエラー */
export const DEBT_INTEREST_RATE_RANGE_MESSAGE = `金利は0〜${DEBT_INTEREST_RATE_MAX}の範囲で入力してください。`;

/** 返済期間「年」が範囲外のときのエラー */
export const DEBT_REPAYMENT_YEARS_RANGE_MESSAGE = `年は0〜${DEBT_REPAYMENT_YEARS_MAX}の整数で入力してください。`;

/** 返済期間「ヶ月」が範囲外のときのエラー */
export const DEBT_REPAYMENT_MONTHS_RANGE_MESSAGE = `ヶ月は0〜${DEBT_REPAYMENT_MONTHS_MAX}の整数で入力してください。`;

/** 登録件数の上限に達したときの案内。「負債を追加」を押せなくする理由を示す */
export const DEBT_MAX_COUNT_REACHED_MESSAGE = `登録できる負債は${DEBT_MAX_COUNT}件までです。`;

/** 保存完了のトースト(DESIGN.md 3章のsonner) */
export const DEBT_SAVED_MESSAGE = "負債を保存しました";

/**
 * 保存完了に添える説明。履歴に記録されたことと、どこに反映されるかを示す。
 * 画面に留まって続けて編集できる(B2の取込完了と同じ扱い)。
 */
export const DEBT_SAVED_DESCRIPTION =
  "残債が変わった負債は、本日の日付で履歴に記録されました。ダッシュボードの負債サマリと、負債を含む分類軸の集計に反映されます。";

/** 保存時の削除確認ダイアログの見出し */
export const buildDeleteDebtsConfirmTitle = (count: number): string =>
  `負債${count}件を削除して保存しますか?`;

/** 削除確認ダイアログの本文。履歴が消えることの影響を明示する */
export const DELETE_DEBTS_HISTORY_WARNING =
  "残債の履歴も削除され、資産推移グラフからこの負債の控除が過去に遡って消えます。";

/**
 * 削除する負債を集計対象にしている分類軸の案内。
 *
 * 負債は複数の分類軸から独立に選べるため、該当する軸は**すべて列挙する**
 * (docs/screen-requirements-dashboard.md B11)。件数だけを示すと、どの軸の集計が変わるかを
 * 確かめるためにB4を開き直させることになる。
 */
export const buildDeleteDebtsAxisWarning = (axisNames: string[]): string =>
  `この負債を集計対象にしている分類軸「${axisNames.join("」「")}」の集計も変わります。`;

/** 削除確認ダイアログの実行ボタン */
export const DELETE_DEBTS_CONFIRM_LABEL = "削除して保存する";

/** 削除する負債の識別。項目名の重複を許すため、残債額を並べて同名の負債を見分けられるようにする */
export const buildDeleteDebtLabel = (name: string, balance: string): string =>
  `${name}(残債 ${balance})`;

/**
 * 負債の取得・保存が失敗したときの文言。
 *
 * 履歴の上限超過(`history-limit-exceeded`)だけはFirestoreへのアクセスの失敗ではなく、
 * 「到達しない前提で置いた歯止めに実際に達した」状態を指す。古い記録から捨てる案は
 * 採らないため(過去の資産推移グラフの値が負債の更新だけで黙って変わる)、
 * ユーザーには保存できないことをそのまま伝える。
 */
export const DEBT_FAILURE_MESSAGES: Record<DebtFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから操作してください。",
  "configuration-error": "Firebaseの設定が読み込めないため操作できません。",
  "permission-denied": "この操作は許可されていません。ログインし直すか、画面を更新してください。",
  "history-limit-exceeded": `残債の履歴が上限(${DEBT_BALANCE_HISTORY_MAX}件)に達している負債があるため保存できません。履歴の持ち方を見直す必要があります。`,
  unknown: "操作に失敗しました。時間をおいて再度お試しください。",
};

/**
 * 負債一覧を**取得**できなかったときの文言。
 *
 * 保存の失敗とは別に持つ。表示できないことと操作できないことでは次にすべきことが違い、
 * 取得の失敗を空状態(未登録)として見せないのがこの文言の目的(B4・B5と同じ扱い)。
 */
export const DEBT_LOAD_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから表示してください。",
  "configuration-error": "Firebaseの設定が読み込めないため表示できません。",
  "permission-denied": "このデータの参照が許可されていません。ログインし直してください。",
  unknown: "データを取得できませんでした。時間をおいて再度お試しください。",
};

/** 負債一覧のキャッシュキー(TanStack Query) */
export const DEBTS_QUERY_KEY = ["debts"] as const;

/** B1の負債サマリからB11への導線 */
export const DEBT_SCREEN_LINK = { label: "負債を入力する", href: DEBTS_PATH } as const;

/** B5 不動産一覧画面・B6 不動産詳細画面・B7 不動産登録・編集画面で使う定数 */

import { REAL_ESTATE_NEW_PATH, REAL_ESTATE_PATH } from "@/constants/routes";

/**
 * 画面上部の説明文。
 *
 * 利ざや(時価-ローン残高)は一覧に出さずB6でのみ表示するのが要件
 * (docs/screen-requirements-real-estate.md B5)なので、どこで見られるかをここで示す。
 */
export const REAL_ESTATE_LIST_DESCRIPTION =
  "登録済みの物件の時価とローン残高を一覧します。利ざやは物件を選ぶと詳細画面で確認できます。";

/** 「新規登録」ボタン(B7の新規登録モードへの導線) */
export const REAL_ESTATE_NEW_LINK = {
  label: "新規登録",
  href: REAL_ESTATE_NEW_PATH,
} as const;

/**
 * 物件が1件も登録されていないときの案内。
 *
 * 導線のラベルは画面上部の「新規登録」ボタンとあえて変える。同じ文言のボタンが縦に2つ並ぶと
 * 別の操作があるように見えるため。
 */
export const NO_REAL_ESTATE_EMPTY_STATE = {
  message: "登録済みの物件がまだありません。",
  action: { label: "物件を登録する", href: REAL_ESTATE_NEW_PATH },
} as const;

/** 一覧の各行・詳細に添える金額の見出し */
export const REAL_ESTATE_MARKET_VALUE_LABEL = "時価";
export const REAL_ESTATE_LOAN_BALANCE_LABEL = "ローン残高";

/**
 * 利ざやの見出し(B6)。
 *
 * 「(自動計算)」を添えるのは、手で入力した値ではなく時価とローン残高から導いた値だと
 * 画面上で分かるようにするため(docs/screen-requirements-real-estate.md B6の表示項目)。
 */
export const REAL_ESTATE_SPREAD_LABEL = "利ざや(自動計算)";

/** 利ざやの計算式。見出しだけでは何から引いた値か伝わらないため添える */
export const REAL_ESTATE_SPREAD_DESCRIPTION = "時価 - ローン残高";

/** 賃貸収支セクション(収益物件のみ表示)の見出しと各項目 */
export const REAL_ESTATE_RENTAL_SECTION_TITLE = "賃貸収支(月額)";
export const REAL_ESTATE_RENTAL_INCOME_LABEL = "賃貸収入";
export const REAL_ESTATE_RENTAL_EXPENSE_LABEL = "賃貸支出";
export const REAL_ESTATE_RENTAL_BALANCE_LABEL = "収支";

/** 物件基本情報セクションの見出しと各項目 */
export const REAL_ESTATE_BASIC_INFO_SECTION_TITLE = "物件基本情報";
export const REAL_ESTATE_NAME_LABEL = "物件名";
export const REAL_ESTATE_LOCATION_LABEL = "所在地";
export const REAL_ESTATE_UPDATED_AT_LABEL = "最終更新日";

/** 収益物件であることを物件名の下に示すラベル。非収益物件には何も出さない */
export const REAL_ESTATE_RENTAL_PROPERTY_LABEL = "収益物件";

/** 「一覧に戻る」リンク(B5へ戻る) */
export const REAL_ESTATE_BACK_TO_LIST_LINK = {
  label: "一覧に戻る",
  href: REAL_ESTATE_PATH,
} as const;

/** 「編集」ボタンのラベル。遷移先は物件IDから組み立てるためここには持たない */
export const REAL_ESTATE_EDIT_LABEL = "編集";

/**
 * 指定された物件が見つからないときの案内(B6・B7 編集モード)。
 *
 * 削除済みの物件をブックマークや履歴から開いた場合に出る。行き止まりにしないよう
 * 一覧への導線を添える。
 */
export const REAL_ESTATE_NOT_FOUND = {
  title: "物件が見つかりません",
  message: "指定された物件は削除されたか、URLが正しくない可能性があります。",
  action: REAL_ESTATE_BACK_TO_LIST_LINK,
} as const;

/* ------------------------------------------------------------------ *
 * B7 不動産登録・編集画面
 * ------------------------------------------------------------------ */

/** 画面の見出し。新規登録と編集で言い分ける(どちらのモードで開いているか一目で分かるように) */
export const REAL_ESTATE_FORM_TITLES = {
  create: "物件を登録",
  edit: "物件情報を編集",
} as const;

/**
 * 新規登録モードの初期値。
 *
 * 「収益物件として登録」は既定でオフにする。収益物件でない物件の方が一般的で、
 * オンを既定にすると賃貸収入/支出が必須の状態から入力を始めることになるため。
 */
export const REAL_ESTATE_FORM_INITIAL_VALUES: RealEstateFormValues = {
  name: "",
  location: "",
  marketValue: "",
  loanBalance: "",
  isRentalProperty: false,
  rentalMonthlyIncome: "",
  rentalMonthlyExpense: "",
};

/** 「保存」ボタン・「キャンセル」リンクのラベル */
export const REAL_ESTATE_FORM_SUBMIT_LABEL = "保存";
export const REAL_ESTATE_FORM_SUBMITTING_LABEL = "保存中...";
export const REAL_ESTATE_FORM_CANCEL_LABEL = "キャンセル";

/**
 * 金額入力欄の見出し。単位を添えるのは、円単位で入力するのか万円単位なのかを
 * 入力欄だけで判断できるようにするため(HTMLモックの表記に合わせる)。
 */
export const REAL_ESTATE_FORM_MARKET_VALUE_LABEL = `${REAL_ESTATE_MARKET_VALUE_LABEL}(円)`;
export const REAL_ESTATE_FORM_LOAN_BALANCE_LABEL = `${REAL_ESTATE_LOAN_BALANCE_LABEL}(円)`;
export const REAL_ESTATE_FORM_RENTAL_INCOME_LABEL = `${REAL_ESTATE_RENTAL_INCOME_LABEL}(月額・円)`;
export const REAL_ESTATE_FORM_RENTAL_EXPENSE_LABEL = `${REAL_ESTATE_RENTAL_EXPENSE_LABEL}(月額・円)`;

/**
 * 「収益物件として登録」チェックボックスの文言。
 *
 * オンにすると賃貸収入・支出の入力欄が現れ、その有無がそのままB6の賃貸収支セクションの
 * 表示有無になる(docs/screen-requirements-real-estate.md B6・B7)。
 */
export const REAL_ESTATE_FORM_RENTAL_TOGGLE_LABEL = "収益物件として登録(賃貸収入・支出を管理する)";

/** 所在地が任意入力であることを入力欄に明示する。未入力でも保存できる */
export const REAL_ESTATE_FORM_OPTIONAL_SUFFIX = "(任意)";

/** 物件名の最大文字数。firestore.rulesの`properties`の検証と一致させる */
export const REAL_ESTATE_NAME_MAX_LENGTH = 60;

/** 所在地の最大文字数。firestore.rulesの`properties`の検証と一致させる */
export const REAL_ESTATE_LOCATION_MAX_LENGTH = 100;

/**
 * 金額の上限(円)。firestore.rulesの`properties`の検証と一致させる。
 *
 * 桁の打ち間違い(0を余分に打つ・単位を取り違える)を弾くための歯止めであり、
 * 個人が保有する不動産の時価・ローン残高としては12桁で十分に収まる。
 */
export const REAL_ESTATE_AMOUNT_MAX = 999_999_999_999;

/** 金額入力で受け付ける形式。カンマ区切り・全角数字は受け付けない(HTMLモックのエラー文言に対応) */
export const REAL_ESTATE_AMOUNT_PATTERN = /^[0-9]+$/u;

/** 物件名が未入力のときのエラー */
export const REAL_ESTATE_NAME_REQUIRED_MESSAGE = `${REAL_ESTATE_NAME_LABEL}を入力してください。`;

/** 物件名が長すぎるときのエラー */
export const REAL_ESTATE_NAME_TOO_LONG_MESSAGE = `${REAL_ESTATE_NAME_LABEL}は${REAL_ESTATE_NAME_MAX_LENGTH}文字以内で入力してください。`;

/** 所在地が長すぎるときのエラー(所在地は未入力を許すため必須エラーは無い) */
export const REAL_ESTATE_LOCATION_TOO_LONG_MESSAGE = `${REAL_ESTATE_LOCATION_LABEL}は${REAL_ESTATE_LOCATION_MAX_LENGTH}文字以内で入力してください。`;

/** 金額欄が未入力のときのエラー。どの欄かが分かるよう項目名を添える */
export const buildRealEstateAmountRequiredMessage = (label: string): string =>
  `${label}を入力してください。`;

/** 金額欄にカンマ・全角数字などが入っているときのエラー(HTMLモックの文言に合わせる) */
export const REAL_ESTATE_AMOUNT_FORMAT_MESSAGE = "半角数字のみ入力してください。";

/** 金額が上限を超えたときのエラー */
export const REAL_ESTATE_AMOUNT_TOO_LARGE_MESSAGE = "金額は12桁以内で入力してください。";

/** 保存完了のトースト(DESIGN.md 3章のsonner) */
export const REAL_ESTATE_SAVED_MESSAGES = {
  create: "物件を登録しました",
  edit: "物件情報を更新しました",
} as const;

/** 物件の取得・保存が失敗したときの文言(B4の`CATEGORY_AXIS_FAILURE_MESSAGES`と同じ考え方) */
export const REAL_ESTATE_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから操作してください。",
  "configuration-error": "Firebaseの設定が読み込めないため操作できません。",
  "permission-denied": "この操作は許可されていません。ログインし直すか、画面を更新してください。",
  unknown: "操作に失敗しました。時間をおいて再度お試しください。",
};

/** 物件一覧のキャッシュキー(TanStack Query) */
export const REAL_ESTATE_PROPERTIES_QUERY_KEY = ["real-estate-properties"] as const;

/**
 * 物件1件のキャッシュキー(TanStack Query)。
 *
 * B6 詳細・B7 編集モードが同じ物件を引くため、物件IDまで含めて分ける。
 */
export const buildRealEstatePropertyQueryKey = (id: string): readonly [string, string] => [
  "real-estate-property",
  id,
];

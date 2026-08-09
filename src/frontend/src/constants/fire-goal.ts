/** B8 FIRE目標設定画面で使う定数(docs/screen-requirements-fire-goal.md B8) */

/** 画面上部の説明文。2つの設定方式のどちらか一方が有効になることを先に伝える */
export const FIRE_GOAL_DESCRIPTION =
  "FIRE達成の目標資産額を設定します。目標額を直接入力するか、想定年間支出額から逆算するかを選べます。";

/**
 * 逆算係数の既定値(%)。いわゆる4%ルール(要件定義書 4.6)。
 *
 * 「4%ルールなど任意の係数」と書かれているとおり固定値ではなく、既定値として置いたうえで
 * ユーザーが編集できるようにする。
 */
export const DEFAULT_WITHDRAWAL_RATE = 4;

/** 設定方式の既定値。初めてB8を開いたときに選択されるタブ */
export const DEFAULT_FIRE_GOAL_MODE: FireGoalMode = "direct";

/** 各タブのパネル先頭に出す説明。タブ見出しだけでは方式の違いが伝わらないため添える */
export const FIRE_GOAL_DIRECT_DESCRIPTION = "目標とする資産額をそのまま入力します。";
export const FIRE_GOAL_REVERSE_DESCRIPTION =
  "想定する年間支出額と逆算係数から、必要な資産額を自動で算出します。";

/**
 * 設定方式の表示名(HTMLモック b8-fire-goal.html のタブ見出しに合わせる)。
 *
 * タブ見出しと、方式を名指しする文言(`buildFireGoalHiddenTabNoticeMessage`)の両方から
 * 参照する。同じ方式が場所によって別の呼び名になると、どのタブを指しているか読めなくなるため。
 */
export const FIRE_GOAL_MODE_LABELS: Record<FireGoalMode, string> = {
  direct: "直接入力",
  reverse: "年間支出額から逆算",
};

/** 設定方式のタブ */
export const FIRE_GOAL_MODES: FireGoalModeOption[] = [
  {
    id: "direct",
    label: FIRE_GOAL_MODE_LABELS.direct,
    description: FIRE_GOAL_DIRECT_DESCRIPTION,
  },
  {
    id: "reverse",
    label: FIRE_GOAL_MODE_LABELS.reverse,
    description: FIRE_GOAL_REVERSE_DESCRIPTION,
  },
];

/**
 * 達成度の対象分類(docs/screen-requirements-fire-goal.md B8「達成度の対象分類」)。
 *
 * 既定は「総資産(マネーフォワードの合計)」で、これは分類軸を1つも選んでいない状態
 * (`achievementAxisId`が`null`)を指す。B1のゲージにも同じ名前を併記するため、
 * 文言はここ1か所に持つ(画面によって呼び名が変わると同じ数字だと判別できない)。
 */
export const ACHIEVEMENT_AXIS_LABEL = "達成度の対象分類";

/** 既定の対象分類の表示名。B1のゲージの併記にも使う */
export const DEFAULT_ACHIEVEMENT_AXIS_NAME = "総資産(マネーフォワードの合計)";

/**
 * 既定の対象分類を`<select>`の値として表すID。
 *
 * 保存する値は`null`だが、`<option value>`に`null`は載せられない。分類軸のIDは
 * Firestoreの自動採番で`__`を含まないため、内訳の「その他」(`__other__`)と同じく
 * 二重アンダースコアで囲んだ擬似IDにして実在のIDと衝突しないようにする。
 */
export const DEFAULT_ACHIEVEMENT_AXIS_VALUE = "__total__";

/** 対象分類セレクタに添える説明(HTMLモック b8-fire-goal.html の文言に合わせる) */
export const ACHIEVEMENT_AXIS_HINT =
  "FIRE達成度の現在資産額をこの分類で集計します。ダッシュボードで切り替える分類軸とは別の設定です。";

/**
 * 分類軸が1件も登録されていないときに添える案内。
 *
 * 分類軸が無いこと自体はエラーではなく保存もできるため、警告ではなく導線として出す
 * (要件「B4に分類軸が1件も無い場合は…B4への導線を添える」)。
 */
export const ACHIEVEMENT_AXIS_EMPTY_HINT =
  "分類軸がまだ登録されていません。資産分類マスタで追加すると、この一覧から選べるようになります。";

/** 分類軸を追加しに行く導線(B4) */
export const ACHIEVEMENT_AXIS_MASTER_LINK_LABEL = "資産分類マスタを開く";

/**
 * 保存済みの対象分類がB4で削除されていたときの案内。
 *
 * 存在しない選択肢を選択中として出すことはできないので既定に戻すが、黙って戻すと
 * 設定し直したことに気付けないため、戻したこと自体を画面に出す(要件B8)。
 */
export const ACHIEVEMENT_AXIS_MISSING_MESSAGE = `設定していた対象分類が見つからないため、「${DEFAULT_ACHIEVEMENT_AXIS_NAME}」に戻しました。必要であれば選び直して保存してください。`;

/**
 * 保存しようとした対象分類が選択肢に無いときのエラー。
 *
 * セレクタからの選択なので通常は起こらないが、画面を開いたまま別のタブでB4から分類軸を
 * 削除した場合に起こりうる。要件が「存在しない分類軸IDが渡された場合は保存を拒否する」と
 * しているため、黙って既定へ倒さずに止める(気付かないまま別の基準の達成率を見続けないため)
 */
export const ACHIEVEMENT_AXIS_INVALID_MESSAGE =
  "選択した対象分類が見つかりません。分類を選び直してから保存してください。";

/** 入力欄の見出し。単位を添えて、円単位なのか%なのかを入力欄だけで判断できるようにする */
export const FIRE_GOAL_TARGET_AMOUNT_LABEL = "目標資産額(円)";
export const FIRE_GOAL_ANNUAL_EXPENSE_LABEL = "想定年間支出額(円)";
export const FIRE_GOAL_WITHDRAWAL_RATE_LABEL = "逆算係数(%)";

/** 逆算係数の入力欄に添える説明(HTMLモックの文言に合わせる) */
export const FIRE_GOAL_WITHDRAWAL_RATE_HINT = `${DEFAULT_WITHDRAWAL_RATE}%ルール(目標資産額 = 年間支出額 ÷ 逆算係数)が既定値です。編集できます。`;

/**
 * 金額の上限(円)。firestore.rulesの`settings/fireGoal`の検証と一致させる。
 *
 * 桁の打ち間違いを弾くための歯止めで、根拠は物件の金額(`REAL_ESTATE_AMOUNT_MAX`)と同じ。
 * 個人の目標資産額・年間支出額としては12桁で十分に収まる。
 */
export const FIRE_GOAL_AMOUNT_MAX = 999_999_999_999;

/** 逆算係数の上限(%)。100%を超えると「年間支出額より小さい目標資産額」になり意味を成さない */
export const FIRE_GOAL_WITHDRAWAL_RATE_MAX = 100;

/** 金額入力で受け付ける形式。カンマ区切り・全角数字は受け付けない(B7の金額欄と揃える) */
export const FIRE_GOAL_AMOUNT_PATTERN = /^[0-9]+$/u;

/**
 * 逆算係数で受け付ける形式。金額と違い小数を許す(3.5%のような設定を想定)。
 * 記号や指数表記は受け付けない。
 */
export const FIRE_GOAL_WITHDRAWAL_RATE_PATTERN = /^[0-9]+(?:\.[0-9]+)?$/u;

/** 必須の欄が未入力のときのエラー。どの欄かが分かるよう項目名を添える */
export const buildFireGoalRequiredMessage = (label: string): string =>
  `${label}を入力してください。`;

/** 金額欄にカンマ・全角数字などが入っているときのエラー(B7の金額欄と同じ文言) */
export const FIRE_GOAL_AMOUNT_FORMAT_MESSAGE = "半角数字のみ入力してください。";

/** 金額が上限を超えたときのエラー */
export const FIRE_GOAL_AMOUNT_TOO_LARGE_MESSAGE = "金額は12桁以内で入力してください。";

/**
 * 金額に0が入力されたときのエラー。
 *
 * 目標資産額が0だと達成率(現在資産 ÷ 目標資産)が定義できず、年間支出額が0だと
 * 逆算した目標資産額も0になるため、どちらも1円以上を求める。
 */
export const FIRE_GOAL_AMOUNT_TOO_SMALL_MESSAGE = "1円以上の金額を入力してください。";

/** 逆算係数の形式エラー */
export const FIRE_GOAL_WITHDRAWAL_RATE_FORMAT_MESSAGE = "半角数字で入力してください。";

/** 逆算係数が範囲外のときのエラー */
export const FIRE_GOAL_WITHDRAWAL_RATE_RANGE_MESSAGE = `逆算係数は0より大きく${FIRE_GOAL_WITHDRAWAL_RATE_MAX}%以下で入力してください。`;

/**
 * 表示していなかったタブのエラーで保存が止まり、そのタブへ切り替えたときの説明(`FireGoalForm`)。
 *
 * 切り替え自体は以前から行っているが、画面には切替先のインラインエラーしか出ないため、
 * 「使うつもりのない方の入力が原因で保存できていない」ことが読み取れなかった。
 *
 * 切り替えると`mode`もその方式に変わる(タブの選択状態が有効な設定方式そのもの)。
 * そのため切替後は「未使用の欄」ではなくなっており、文言も「未使用の入力です」ではなく
 * 何が起きたのかを説明する形にしてある。逆算の入力を使わずに保存し直す道も要るので、
 * 元のタブに戻して消す方法まで書く。
 *
 * 後半の手順は**実際に操作できる順**に並べる。誤りのある欄が見えているのは切替先のタブに
 * いる間だけなので、「元のタブに戻してから消す」と書くと、そのままでは実行できない順序になる。
 */
export const buildFireGoalHiddenTabNoticeMessage = (
  previousLabel: string,
  erroredLabel: string,
): string =>
  `「${previousLabel}」で保存しようとしましたが、表示していなかった「${erroredLabel}」の入力に誤りがあるため保存できません。誤りを直すか、「${erroredLabel}」の入力を消してから「${previousLabel}」に戻って保存してください。`;

/** 「保存」ボタンのラベル */
export const FIRE_GOAL_SUBMIT_LABEL = "保存";
export const FIRE_GOAL_SUBMITTING_LABEL = "保存中...";

/** 保存完了のトースト(DESIGN.md 3章のsonner) */
export const FIRE_GOAL_SAVED_MESSAGE = "FIRE目標を保存しました";

/** 画面上部の参考表示の見出し */
export const FIRE_GOAL_ACTIVE_MODE_LABEL = "現在の設定方式";
export const FIRE_GOAL_CURRENT_ASSET_LABEL = "現在資産額";

/** 参考表示であること(入力項目ではないこと)を明示する注記 */
export const FIRE_GOAL_REFERENCE_SUFFIX = "(参考表示)";

/** まだ一度も保存していないときの設定方式の表示 */
export const FIRE_GOAL_UNSET_MODE_LABEL = "未設定";

/**
 * 現在資産額が分からないときの表示。
 *
 * 資産残高CSVが未取込の場合と、取得に失敗した場合の両方でこれを出す。参考表示であり
 * 目標の設定自体は妨げないため、失敗を理由に画面を止めたりエラーを重ねたりしない。
 */
export const FIRE_GOAL_UNKNOWN_ASSET_LABEL = "—";

/**
 * 達成率の参考表示。現在資産額が分からない場合は出さない。
 *
 * 対象分類名を併記する。B1のゲージと同じ表記にし、どの範囲を数えた達成率かが
 * 画面をまたいでも同じように読めるようにするため(要件B8)。
 */
export const buildFireGoalAchievementHint = (
  formattedRate: string,
  achievementAxisName: string,
): string => `現在資産額(${achievementAxisName})に対する達成率: ${formattedRate}`;

/** 逆算タブに出す算出結果の見出し */
export const FIRE_GOAL_CALCULATED_TARGET_LABEL = "逆算された目標資産額";

/** 目標の取得・保存が失敗したときの文言(`REAL_ESTATE_FAILURE_MESSAGES`と同じ考え方) */
export const FIRE_GOAL_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから操作してください。",
  "configuration-error": "Firebaseの設定が読み込めないため操作できません。",
  "permission-denied": "この操作は許可されていません。ログインし直すか、画面を更新してください。",
  unknown: "操作に失敗しました。時間をおいて再度お試しください。",
};

/** FIRE目標のキャッシュキー(TanStack Query) */
export const FIRE_GOAL_QUERY_KEY = ["fire-goal"] as const;

/**
 * 参考表示の元になる直近の資産残高のキャッシュキー(TanStack Query)。
 *
 * 総額だけでなく資産種別ごとの金額まで持つ。対象分類を切り替えたときに現在資産額を
 * その場で集計し直すため、選択のたびにFirestoreを引き直さずに済ませる。
 */
export const LATEST_ASSET_SNAPSHOT_QUERY_KEY = ["latest-asset-snapshot"] as const;

/**
 * 入力欄とそれが属する設定方式の対応。
 *
 * 保存時のバリデーションで、エラーの出た欄が非表示タブにあるときに、そのタブへ
 * 切り替えてからインラインエラーを見せるために使う(`FireGoalForm`)。
 * 見えない場所でエラーになっていて保存だけが進まない状態を作らないため。
 */
export const FIRE_GOAL_FIELDS = [
  { name: "targetAmount", mode: "direct" },
  { name: "annualExpense", mode: "reverse" },
  { name: "withdrawalRate", mode: "reverse" },
] as const satisfies readonly { name: keyof FireGoalFormValues; mode: FireGoalMode }[];

/**
 * 参考表示の現在資産額がマイナス(対象分類の負債が資産を上回る)のときの注記。
 *
 * 丸め方の正は docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」に置き、
 * この画面で別に決めない。同じ設定に対して画面ごとに違う達成率が出るのを避けるため。
 */
export const NEGATIVE_CURRENT_ASSET_NOTICE =
  "対象分類の負債が資産を上回っています。ダッシュボードのFIRE達成度は0%として表示されます。";

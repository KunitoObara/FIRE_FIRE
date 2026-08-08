import type { z } from "zod";

import type { debtFormSchema } from "@/schemas/debts";

declare global {
  /**
   * 負債1件(docs/screen-requirements-dashboard.md B11)。
   *
   * すべて手動入力で、自動計算は行わない(要件定義書 4.8)。金利と残りの返済期間から
   * 毎月の返済額や完済日を導かず、時間が経っても残債は自動で減らない。集計に使うのは
   * 残債だけで、金利と残りの返済期間は参考情報として保持・表示する。
   */
  type Debt = {
    id: string;
    /** 項目名。重複を許す(同じ名前のカードローンを複数登録することがあり、識別はIDで行う) */
    name: string;
    /** 残債(円)。0以上の整数。完済した負債を0円のまま残せるようにするため0を許す */
    balance: number;
    /**
     * 金利(年利%)。任意入力で、未登録は`null`。
     *
     * 0%(無利子)と未登録を区別するため`0`に倒さない。B1の負債サマリでも未登録の欄は
     * 空にし、0%とは表示しない。
     */
    interestRate: number | null;
    /**
     * 残りの返済期間(総月数)。任意入力で、未登録は`null`。
     *
     * 入力は「年」「ヶ月」の2欄で受け、保存時にここへ正規化する。総月数だけを入力させると
     * 「残り23年4ヶ月」を月数に直す計算をユーザーにさせることになるため。
     * 片方の欄だけが入力された場合は空欄側を0として正規化し、**両方が空欄のときだけ**
     * 未登録(`null`)にする。0ヶ月(=総月数0)とは区別される。
     */
    repaymentMonths: number | null;
    /**
     * 最終更新日(yyyy-MM-dd)。入力項目ではなく保存時に自動で付ける(B7の時価と同じ扱い)。
     *
     * 手動更新の値がいつ時点のものかが分からないと、B1の負債サマリの数字をどこまで
     * 信用してよいか判断できない。
     */
    updatedAt: string;
    /**
     * 残債の履歴(`yyyy-MM-dd` → その日の残債)。
     *
     * 資産推移グラフが各時点で「その時点以前で最も新しい残債」を差し引くために使う
     * (B1「負債を含む分類軸の集計」)。履歴が無いと、過去の純資産を現在の残債で描くことになる。
     * サブコレクションにしないのは、B1が負債の件数だけ問い合わせを増やさずに推移を
     * 描けるようにするため。
     */
    balanceHistory: DebtBalanceHistory;
  };

  /** 残債の履歴。キーは`yyyy-MM-dd`、値はその日の残債(円) */
  type DebtBalanceHistory = Record<string, number>;

  /**
   * 保存する負債1件分の内容。
   *
   * `Debt`との違いは、最終更新日と残債の履歴を含まないこと。どちらも入力項目ではなく
   * 保存時に決まる値で、リポジトリが埋める(`RealEstatePropertyInput`と同じ考え方)。
   *
   * `id`は保存済みの負債を指す。**画面上で追加しただけの行は`null`**で、保存時に採番する。
   * 行の同一性を配列の位置で表さないのは、行を削除したときに残った行の内容がずれるため
   * (DESIGN.md 6章)。
   */
  type DebtInput = {
    id: string | null;
    name: string;
    balance: number;
    interestRate: number | null;
    repaymentMonths: number | null;
  };

  /**
   * 負債の**保存**が失敗した理由。
   *
   * `history-limit-exceeded`だけはFirestoreへのアクセスの失敗ではなく、残債の履歴が
   * 上限(`DEBT_BALANCE_HISTORY_MAX`)に達している状態を指す。古い記録から捨てる案は
   * 採らない(過去の資産推移グラフの値が、負債を更新しただけで黙って変わることになる)ため、
   * 保存を拒否してユーザーに伝える。
   *
   * **取得の失敗はこの型を使わない**(`DebtsResult`)。履歴の上限は書き込み時にしか
   * 起こらず、読み出し側にこの理由を持たせると、B1のようにアクセスの失敗しか扱わない
   * 呼び出し側まで起こりえない分岐を書くことになる。
   */
  type DebtFailureReason = FirestoreAccessFailureReason | "history-limit-exceeded";

  /**
   * 負債一覧の取得結果(B11・B1の負債サマリ・B4の集計対象の選択肢)。
   * 失敗はFirestoreへのアクセス自体の失敗と一致する。
   */
  type DebtsResult =
    { ok: true; debts: Debt[] } | { ok: false; reason: FirestoreAccessFailureReason };

  /** 負債の一括保存の結果 */
  type SaveDebtsResult = { ok: true } | { ok: false; reason: DebtFailureReason };

  /** B11 負債入力フォームの入力値(`debtFormSchema`から導出) */
  type DebtFormValues = z.infer<typeof debtFormSchema>;

  /** B11 負債入力フォームの1行分の入力値 */
  type DebtRowFormValues = DebtFormValues["debts"][number];

  /**
   * 保存時の削除確認ダイアログに出す削除対象1件分。
   *
   * 項目名だけでなく残債額も持つ。項目名の重複を許す仕様のため、名前だけを並べると
   * 同名の負債が2件あるときにどちらが消えるのか確認できず、誤操作を防ぐという
   * 確認ダイアログの目的を果たせない(docs/screen-requirements-dashboard.md B11)。
   */
  type DebtDeletionPreview = {
    id: string;
    name: string;
    /** 表示用に整形済みの残債。ダイアログは金額の再整形をしない */
    balance: string;
  };

  /** B11 負債入力画面のProps */
  type DebtInputScreenProps = {
    debts: Debt[];
    /**
     * 削除確認ダイアログで「この負債を集計対象にしている分類軸」を出すための一覧。
     * 該当する分類軸は件数ではなくすべて列挙する(B11)。
     */
    axes: AssetCategoryAxisDocument[];
    /**
     * `baselineIds`は画面が読み込んだ時点の負債のID。削除対象をこれを基準に求めるため、
     * 保存の側へ明示的に渡す。サーバーの最新状態を基準にすると、別のタブで追加された
     * 負債まで消えてしまう(`saveDebts`)。
     */
    onSave: (inputs: DebtInput[], baselineIds: string[]) => Promise<SaveDebtsResult>;
  };

  /** 保存時の削除確認ダイアログのProps */
  type DeleteDebtsDialogProps = {
    /** 削除対象。空配列は非表示(削除が無ければ確認を挟まない) */
    deletions: DebtDeletionPreview[];
    /** 削除対象の負債を集計対象にしている分類軸の名前。重複は除いて渡す */
    affectedAxisNames: string[];
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
  };

  /** B1 負債サマリカードのProps */
  type DebtSummaryCardProps = {
    /** 登録済みの負債。分類軸切替セレクタの影響を受けないため、絞り込まずそのまま渡す */
    debts: Debt[];
  };
}

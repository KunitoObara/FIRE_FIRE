import type { z } from "zod";

import type { fireGoalFormSchema } from "@/schemas/fire-goal";

declare global {
  /**
   * FIRE目標の設定方式(docs/screen-requirements-fire-goal.md B8)。
   *
   * `direct`は目標資産額をそのまま入力する方式、`reverse`は想定年間支出額と逆算係数から
   * 目標資産額を導く方式(4%ルール等)。要件どおりユーザーが切り替えられる。
   */
  type FireGoalMode = "direct" | "reverse";

  /** 設定方式タブの1選択肢 */
  type FireGoalModeOption = {
    id: FireGoalMode;
    label: string;
    /** タブの内容を1行で説明する文。パネルの先頭に出す */
    description: string;
  };

  /**
   * 保存されたFIRE目標(`users/{uid}/settings/fireGoal`)。
   *
   * **有効な設定方式は`mode`だけが決める**が、金額は両方式の入力値を保存する。
   * 方式を切り替えて保存し直したときに反対側の入力が消えず、B8を開き直すだけで
   * 前回の値から再開できるようにするため。
   *
   * 未入力の欄は`null`で保存する。直接入力だけを使うユーザーに、使う予定のない
   * 年間支出額の入力まで求めないため(必須になるのは有効な方式の欄だけ)。
   */
  type FireGoal = {
    /** 現在有効な設定方式。B8の表示項目「現在有効な設定方式」そのもの */
    mode: FireGoalMode;
    /**
     * 達成度の対象分類(B4の分類軸ID)。`null`は既定の「総資産(マネーフォワードの合計)」。
     *
     * 達成率の分子である現在資産額をどの範囲で数えるかの設定で、目標額と1組で
     * 「何に対する目標か」を表すため同じドキュメントに持つ
     * (docs/screen-requirements-fire-goal.md B8「達成度の対象分類」)。
     *
     * 設定方式(`mode`)ごとには持たない。目標額の決め方と比較する資産の範囲は別の話であり、
     * 方式ごとに分けると方式を切り替えただけで達成率が理由なく変わるため。
     *
     * ここに入っている分類軸がB4で削除されることはありうる。参照している側
     * (B1のゲージ・B8の参考表示)が既定へフォールバックする責務を持ち、B4の削除は禁止しない。
     */
    achievementAxisId: string | null;
    /** 目標資産額(円)。直接入力タブの値 */
    targetAmount: number | null;
    /** 想定年間支出額(円)。逆算タブの値 */
    annualExpense: number | null;
    /**
     * 逆算係数(%)。4%ルールなら`4`。
     *
     * 比率(0.04)ではなくパーセントの数値で持つ。入力欄に出す値と保存する値を同じにして、
     * 100倍する/しないの取り違えが起きる箇所を作らないため。
     */
    withdrawalRate: number | null;
  };

  /** B8 FIRE目標設定フォームの入力値(`fireGoalFormSchema`から導出) */
  type FireGoalFormValues = z.infer<typeof fireGoalFormSchema>;

  /**
   * FIRE目標の取得結果。
   *
   * 未設定は失敗ではなく`goal: null`で返す。初回の設定と読み出し失敗を画面側で
   * 出し分けられるようにするため(`RealEstatePropertyResult`と同じ考え方)。
   */
  type FireGoalResult =
    { ok: true; goal: FireGoal | null } | { ok: false; reason: FirestoreAccessFailureReason };

  /** FIRE目標の保存結果。保存後の遷移先(B1)は固定なので返す値は持たない */
  type SaveFireGoalResult = { ok: true } | { ok: false; reason: FirestoreAccessFailureReason };

  /**
   * 現在資産額(参考表示)の元になる直近の資産残高の取得結果。
   *
   * CSVを一度も取り込んでいないアカウントでは資産残高が1件も無いため、
   * 成功しつつ`snapshot: null`が返る。
   *
   * 総額ではなく資産残高そのものを返すのは、対象分類ごとの集計を呼び出し側で行うため
   * (`resolveAchievementAmount`)。
   */
  type LatestAssetSnapshotResult =
    | { ok: true; snapshot: AssetSnapshot | null }
    | { ok: false; reason: FirestoreAccessFailureReason };

  /**
   * 達成度の対象分類の選択肢1件分(B8のセレクタ)。
   *
   * 集計に使う`assetTypeNames`まで持たせるのは、参考表示の現在資産額をセレクタの変更に
   * 合わせてその場で計算し直すため。保存を待たずに「この分類にすると達成率がこうなる」を
   * 確かめられるようにする。
   */
  type AchievementAxisOption = {
    id: string;
    name: string;
    /** 集計対象の資産種別名。空配列は「すべての資産種別が対象」(B4の約束) */
    assetTypeNames: string[];
    /**
     * 集計から差し引く負債のID。空配列は「負債を差し引かない」(B4)。
     * `assetTypeNames`と読み替えが非対称なのは、負債の登録だけで既存の分類軸が
     * 黙って純資産の軸へ変わるのを避けるため。
     */
    debtIds: string[];
  };

  /**
   * 達成度の対象分類を解決した結果。
   *
   * 名前と集計方法と「見つからなかったか」を1組で返す。別々に求めると、フォールバックした
   * のに分類名だけ削除済みの軸を指す、といった食い違いが起きる。
   */
  type AchievementAxisResolution = {
    /** 併記する対象分類名。既定なら「総資産(マネーフォワードの合計)」 */
    name: string;
    /** 集計対象の資産種別名。`null`は既定(CSVの「合計（円）」列をそのまま採る) */
    assetTypeNames: string[] | null;
    /**
     * 集計から差し引く負債のID。
     *
     * 既定(総資産)は空配列になる。マネーフォワードの合計に負債は含まれず
     * (CSVに出力されないため)、負債を達成度に効かせるには負債を含む分類軸を作って
     * 選ぶ必要がある(docs/screen-requirements-fire-goal.md B8)。
     */
    debtIds: string[];
    /** 設定されていた分類軸が見つからず既定へフォールバックした場合に`true` */
    missing: boolean;
  };

  /** B8の画面上部に出す参考表示(現在有効な設定方式・現在資産額)のProps */
  type FireGoalSummaryProps = {
    /** 保存済みの設定方式。未設定なら`null` */
    savedMode: FireGoalMode | null;
    /** 現在資産額(円)。資産残高が未取込、または取得に失敗した場合は`null` */
    currentAssetTotal: number | null;
    /** 現在資産額に併記する対象分類名。選択中(未保存)の分類で計算した値に対応する */
    achievementAxisName: string;
  };

  /** B8 FIRE目標設定フォームのProps */
  type FireGoalFormProps = {
    /** 保存済みの値。未設定なら既定値(直接入力・逆算係数4%)を渡す */
    initialValues: FireGoalFormValues;
    /** 達成率の参考表示に使う。取得できていない場合は`null`で、達成率は出さない */
    currentAssetTotal: number | null;
    /** 現在資産額に併記する対象分類名 */
    achievementAxisName: string;
    /** 選択肢にする分類軸(B4の登録順)。1件も無い場合は既定のみを選べる */
    achievementAxisOptions: AchievementAxisOption[];
    /** 選択中の対象分類。既定(総資産)は`null` */
    achievementAxisId: string | null;
    onAchievementAxisChange: (axisId: string | null) => void;
    onSubmit: (goal: FireGoal) => Promise<SaveFireGoalResult>;
  };
}

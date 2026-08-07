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
   * 現在資産額(参考表示)の取得結果。
   *
   * CSVを一度も取り込んでいないアカウントでは資産残高が1件も無いため、
   * 成功しつつ`total: null`が返る。
   */
  type CurrentAssetTotalResult =
    { ok: true; total: number | null } | { ok: false; reason: FirestoreAccessFailureReason };

  /** B8の画面上部に出す参考表示(現在有効な設定方式・現在資産額)のProps */
  type FireGoalSummaryProps = {
    /** 保存済みの設定方式。未設定なら`null` */
    savedMode: FireGoalMode | null;
    /** 現在資産額(円)。資産残高が未取込、または取得に失敗した場合は`null` */
    currentAssetTotal: number | null;
  };

  /** B8 FIRE目標設定フォームのProps */
  type FireGoalFormProps = {
    /** 保存済みの値。未設定なら既定値(直接入力・逆算係数4%)を渡す */
    initialValues: FireGoalFormValues;
    /** 達成率の参考表示に使う。取得できていない場合は`null`で、達成率は出さない */
    currentAssetTotal: number | null;
    onSubmit: (goal: FireGoal) => Promise<SaveFireGoalResult>;
  };
}

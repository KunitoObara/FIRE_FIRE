import type { LucideIcon } from "lucide-react";
import type { z } from "zod";

import type { assumptionsFormSchema } from "@/schemas/assumptions";

declare global {
  /**
   * リスクレベル(docs/screen-requirements-fire-goal.md B9)。
   *
   * 3段階に留めるのは、手で置く前提値であって計測値ではないため。段階を細かくしても
   * 入力の精度は上がらず、ダッシュボードでの見分けだけが難しくなる。
   */
  type AssumptionRiskLevel = "low" | "medium" | "high";

  /** リスクレベルの選択肢1つ分。色と形状の対応は`ASSUMPTION_RISK_LEVELS`が持つ */
  type AssumptionRiskLevelOption = {
    id: AssumptionRiskLevel;
    label: string;
    /** 色だけに頼らず段階を区別するための形状(DESIGN.md 3章) */
    icon: LucideIcon;
    /** アイコンの色を当てるTailwindのクラス */
    className: string;
  };

  /**
   * 資産種別1つ分の想定値。
   *
   * どちらの欄も未設定を`null`で表す。片方だけ設定した状態(利回りは決めたがリスクは
   * まだ、等)をそのまま保存できるようにするため、2つの欄は互いに必須にしない。
   */
  type AssetAssumption = {
    /** 想定利回り(年率%)。4%なら`4`。比率(0.04)ではなくパーセントの数値で持つ(`FireGoal`と同じ) */
    expectedReturn: number | null;
    riskLevel: AssumptionRiskLevel | null;
  };

  /**
   * 資産種別名をキーにした想定値(`users/{uid}/settings/assumptions`の`entries`)。
   *
   * キーを資産種別名そのものにしているのは、資産種別がCSVの列の顔ぶれで決まる動的な
   * マスタデータで、アプリ側にIDを振る場所が無いため(`assetSnapshots`の`byType`と同じ)。
   */
  type AssetAssumptions = Record<string, AssetAssumption>;

  /** 保存済みの想定値の取得結果。未設定は失敗ではなく空のレコードで返す */
  type AssumptionsResult =
    | { ok: true; assumptions: AssetAssumptions }
    | { ok: false; reason: FirestoreAccessFailureReason };

  /** 想定値の保存結果。保存後の遷移先(B1)は固定なので返す値は持たない */
  type SaveAssumptionsResult = { ok: true } | { ok: false; reason: FirestoreAccessFailureReason };

  /** 直近の資産残高から取り出した、資産種別1つ分の現在残高(B9の表示項目) */
  type AssetTypeBalance = {
    assetTypeName: string;
    /** 円単位の残高。直近の集計日の値をそのまま使う */
    balance: number;
  };

  /**
   * 資産種別ごとの現在残高の取得結果。
   *
   * CSVを一度も取り込んでいないアカウントでは資産残高が1件も無いため、成功しつつ
   * 空配列が返る。設定対象が無い状態であって失敗ではない。
   */
  type LatestAssetBalancesResult =
    | { ok: true; balances: AssetTypeBalance[] }
    | { ok: false; reason: FirestoreAccessFailureReason };

  /** B9 想定利回り・リスク設定フォームの入力値(`assumptionsFormSchema`から導出) */
  type AssumptionsFormValues = z.infer<typeof assumptionsFormSchema>;

  /** B9のフォームのProps */
  type AssumptionSettingsFormProps = {
    /** 一覧に並べる資産種別と現在残高。行の並び順もこの配列の順に従う */
    balances: AssetTypeBalance[];
    /** 保存済みの値を入れた初期値。未設定の欄は空欄・未選択で渡す */
    initialValues: AssumptionsFormValues;
    /**
     * 検証を通った入力値をそのまま渡す。保存する形への変換は呼び出し側が行う。
     *
     * 一覧に出ていない資産種別の設定を引き継ぐ必要があり(`toAssetAssumptions`)、その
     * 引き継ぎ元である保存済みの設定を持っているのは呼び出し側だけであるため。
     */
    onSubmit: (values: AssumptionsFormValues) => Promise<SaveAssumptionsResult>;
  };

  /** 取得に失敗した理由の表示のProps(B9) */
  type AssumptionsFailureProps = { reason: FirestoreAccessFailureReason };

  /** リスクレベルの表示(セレクトの選択肢と選択済みの値)のProps */
  type RiskLevelIndicatorProps = {
    /** 未選択のときは`ASSUMPTION_RISK_LEVELS`に無い値が来るため、文字列として受ける */
    level: string;
  };
}

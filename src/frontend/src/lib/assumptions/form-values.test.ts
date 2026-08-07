import { describe, expect, it } from "vitest";

import { toAssetAssumptions, toAssumptionsFormValues } from "@/lib/assumptions/form-values";

const balances: AssetTypeBalance[] = [
  { assetTypeName: "株式(現物)", balance: 18_320_500 },
  { assetTypeName: "預金・現金", balance: 2_140_000 },
];

describe("toAssumptionsFormValues", () => {
  it("保存済みの設定を行の初期値に入れる", () => {
    const values = toAssumptionsFormValues(balances, {
      "株式(現物)": { expectedReturn: 6, riskLevel: "high" },
    });

    expect(values.rows).toEqual([
      { assetTypeName: "株式(現物)", expectedReturn: "6", riskLevel: "high" },
      { assetTypeName: "預金・現金", expectedReturn: "", riskLevel: "unset" },
    ]);
  });

  /** 片方だけ設定した状態も保存できる(2つの欄は互いに必須ではない) */
  it("片方だけ保存されている資産種別は、もう片方を未設定のまま出す", () => {
    const values = toAssumptionsFormValues(balances, {
      "預金・現金": { expectedReturn: 0.01, riskLevel: null },
    });

    expect(values.rows[1]).toEqual({
      assetTypeName: "預金・現金",
      expectedReturn: "0.01",
      riskLevel: "unset",
    });
  });

  /** 行の顔ぶれを決めるのは直近の資産残高。現在残高を出せない資産種別は行にしない */
  it("直近の残高に無い資産種別は行にしない", () => {
    const values = toAssumptionsFormValues(balances, {
      暗号資産: { expectedReturn: 10, riskLevel: "high" },
    });

    expect(values.rows.map((row) => row.assetTypeName)).toEqual(["株式(現物)", "預金・現金"]);
  });
});

describe("toAssetAssumptions", () => {
  it("入力値を保存する形に変換する", () => {
    const assumptions = toAssetAssumptions(
      {
        rows: [
          { assetTypeName: "株式(現物)", expectedReturn: "6.0", riskLevel: "high" },
          { assetTypeName: "預金・現金", expectedReturn: "0.01", riskLevel: "low" },
        ],
      },
      {},
    );

    expect(assumptions).toEqual({
      "株式(現物)": { expectedReturn: 6, riskLevel: "high" },
      "預金・現金": { expectedReturn: 0.01, riskLevel: "low" },
    });
  });

  it("未設定の欄はnullで保存する", () => {
    const assumptions = toAssetAssumptions(
      { rows: [{ assetTypeName: "株式(現物)", expectedReturn: "", riskLevel: "high" }] },
      {},
    );

    expect(assumptions["株式(現物)"]).toEqual({ expectedReturn: null, riskLevel: "high" });
  });

  it("どちらの欄も未設定の行は保存しない", () => {
    const assumptions = toAssetAssumptions(
      { rows: [{ assetTypeName: "株式(現物)", expectedReturn: "", riskLevel: "unset" }] },
      {},
    );

    expect(assumptions).toEqual({});
  });

  /** CSVの列から消えただけの資産種別の設定を、保存のたびに失わないようにする */
  it("一覧に出ていない資産種別の設定は引き継ぐ", () => {
    const assumptions = toAssetAssumptions(
      { rows: [{ assetTypeName: "株式(現物)", expectedReturn: "6", riskLevel: "high" }] },
      {
        "株式(現物)": { expectedReturn: 3, riskLevel: "low" },
        暗号資産: { expectedReturn: 10, riskLevel: "high" },
      },
    );

    expect(assumptions).toEqual({
      // 一覧に出ている資産種別は入力値で上書きする
      "株式(現物)": { expectedReturn: 6, riskLevel: "high" },
      暗号資産: { expectedReturn: 10, riskLevel: "high" },
    });
  });

  /** 一覧に出ている資産種別を空欄に戻したら、引き継ぎではなく解除として扱う */
  it("一覧に出ている資産種別を未設定に戻したら保存しない", () => {
    const assumptions = toAssetAssumptions(
      { rows: [{ assetTypeName: "株式(現物)", expectedReturn: "", riskLevel: "unset" }] },
      { "株式(現物)": { expectedReturn: 3, riskLevel: "low" } },
    );

    expect(assumptions).toEqual({});
  });
});

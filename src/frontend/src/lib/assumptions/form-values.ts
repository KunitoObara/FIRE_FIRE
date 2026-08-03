import { UNSET_RISK_LEVEL_VALUE } from "@/constants/assumptions";

/**
 * B9のフォームの入力値と、保存する想定利回り・リスクの相互変換。
 *
 * フォームは想定利回りを文字列で持ち(`src/schemas/assumptions.ts`)、Firestoreには数値で
 * 保存する。変換をここに閉じ込め、画面とリポジトリのどちらにも「文字列と数値のどちらで
 * 扱うか」の判断を持たせない(B7・B8の`form-values.ts`と同じ役割)。
 */

/** 想定利回りの入力を保存する数値に変換する。未入力・解釈できない値は`null`(未設定)にする */
const toOptionalNumber = (value: string): number | null => {
  if (value.length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * 一覧に並べる資産種別と保存済みの設定から、フォームの初期値を組み立てる。
 *
 * 行の並び順・顔ぶれは`balances`(直近の資産残高)が決める。保存済みの設定にしか無い
 * 資産種別は行にしない — 直近の残高が無い以上「現在残高」を出せず、B9の表示項目を
 * 満たさない行になるため。その設定は`toAssetAssumptions`が保存時に引き継ぐ。
 */
export const toAssumptionsFormValues = (
  balances: AssetTypeBalance[],
  assumptions: AssetAssumptions,
): AssumptionsFormValues => ({
  rows: balances.map(({ assetTypeName }) => {
    const saved = assumptions[assetTypeName];

    return {
      assetTypeName,
      expectedReturn:
        saved?.expectedReturn === undefined || saved.expectedReturn === null
          ? ""
          : String(saved.expectedReturn),
      riskLevel: saved?.riskLevel ?? UNSET_RISK_LEVEL_VALUE,
    };
  }),
});

/**
 * 入力値を保存する形に変換する。**バリデーション通過後の値にのみ使う**
 * (形式は`assumptionsFormSchema`が保証している)。
 *
 * 一覧に出ていない資産種別の設定(`saved`にしか無いキー)はそのまま引き継ぐ。資産種別は
 * CSVの列の顔ぶれで決まり、その月に保有していなければ列ごと消える。画面に出ていない間に
 * 保存したというだけで、以前に置いた想定利回りを消してしまわないようにするため。
 *
 * 両方の欄が未設定の行は書き込まない。一度も触っていない資産種別の分まで空の想定値が
 * 並ぶと、保存済みの設定と区別が付かなくなるため。
 */
export const toAssetAssumptions = (
  values: AssumptionsFormValues,
  saved: AssetAssumptions,
): AssetAssumptions => {
  const editedNames = new Set(values.rows.map((row) => row.assetTypeName));
  const assumptions: AssetAssumptions = Object.fromEntries(
    Object.entries(saved).filter(([assetTypeName]) => !editedNames.has(assetTypeName)),
  );

  for (const row of values.rows) {
    const expectedReturn = toOptionalNumber(row.expectedReturn);
    const riskLevel = row.riskLevel === UNSET_RISK_LEVEL_VALUE ? null : row.riskLevel;

    if (expectedReturn === null && riskLevel === null) {
      continue;
    }

    assumptions[row.assetTypeName] = { expectedReturn, riskLevel };
  }

  return assumptions;
};

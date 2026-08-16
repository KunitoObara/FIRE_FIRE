import { describe, expect, it } from "vitest";

import {
  resolveNextValueHistoryCount,
  shouldRecordValueHistory,
} from "@/lib/real-estate/property-repository";

/**
 * 時価・ローン残高の履歴を積むかどうかの判断
 * (docs/screen-requirements-real-estate.md B7「時価・ローン残高の履歴」)。
 *
 * Firestoreに触る前の判断だけを切り出してあるので、ここは単体で確かめられる。誤ると
 * 資産推移グラフが過去に遡って別の値を描くため、B11の`buildNextBalanceHistory`と同じく
 * 判断そのものにテストを置く。
 */

const property = (overrides: Partial<RealEstateProperty> = {}): RealEstateProperty => ({
  id: "shibuya-101",
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  acquiredOn: "2019-04",
  marketValue: 32_000_000,
  loanBalance: 18_400_000,
  updatedAt: "2026-06-01",
  valueHistory: { "2026-06-01": { marketValue: 32_000_000, loanBalance: 18_400_000 } },
  ...overrides,
});

const input = (overrides: Partial<RealEstatePropertyInput> = {}): RealEstatePropertyInput => ({
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  acquiredOn: "2019-04",
  marketValue: 32_000_000,
  loanBalance: 18_400_000,
  rental: null,
  ...overrides,
});

describe("shouldRecordValueHistory", () => {
  it("時価が変わった保存では記録する", () => {
    expect(shouldRecordValueHistory(property(), input({ marketValue: 33_000_000 }))).toBe(true);
  });

  it("ローン残高が変わった保存では記録する", () => {
    expect(shouldRecordValueHistory(property(), input({ loanBalance: 17_900_000 }))).toBe(true);
  });

  /**
   * 変わっていない保存で記録を増やしても同じ値の点が並ぶだけで、推移の描画結果は変わらない
   * (物件名や所在地だけを直した保存がこれにあたる)。
   */
  it("時価もローン残高も変わらない保存では記録しない", () => {
    expect(shouldRecordValueHistory(property(), input({ name: "〇〇マンション102号室" }))).toBe(
      false,
    );
  });

  /**
   * B4-8より前に登録された物件は履歴を持たない。比べる相手の「前回の記録」が無いうえ、
   * `firestore.rules`が`valueHistory`を必須キーで見るため、ここで積まないと既存の物件を
   * 編集しただけで保存が拒否される。
   */
  it("履歴を1件も持たない物件は、値が変わっていなくても記録する", () => {
    expect(shouldRecordValueHistory(property({ valueHistory: {} }), input())).toBe(true);
  });

  it("保存済みの物件が見つからない場合は記録する", () => {
    expect(shouldRecordValueHistory(undefined, input())).toBe(true);
  });
});

describe("resolveNextValueHistoryCount", () => {
  it("新しい日の記録は件数を1つ増やす", () => {
    expect(
      resolveNextValueHistoryCount(
        { "2026-06-01": { marketValue: 32_000_000, loanBalance: 18_400_000 } },
        "2026-08-13",
      ),
    ).toBe(2);
  });

  /**
   * キーが日付なので、同じ日に2回目の保存をしてもその日の記録が上書きされるだけで増えない
   * (CSV取込が同じ日付を上書きするのと同じ冪等な扱い)。
   */
  it("同じ日に2回目を保存しても件数は増えない", () => {
    expect(
      resolveNextValueHistoryCount(
        { "2026-08-13": { marketValue: 32_000_000, loanBalance: 18_400_000 } },
        "2026-08-13",
      ),
    ).toBe(1);
  });

  it("履歴が空なら1件目になる", () => {
    expect(resolveNextValueHistoryCount({}, "2026-08-13")).toBe(1);
  });
});

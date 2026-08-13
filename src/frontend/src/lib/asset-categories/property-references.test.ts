import { describe, expect, it } from "vitest";

import { resolveCategoryAxisPropertyReferences } from "@/lib/asset-categories/property-references";

/**
 * 分類軸が参照している物件のうち、削除されたものを見分ける
 * (docs/screen-requirements-dashboard.md B4「集計対象に不動産を含める」)。
 *
 * 一覧の件数表示・編集フォームの初期値・削除可否の判定がすべてこの関数から出るので、
 * ここがずれると3か所が別々の数を出す。
 */

const property = (id: string): RealEstateProperty => ({
  id,
  name: `物件 ${id}`,
  location: "",
  acquiredOn: null,
  marketValue: 10_000_000,
  loanBalance: 0,
  updatedAt: "2026-06-01",
  valueHistory: {},
});

const ready = (ids: string[]): PropertyOptionsState => ({
  status: "ready",
  properties: ids.map(property),
});

describe("resolveCategoryAxisPropertyReferences", () => {
  it("残っている物件は反映方法ごと残し、削除済みは件数として数える", () => {
    const references = resolveCategoryAxisPropertyReferences(
      { "shibuya-101": "spread", "sold-out": "marketValue" },
      ready(["shibuya-101"]),
    );

    expect(references).toEqual({
      activeValuations: { "shibuya-101": "spread" },
      missingCount: 1,
    });
  });

  /** 反映方法まで返すのは、フォームの初期値がそのまま「どの物件をどちらの額で反映するか」だから */
  it("反映方法を落とさない", () => {
    const references = resolveCategoryAxisPropertyReferences(
      { "shibuya-101": "marketValue" },
      ready(["shibuya-101"]),
    );

    expect(references?.activeValuations["shibuya-101"]).toBe("marketValue");
  });

  it("参照が1件も無ければ空のまま返す", () => {
    expect(resolveCategoryAxisPropertyReferences({}, ready(["shibuya-101"]))).toEqual({
      activeValuations: {},
      missingCount: 0,
    });
  });

  /**
   * 登録済みの物件が分からない状態では削除済みかどうかを判定できない。
   * 「取得に失敗しただけ」を「削除された」と読ませないため、`null`を返して呼び出し側に委ねる(B4)。
   */
  it("読み込み中は判定せずnullを返す", () => {
    expect(
      resolveCategoryAxisPropertyReferences({ "shibuya-101": "spread" }, { status: "loading" }),
    ).toBeNull();
  });

  it("取得に失敗したときも判定せずnullを返す", () => {
    expect(
      resolveCategoryAxisPropertyReferences(
        { "shibuya-101": "spread" },
        { status: "error", message: "取得できませんでした" },
      ),
    ).toBeNull();
  });
});

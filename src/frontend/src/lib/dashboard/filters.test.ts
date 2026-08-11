import { describe, expect, it } from "vitest";

import {
  buildDashboardHref,
  resolveAxisId,
  resolvePeriodId,
  resolveTrendModeId,
} from "@/lib/dashboard/filters";

const axes: AssetCategoryAxis[] = [
  { id: "total-assets", name: "総資産" },
  { id: "investment-assets", name: "投資性資産" },
];

describe("resolveAxisId", () => {
  it("登録済みの分類軸IDならそのまま使う", () => {
    expect(resolveAxisId("investment-assets", axes)).toBe("investment-assets");
  });

  it("未指定なら先頭の分類軸に落とす", () => {
    expect(resolveAxisId(undefined, axes)).toBe("total-assets");
  });

  /** B4で分類軸を削除すると、既存のブックマークは存在しないIDを指したままになる */
  it("存在しない分類軸IDは先頭の分類軸に落とす", () => {
    expect(resolveAxisId("deleted-axis", axes)).toBe("total-assets");
  });

  it("同名のクエリが複数あるときも先頭の分類軸に落とす", () => {
    expect(resolveAxisId(["total-assets", "investment-assets"], axes)).toBe("total-assets");
  });

  it("分類軸が1つも無ければundefinedを返す", () => {
    expect(resolveAxisId("total-assets", [])).toBeUndefined();
  });
});

describe("resolvePeriodId", () => {
  it("選択肢にある期間ならそのまま使う", () => {
    expect(resolvePeriodId("3y")).toBe("3y");
  });

  it("未指定なら既定の1年に落とす", () => {
    expect(resolvePeriodId(undefined)).toBe("1y");
  });

  it("選択肢に無い値も既定の1年に落とす", () => {
    expect(resolvePeriodId("10y")).toBe("1y");
  });
});

describe("resolveTrendModeId", () => {
  it("選択肢にある表示ならそのまま使う", () => {
    expect(resolveTrendModeId("net")).toBe("net");
  });

  /** 既定は積み上げ(docs/screen-requirements-dashboard.md B1) */
  it("未指定なら既定の積み上げに落とす", () => {
    expect(resolveTrendModeId(undefined)).toBe("stacked");
  });

  it("選択肢に無い値も既定の積み上げに落とす", () => {
    expect(resolveTrendModeId("area")).toBe("stacked");
  });

  it("同名のクエリが複数あるときも既定の積み上げに落とす", () => {
    expect(resolveTrendModeId(["net", "stacked"])).toBe("stacked");
  });
});

describe("buildDashboardHref", () => {
  it("分類軸・期間・資産推移の表示をすべてクエリに載せる", () => {
    expect(buildDashboardHref("investment-assets", "3y", "net")).toBe(
      "/dashboard?axis=investment-assets&period=3y&trend=net",
    );
  });

  /** 1つだけ載せると、他の選択が切り替えのたびに既定へ戻ってしまう */
  it("分類軸が無い場合でも期間と表示は載せる", () => {
    expect(buildDashboardHref(undefined, "all", "stacked")).toBe(
      "/dashboard?period=all&trend=stacked",
    );
  });
});

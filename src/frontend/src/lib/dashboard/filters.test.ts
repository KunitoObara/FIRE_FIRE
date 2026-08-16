import { describe, expect, it } from "vitest";

import {
  buildDashboardHref,
  resolveAxisId,
  resolveMonthId,
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
    expect(resolveTrendModeId("assets-only")).toBe("assets-only");
  });

  /** 既定は積み上げ(docs/screen-requirements-dashboard.md B1) */
  it("未指定なら既定の積み上げに落とす", () => {
    expect(resolveTrendModeId(undefined)).toBe("with-debt");
  });

  it("選択肢に無い値も既定の積み上げに落とす", () => {
    expect(resolveTrendModeId("area")).toBe("with-debt");
  });

  it("同名のクエリが複数あるときも既定の積み上げに落とす", () => {
    expect(resolveTrendModeId(["assets-only", "with-debt"])).toBe("with-debt");
  });
});

/**
 * 収支サマリの対象月(docs/screen-requirements-dashboard.md B1「年月の選択」)。
 * 既定は当月で、当月より後は選べない。
 */
describe("resolveMonthId", () => {
  const now = new Date("2026-08-12T12:00:00+09:00");

  it("`yyyy-MM`として読める過去の月ならそのまま使う", () => {
    expect(resolveMonthId("2025-03", now)).toBe("2025-03");
  });

  it("未指定なら当月に落とす", () => {
    expect(resolveMonthId(undefined, now)).toBe("2026-08");
  });

  /** URLは手で編集できる。読めない値でエラーにはせず、既定へ落とす(分類軸・期間と同じ) */
  it("`yyyy-MM`として読めない値は当月に落とす", () => {
    expect(resolveMonthId("2026-8", now)).toBe("2026-08");
    expect(resolveMonthId("august", now)).toBe("2026-08");
    expect(resolveMonthId("2026-08-01", now)).toBe("2026-08");
  });

  /** 桁だけを見る形だと素通りする。月は01〜12に絞る(B11の発生年月と同じ理由) */
  it("13月のような月は当月に落とす", () => {
    expect(resolveMonthId("2026-13", now)).toBe("2026-08");
    expect(resolveMonthId("2026-00", now)).toBe("2026-08");
  });

  /** 未来の月には数える取引が無い。ピッカーで押せないのと同じ基準で丸める */
  it("当月より後の月は当月に落とす", () => {
    expect(resolveMonthId("2026-09", now)).toBe("2026-08");
    expect(resolveMonthId("2027-01", now)).toBe("2026-08");
  });

  it("当月そのものはそのまま使う", () => {
    expect(resolveMonthId("2026-08", now)).toBe("2026-08");
  });

  it("同名のクエリが複数あるときも当月に落とす", () => {
    expect(resolveMonthId(["2025-03", "2025-04"], now)).toBe("2026-08");
  });
});

describe("buildDashboardHref", () => {
  it("分類軸・期間・資産推移の表示・対象月をすべてクエリに載せる", () => {
    expect(
      buildDashboardHref({
        axisId: "investment-assets",
        periodId: "3y",
        trendMode: "assets-only",
        month: "2026-08",
      }),
    ).toBe("/dashboard?axis=investment-assets&period=3y&debt=assets-only&month=2026-08");
  });

  /** 1つだけ載せると、他の選択が切り替えのたびに既定へ戻ってしまう */
  it("分類軸が無い場合でも期間・表示・対象月は載せる", () => {
    expect(
      buildDashboardHref({
        axisId: undefined,
        periodId: "all",
        trendMode: "with-debt",
        month: "2025-03",
      }),
    ).toBe("/dashboard?period=all&debt=with-debt&month=2025-03");
  });
});

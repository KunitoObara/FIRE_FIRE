import { describe, expect, it } from "vitest";

import {
  DEBT_ORIGINATED_ON_FORMAT_MESSAGE,
  DEBT_ORIGINATED_ON_FUTURE_MESSAGE,
  DEBT_ORIGINATED_ON_TOO_OLD_MESSAGE,
} from "@/constants/debts";
import { debtDocumentSchema, validateOriginatedOn } from "@/schemas/debts";

/**
 * 発生年月の検証(docs/screen-requirements-dashboard.md B11「バリデーション」)。
 *
 * 当月の判定は端末の時計から採るため、テストからは`now`を渡して固定する。
 */
describe("validateOriginatedOn", () => {
  const now = new Date("2026-08-12T00:00:00+09:00");

  /** 任意入力なので、空文字は「未登録」であってエラーではない */
  it("空文字は未入力として通す", () => {
    expect(validateOriginatedOn("", now)).toBeNull();
  });

  it("当月までの年月を通す", () => {
    expect(validateOriginatedOn("2019-04", now)).toBeNull();
    expect(validateOriginatedOn("2026-08", now)).toBeNull();
  });

  /** まだ借りていない負債を過去のグラフに反映させない */
  it("当月より後は弾く", () => {
    expect(validateOriginatedOn("2026-09", now)).toBe(DEBT_ORIGINATED_ON_FUTURE_MESSAGE);
  });

  it("年月として読めない値は弾く", () => {
    expect(validateOriginatedOn("2019-4", now)).toBe(DEBT_ORIGINATED_ON_FORMAT_MESSAGE);
    expect(validateOriginatedOn("2019-04-01", now)).toBe(DEBT_ORIGINATED_ON_FORMAT_MESSAGE);
  });

  /**
   * 桁だけを見る形にすると、当月との比較も文字列の辞書順なので`2020-13`は保存まで素通りし、
   * グラフの起点が12月と1月のあいだに入る(PR #143 のレビュー指摘)
   */
  it("実在しない月は弾く", () => {
    expect(validateOriginatedOn("2020-13", now)).toBe(DEBT_ORIGINATED_ON_FORMAT_MESSAGE);
    expect(validateOriginatedOn("2020-00", now)).toBe(DEBT_ORIGINATED_ON_FORMAT_MESSAGE);
    expect(validateOriginatedOn("2020-12", now)).toBeNull();
  });

  /** 桁を打ち間違えた年を止める歯止め。実在しうる借入年は締め出さない */
  it("下限より前は弾く", () => {
    expect(validateOriginatedOn("0202-04", now)).toBe(DEBT_ORIGINATED_ON_TOO_OLD_MESSAGE);
    expect(validateOriginatedOn("1900-01", now)).toBeNull();
  });
});

describe("debtDocumentSchema", () => {
  const stored = {
    name: "住宅ローン",
    balance: 18_400_000,
    interestRate: null,
    repaymentMonths: null,
    updatedAt: "2026-07-12",
    balanceHistory: { "2026-07-12": 18_400_000 },
    createdAt: null,
  };

  /**
   * 発生年月は[B11-7]で足したキーなので、それ以前に保存された負債のドキュメントには無い。
   * 欠損で解釈できなくなると、保存し直すまでその負債が画面から消える
   */
  it("発生年月を持たない既存のドキュメントは未登録として読む", () => {
    const parsed = debtDocumentSchema.safeParse(stored);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.originatedOn).toBeNull();
  });

  it("発生年月が入っていればそのまま読む", () => {
    expect(
      debtDocumentSchema.safeParse({ ...stored, originatedOn: "2019-04" }).data?.originatedOn,
    ).toBe("2019-04");
  });

  /** 形の崩れた値はグラフの起点を決められないので、その負債ごと落とす(呼び出し側が1件だけ飛ばす) */
  it("年月として読めない発生年月は解釈しない", () => {
    expect(debtDocumentSchema.safeParse({ ...stored, originatedOn: "2019/04" }).success).toBe(
      false,
    );
  });
});

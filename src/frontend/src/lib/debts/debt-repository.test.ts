import { describe, expect, it } from "vitest";

import { buildNextBalanceHistory, resolveDeletedDebtIds } from "@/lib/debts/debt-repository";

const buildInput = (id: string | null): DebtInput => ({
  id,
  name: "住宅ローン",
  balance: 1_000_000,
  interestRate: null,
  repaymentMonths: null,
});

describe("resolveDeletedDebtIds", () => {
  it("画面上で行が消された負債を削除対象にする", () => {
    expect(resolveDeletedDebtIds(["debt-1", "debt-2"], [buildInput("debt-2")])).toEqual(["debt-1"]);
  });

  it("行が1件も消されていなければ削除しない", () => {
    expect(
      resolveDeletedDebtIds(["debt-1", "debt-2"], [buildInput("debt-1"), buildInput("debt-2")]),
    ).toEqual([]);
  });

  /**
   * 削除対象をサーバーの最新状態から求めると、画面が存在を知らない負債まで消える。
   * 同じアカウントを2つのタブで開き、タブBで負債を追加したあとタブA(古いフォーム状態)で
   * 保存すると、タブBで追加した負債が消えてしまう(PR #83 のレビュー指摘)。
   */
  it("画面が知らない負債(別のタブで追加されたもの)は削除対象にしない", () => {
    // 画面が読み込んだ時点は debt-1 のみ。debt-added は別のタブで追加されたもの
    const deleted = resolveDeletedDebtIds(["debt-1"], [buildInput("debt-1")]);

    expect(deleted).not.toContain("debt-added");
    expect(deleted).toEqual([]);
  });

  it("追加しただけの行(id未採番)は削除の判定に影響しない", () => {
    expect(resolveDeletedDebtIds(["debt-1"], [buildInput("debt-1"), buildInput(null)])).toEqual([]);
  });

  it("すべての行を消した保存では、読み込んだ負債だけが削除対象になる", () => {
    expect(resolveDeletedDebtIds(["debt-1", "debt-2"], [])).toEqual(["debt-1", "debt-2"]);
  });
});

describe("buildNextBalanceHistory", () => {
  const history: DebtBalanceHistory = { "2026-07-12": 18_400_000 };

  /** 同じ値の点が並ぶだけで推移の描画結果は変わらないため、記録を増やさない */
  it("残債が前回と変わっていなければ記録を増やさない", () => {
    expect(buildNextBalanceHistory(history, 18_400_000, 18_400_000, "2026-08-08")).toEqual(history);
  });

  it("残債が変わっていればその日の記録を足す", () => {
    expect(buildNextBalanceHistory(history, 18_400_000, 18_000_000, "2026-08-08")).toEqual({
      "2026-07-12": 18_400_000,
      "2026-08-08": 18_000_000,
    });
  });

  /** CSV取込が同じ日付を上書きするのと同じ冪等な扱い */
  it("同じ日に複数回保存した場合はその日の記録を上書きする", () => {
    const first = buildNextBalanceHistory(history, 18_400_000, 18_000_000, "2026-08-08");
    const second = buildNextBalanceHistory(first, 18_400_000, 17_500_000, "2026-08-08");

    expect(second).toEqual({ "2026-07-12": 18_400_000, "2026-08-08": 17_500_000 });
    expect(Object.keys(second)).toHaveLength(2);
  });

  /** 新規登録は前回の残債が無いので、必ず最初の記録が残る */
  it("新規の負債は最初の記録を作る", () => {
    expect(buildNextBalanceHistory({}, undefined, 450_000, "2026-08-08")).toEqual({
      "2026-08-08": 450_000,
    });
  });

  /** 完済して0円になった場合も「変わった」なので記録する */
  it("残債が0円になった場合も記録する", () => {
    expect(buildNextBalanceHistory(history, 18_400_000, 0, "2026-08-08")).toEqual({
      "2026-07-12": 18_400_000,
      "2026-08-08": 0,
    });
  });

  /** 引数の履歴は変更しない(呼び出し側が上限判定に元の値を使う) */
  it("渡された履歴を書き換えない", () => {
    buildNextBalanceHistory(history, 18_400_000, 18_000_000, "2026-08-08");

    expect(history).toEqual({ "2026-07-12": 18_400_000 });
  });
});

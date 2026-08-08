import { describe, expect, it } from "vitest";

import { resolveDeletedDebtIds } from "@/lib/debts/debt-repository";

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

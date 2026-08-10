import { describe, expect, it } from "vitest";

import { MAX_TRANSACTION_ROWS } from "@/constants/transactions-import";
import { decodeCsvBytes } from "@/lib/csv/decode";
import { parseTransactionCsv } from "@/lib/csv/transaction-csv";

/**
 * 実際のマネーフォワード「収入・支出詳細」エクスポートと同じ形(全フィールドがクォート囲み・
 * 日付は降順)。**値はすべて架空**で、実データは`ID`も含めて置かない(リポジトリは公開)。
 */
const HEADER =
  '"計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","メモ","振替","ID"';

const VALID_CSV = [
  HEADER,
  '"1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","","0","aaaa1111"',
  '"1","2026/07/30","給与","300000","〇〇銀行","収入","給与","7月分","0","bbbb2222"',
  '"1","2026/07/15","証券口座へ入金","-100000","〇〇銀行","振替","口座間移動","","1","cccc3333"',
  '"0","2026/06/30","立替分の精算","-5000","〇〇カード","その他","立替","集計から外す","0","dddd4444"',
].join("\r\n");

/** 1行だけのCSVを組み立てる。列の値を差し替えて異常系を作るために使う */
const buildCsv = (cells: string[], header = HEADER): string =>
  [header, cells.map((cell) => `"${cell}"`).join(",")].join("\r\n");

/** 正常な1行。異常系のテストではこの一部だけを差し替える */
const VALID_CELLS = [
  "1",
  "2026/07/31",
  "スーパー〇〇",
  "-3200",
  "〇〇銀行",
  "食費",
  "食料品",
  "",
  "0",
  "aaaa1111",
];

/** 指定の列だけを差し替えた1行のCSVを作る */
const buildCsvWith = (overrides: Record<number, string>): string =>
  buildCsv(VALID_CELLS.map((cell, index) => overrides[index] ?? cell));

/** 成功した結果から中身を取り出す。失敗していればテストをその場で落とす */
const expectParsed = (csv: string): TransactionCsvParsed => {
  const result = parseTransactionCsv(csv);

  if (!result.ok) {
    throw new Error(`パースに失敗した: ${result.reason}`);
  }

  return result.parsed;
};

const expectFailure = (csv: string): TransactionCsvParseFailureReason => {
  const result = parseTransactionCsv(csv);

  if (result.ok) {
    throw new Error("パースが成功してしまった");
  }

  return result.reason;
};

describe("parseTransactionCsv", () => {
  it("10列すべてを取引1件として読む", () => {
    expect(expectParsed(VALID_CSV).rows[0]).toEqual({
      id: "aaaa1111",
      date: "2026-07-31",
      content: "スーパー〇〇",
      amount: -3200,
      account: "〇〇銀行",
      categoryMajor: "食費",
      categoryMinor: "食料品",
      memo: "",
      isTransfer: false,
      isCalculationTarget: true,
    });
  });

  it("振替・計算対象の1/0を真偽値にする", () => {
    const rows = expectParsed(VALID_CSV).rows;

    expect(rows.map((row) => [row.isTransfer, row.isCalculationTarget])).toEqual([
      [false, true],
      [false, true],
      [true, true],
      [false, false],
    ]);
  });

  it("CSVに現れた順(新しい日付が先頭)のまま返す", () => {
    expect(expectParsed(VALID_CSV).rows.map((row) => row.date)).toEqual([
      "2026-07-31",
      "2026-07-30",
      "2026-07-15",
      "2026-06-30",
    ]);
  });

  it("期間は並び順に関わらず最も古い日付と最も新しい日付になる", () => {
    const { periodFrom, periodTo } = expectParsed(VALID_CSV);

    expect({ periodFrom, periodTo }).toEqual({ periodFrom: "2026-06-30", periodTo: "2026-07-31" });
  });

  it("列の順序には依存せず、ヘッダーの名前で引く", () => {
    const csv = [
      '"ID","日付","金額（円）","内容","保有金融機関","大項目","中項目","メモ","振替","計算対象"',
      '"aaaa1111","2026/07/31","-3200","スーパー〇〇","〇〇銀行","食費","食料品","","0","1"',
    ].join("\r\n");

    expect(expectParsed(csv).rows[0]?.amount).toBe(-3200);
  });

  it("知らない列は無視して取り込む", () => {
    const csv = buildCsv(
      [...VALID_CELLS, "将来マネーフォワードが足すかもしれない列"],
      `${HEADER},"通貨"`,
    );

    expect(expectParsed(csv).rows[0]?.id).toBe("aaaa1111");
  });

  it("メモ列そのものが無いファイルはメモを空文字として扱う", () => {
    const header =
      '"計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","振替","ID"';
    const csv = [
      header,
      '"1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","0","aaaa1111"',
    ].join("\r\n");

    expect(expectParsed(csv).rows[0]?.memo).toBe("");
  });

  it("中項目が空の取引はそのまま空文字で持つ", () => {
    expect(expectParsed(buildCsvWith({ 6: "" })).rows[0]?.categoryMinor).toBe("");
  });

  it("文字列の前後の空白だけを落とす", () => {
    const parsed = expectParsed(buildCsvWith({ 2: "  スーパー〇〇  ", 5: " 食費 " }));

    expect(parsed.rows[0]).toMatchObject({ content: "スーパー〇〇", categoryMajor: "食費" });
  });

  it("全角・半角の違いは統一しない(画面で見える差はそのまま残す)", () => {
    const parsed = expectParsed(
      [
        HEADER,
        '"1","2026/07/31","A","-3200","〇〇銀行","ＡＴＭ手数料","","","0","aaaa1111"',
        '"1","2026/07/30","B","-3200","〇〇銀行","ATM手数料","","","0","bbbb2222"',
      ].join("\r\n"),
    );

    expect(parsed.rows.map((row) => row.categoryMajor)).toEqual(["ＡＴＭ手数料", "ATM手数料"]);
  });

  it("桁区切りのカンマが入った金額を読む", () => {
    expect(expectParsed(buildCsvWith({ 3: "-1,234,567" })).rows[0]?.amount).toBe(-1_234_567);
  });

  it("収入はプラスのまま保つ", () => {
    expect(expectParsed(buildCsvWith({ 3: "300000" })).rows[0]?.amount).toBe(300_000);
  });

  it("0円の取引を、金額が読めなかった行と取り違えない", () => {
    // `0`はfalsyなので、真偽で判定すると空欄と同じ扱いになり行ごと弾かれる
    expect(expectParsed(buildCsvWith({ 3: "0" })).rows[0]?.amount).toBe(0);
  });

  it("UTF-8のBOMが付いたファイルでも先頭の列名を引ける", () => {
    // BOMを落とさないと先頭列が`﻿計算対象`になり、`missing-column`で弾かれる。
    // 文字コードの判定は`decode.ts`と共通なので、そこを通した文字列で確かめる
    const bytes = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode(buildCsv(VALID_CELLS)),
    ]);

    expect(expectParsed(decodeCsvBytes(bytes.buffer)).rows[0]?.isCalculationTarget).toBe(true);
  });

  it("同じ日・同じ金額・同じ内容の行を、IDが違えば別々の取引として残す", () => {
    // 交通費のように実際に起きる。ハッシュを鍵にすると1件に潰れる(4章で却下した案)
    const csv = [
      HEADER,
      '"1","2026/07/31","〇〇鉄道","-200","〇〇カード","交通費","電車","","0","aaaa1111"',
      '"1","2026/07/31","〇〇鉄道","-200","〇〇カード","交通費","電車","","0","bbbb2222"',
    ].join("\r\n");
    const rows = expectParsed(csv).rows;

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(["aaaa1111", "bbbb2222"]);
  });

  it("同じ日付の行が複数あっても失敗しない(1日1行の資産残高推移とは前提が逆)", () => {
    const csv = [
      HEADER,
      '"1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","","0","aaaa1111"',
      '"1","2026/07/31","カフェ〇〇","-500","〇〇カード","食費","外食","","0","bbbb2222"',
    ].join("\r\n");

    expect(expectParsed(csv).rows).toHaveLength(2);
  });

  describe("パース失敗", () => {
    it("空のファイルは`empty-file`", () => {
      expect(expectFailure("   ")).toBe("empty-file");
    });

    it("ヘッダーだけのファイルは`no-data-rows`", () => {
      expect(expectFailure(HEADER)).toBe("no-data-rows");
    });

    it("必須列が無いファイルは`missing-column`", () => {
      const header =
        '"計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","メモ","振替"';

      expect(
        expectFailure(
          [header, '"1","2026/07/31","A","-3200","銀行","食費","","","0"'].join("\r\n"),
        ),
      ).toBe("missing-column");
    });

    it("列がヘッダーより少ない行は`missing-column`", () => {
      const csv = [HEADER, '"1","2026/07/31","A","-3200"'].join("\r\n");

      expect(expectFailure(csv)).toBe("missing-column");
    });

    it("ヘッダーより多い列に値がある行も`missing-column`", () => {
      const csv = buildCsv([...VALID_CELLS, "余分な値"]);

      expect(expectFailure(csv)).toBe("missing-column");
    });

    it("行の途中で列がずれたファイルを、値がすべて検査を通っても取り込まない", () => {
      // 保有金融機関が2つのセルに割れた行。以降の値が右へずれ、`振替`の`0`が`ID`として
      // 読まれる。列数を見ないと`ok: true`で通り、無関係の取引を上書きする(4章の`set`)
      const csv = [
        HEADER,
        '"1","2026/07/31","スーパー〇〇","-3200","〇〇","銀行","食費","食料品","1","0","aaaa1111"',
      ].join("\r\n");

      expect(expectFailure(csv)).toBe("missing-column");
    });

    it("末尾のカンマで空の列が増えただけの行は取り込める", () => {
      const csv = [HEADER, `${VALID_CELLS.map((cell) => `"${cell}"`).join(",")},`].join("\r\n");

      expect(expectParsed(csv).rows[0]?.id).toBe("aaaa1111");
    });

    it("同じ名前の列が複数あるファイルは`duplicate-column`", () => {
      const csv = buildCsv([...VALID_CELLS, "2026/07/01"], `${HEADER},"日付"`);

      expect(expectFailure(csv)).toBe("duplicate-column");
    });

    it("行数が上限を超えるファイルは`too-many-rows`", () => {
      const rows = Array.from(
        { length: MAX_TRANSACTION_ROWS + 1 },
        (_unused, index) =>
          `"1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","","0","id${index}"`,
      );

      expect(expectFailure([HEADER, ...rows].join("\r\n"))).toBe("too-many-rows");
    });

    it("日付として読めない値は`invalid-date`", () => {
      expect(expectFailure(buildCsvWith({ 1: "2026-07-31" }))).toBe("invalid-date");
      expect(expectFailure(buildCsvWith({ 1: "" }))).toBe("invalid-date");
    });

    it("金額に小数がある場合は`invalid-amount`(円未満の取引は無い)", () => {
      expect(expectFailure(buildCsvWith({ 3: "-3200.5" }))).toBe("invalid-amount");
    });

    it("金額が空・数値でない場合は`invalid-amount`(0円に読み替えない)", () => {
      expect(expectFailure(buildCsvWith({ 3: "" }))).toBe("invalid-amount");
      expect(expectFailure(buildCsvWith({ 3: "1,000円" }))).toBe("invalid-amount");
    });

    it("ドキュメントIDに使えないIDは`invalid-id`", () => {
      expect(expectFailure(buildCsvWith({ 9: "aaaa/1111" }))).toBe("invalid-id");
      expect(expectFailure(buildCsvWith({ 9: "" }))).toBe("invalid-id");
      expect(expectFailure(buildCsvWith({ 9: "a".repeat(201) }))).toBe("invalid-id");
    });

    it("`__…__`のIDは文字種に収まるが`invalid-id`(Firestoreが拒否する形)", () => {
      expect(expectFailure(buildCsvWith({ 9: "__aaaa1111__" }))).toBe("invalid-id");
      expect(expectFailure(buildCsvWith({ 9: "__" }))).toBe("invalid-id");
    });

    it("末尾だけがアンダースコアのIDは取り込める(`__…__`ではない)", () => {
      expect(expectParsed(buildCsvWith({ 9: "__aaaa1111" })).rows[0]?.id).toBe("__aaaa1111");
    });

    it("同一ファイル内に同じIDの行があると`duplicate-id`", () => {
      const csv = [
        HEADER,
        '"1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","","0","aaaa1111"',
        '"1","2026/07/30","カフェ〇〇","-500","〇〇カード","食費","外食","","0","aaaa1111"',
      ].join("\r\n");

      expect(expectFailure(csv)).toBe("duplicate-id");
    });

    it("計算対象・振替が0/1以外の場合は`invalid-flag`", () => {
      expect(expectFailure(buildCsvWith({ 0: "2" }))).toBe("invalid-flag");
      expect(expectFailure(buildCsvWith({ 0: "" }))).toBe("invalid-flag");
      expect(expectFailure(buildCsvWith({ 8: "true" }))).toBe("invalid-flag");
    });

    it("文字数の上限を超える値は`too-long`", () => {
      expect(expectFailure(buildCsvWith({ 2: "あ".repeat(201) }))).toBe("too-long");
      expect(expectFailure(buildCsvWith({ 4: "あ".repeat(101) }))).toBe("too-long");
      expect(expectFailure(buildCsvWith({ 5: "あ".repeat(41) }))).toBe("too-long");
      expect(expectFailure(buildCsvWith({ 6: "あ".repeat(41) }))).toBe("too-long");
      expect(expectFailure(buildCsvWith({ 7: "あ".repeat(1001) }))).toBe("too-long");
    });

    it("上限ちょうどの値は取り込める", () => {
      expect(expectParsed(buildCsvWith({ 2: "あ".repeat(200) })).rows[0]?.content).toHaveLength(
        200,
      );
    });

    it("失敗した行の位置を`detail`で返す", () => {
      const csv = [
        HEADER,
        '"1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","","0","aaaa1111"',
        '"1","2026/07/30","カフェ〇〇","-500","〇〇カード","食費","外食","","0","bbbb/2222"',
      ].join("\r\n");
      const result = parseTransactionCsv(csv);

      expect(result.ok ? null : result.detail).toBe("3行目");
    });

    it("1行でも不正なら1件も取り込まない", () => {
      const csv = [
        HEADER,
        '"1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","","0","aaaa1111"',
        '"1","2026/07/30","カフェ〇〇","-500","〇〇カード","食費","外食","","2","bbbb2222"',
      ].join("\r\n");

      expect(parseTransactionCsv(csv).ok).toBe(false);
    });
  });
});

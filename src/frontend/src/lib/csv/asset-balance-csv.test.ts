import { describe, expect, it } from "vitest";

import { parseAssetBalanceCsv } from "@/lib/csv/asset-balance-csv";

/** 実際のマネーフォワード「資産推移」エクスポートと同じ形(全フィールドがクォート囲み・日付は降順) */
const VALID_CSV = [
  '"日付","合計（円）","預金・現金（円）","株式(現物)（円）","投資信託（円）"',
  '"2026/07/31","62810170","3173852","53994","22077491"',
  '"2026/07/30","62525245","2469852","55202","22379108"',
  '"2026/06/30","62510797","3379431","80442","21714851"',
].join("\r\n");

/** 成功した結果から中身を取り出す。失敗していればテストをその場で落とす */
const expectParsed = (csv: string): AssetBalanceParsed => {
  const result = parseAssetBalanceCsv(csv);

  if (!result.ok) {
    throw new Error(`パースに失敗した: ${result.reason}`);
  }

  return result.parsed;
};

const expectFailure = (csv: string): CsvParseFailureReason => {
  const result = parseAssetBalanceCsv(csv);

  if (result.ok) {
    throw new Error("パースが成功してしまった");
  }

  return result.reason;
};

describe("parseAssetBalanceCsv", () => {
  it("日付を昇順に並べ替えて返す", () => {
    expect(expectParsed(VALID_CSV).rows.map((row) => row.date)).toEqual([
      "2026-06-30",
      "2026-07-30",
      "2026-07-31",
    ]);
  });

  it("日付と合計以外の列を資産種別として、列の並び順のまま取り出す", () => {
    expect(expectParsed(VALID_CSV).assetTypes).toEqual(["預金・現金", "株式(現物)", "投資信託"]);
  });

  it("種別ごとの金額を種別名をキーにしたマップで持つ", () => {
    const latest = expectParsed(VALID_CSV).rows.at(-1);

    expect(latest?.byType).toEqual({
      "預金・現金": 3_173_852,
      "株式(現物)": 53_994,
      投資信託: 22_077_491,
    });
  });

  it("合計はCSVの値をそのまま採り、種別の合算で上書きしない", () => {
    // 合計と種別の合算が食い違うCSV。マネーフォワードが合計に含める範囲を推測しない
    const csv = [
      '"日付","合計（円）","預金・現金（円）"',
      '"2026/07/31","99999999","3173852"',
    ].join("\n");

    expect(expectParsed(csv).rows[0]?.total).toBe(99_999_999);
  });

  it("期間は最も古い日付から最も新しい日付までを返す", () => {
    const parsed = expectParsed(VALID_CSV);

    expect([parsed.periodFrom, parsed.periodTo]).toEqual(["2026-06-30", "2026-07-31"]);
  });

  it("負債などのマイナス金額を符号付きのまま読む", () => {
    const csv = ['"日付","合計（円）","カード（円）"', '"2026/07/31","-84200","-84200"'].join("\n");

    expect(expectParsed(csv).rows[0]?.byType["カード"]).toBe(-84_200);
  });

  it("桁区切りのカンマが入った金額も読む", () => {
    const csv = [
      '"日付","合計（円）","預金・現金（円）"',
      '"2026/07/31","2,140,000","2,140,000"',
    ].join("\n");

    expect(expectParsed(csv).rows[0]?.total).toBe(2_140_000);
  });

  it("空欄の金額はその種別を保有していなかったとみなして0にする", () => {
    const csv = ['"日付","合計（円）","年金（円）"', '"2026/07/31","100",""'].join("\n");

    expect(expectParsed(csv).rows[0]?.byType["年金"]).toBe(0);
  });

  /** 資産を持っていなかった時期の行。0を「値が無い」と取り違えて落とすと推移が欠ける */
  it("すべて0円の行も取り込む", () => {
    const csv = ['"日付","合計（円）","投資信託（円）"', '"2018/01/31","0","0"'].join("\n");
    const parsed = expectParsed(csv);

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ total: 0, byType: { 投資信託: 0 } });
  });

  it("種別が1列も無くても日付と合計だけで取り込める", () => {
    const csv = ['"日付","合計（円）"', '"2026/07/31","100"'].join("\n");
    const parsed = expectParsed(csv);

    expect(parsed.assetTypes).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
  });

  it("空行を読み飛ばす", () => {
    expect(expectParsed(`${VALID_CSV}\r\n\r\n`).rows).toHaveLength(3);
  });

  it("空のファイルは取り込めない", () => {
    expect(expectFailure("   \n")).toBe("empty-file");
  });

  it("日付列が無いCSVは取り込めない", () => {
    const csv = ['"年月","合計（円）"', '"2026/07/31","100"'].join("\n");

    expect(expectFailure(csv)).toBe("missing-column");
  });

  it("合計列が無いCSVは取り込めない", () => {
    // 入出金明細CSVを資産残高推移タブで選んだ場合がこれにあたる
    const csv = ['"計算対象","日付","内容","金額（円）"', '"1","2026/07/31","給与","700000"'].join(
      "\n",
    );

    expect(expectFailure(csv)).toBe("missing-column");
  });

  /** マップのキーが衝突して片方の金額が黙って消えるのを防ぐ */
  it("単位を落とすと同じ名前になる資産種別の列が2つあるCSVは取り込めない", () => {
    const csv = [
      '"日付","合計（円）","投資信託（円）","投資信託"',
      '"2026/07/31","100","60","40"',
    ].join("\n");

    expect(expectFailure(csv)).toBe("duplicate-column");
  });

  it("日付の列が2つあるCSVは取り込めない", () => {
    const csv = ['"日付","合計（円）","日付"', '"2026/07/31","100","2026/07/31"'].join("\n");

    expect(expectFailure(csv)).toBe("duplicate-column");
  });

  it("合計の列が2つあるCSVは取り込めない", () => {
    const csv = ['"日付","合計（円）","合計（円）"', '"2026/07/31","100","100"'].join("\n");

    expect(expectFailure(csv)).toBe("duplicate-column");
  });

  it("ヘッダーしか無いCSVは取り込めない", () => {
    expect(expectFailure('"日付","合計（円）"')).toBe("no-data-rows");
  });

  it("列数が足りない行があるCSVは取り込めない", () => {
    const csv = ['"日付","合計（円）","預金・現金（円）"', '"2026/07/31","100"'].join("\n");

    expect(expectFailure(csv)).toBe("missing-column");
  });

  it("日付として読めない値があるCSVは取り込めない", () => {
    const csv = ['"日付","合計（円）"', '"2026年7月31日","100"'].join("\n");

    expect(expectFailure(csv)).toBe("invalid-date");
  });

  it("存在しない日付は取り込めない", () => {
    const csv = ['"日付","合計（円）"', '"2026/02/31","100"'].join("\n");

    expect(expectFailure(csv)).toBe("invalid-date");
  });

  it("金額として読めない値があるCSVは取り込めない", () => {
    const csv = ['"日付","合計（円）","預金・現金（円）"', '"2026/07/31","100","-"'].join("\n");

    expect(expectFailure(csv)).toBe("invalid-amount");
  });

  /** どちらの値を採るべきか決められないため、上書き取込の前に弾く */
  it("同じ日付の行が重複しているCSVは取り込めない", () => {
    const csv = ['"日付","合計（円）"', '"2026/07/31","100"', '"2026/07/31","200"'].join("\n");

    expect(expectFailure(csv)).toBe("duplicate-date");
  });

  it("失敗した行の位置を添えて返す", () => {
    const csv = ['"日付","合計（円）"', '"2026/07/31","100"', '"こわれた行","100"'].join("\n");
    const result = parseAssetBalanceCsv(csv);

    expect(result).toMatchObject({ ok: false, reason: "invalid-date", detail: "3行目" });
  });
});

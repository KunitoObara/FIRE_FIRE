import { describe, expect, it } from "vitest";

import { parseAssetBalanceCsv } from "@/lib/csv/asset-balance-csv";
import { decodeCsvBytes } from "@/lib/csv/decode";

const toArrayBuffer = (bytes: number[]): ArrayBuffer => Uint8Array.from(bytes).buffer;

const encodeUtf8 = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer;

/** Shift_JISの「日付」(0x93FA 0x9574) */
const SHIFT_JIS_HIZUKE = [0x93, 0xfa, 0x95, 0x74];

describe("decodeCsvBytes", () => {
  it("Shift_JISのバイト列を日本語として読む", () => {
    expect(decodeCsvBytes(toArrayBuffer(SHIFT_JIS_HIZUKE))).toBe("日付");
  });

  it("UTF-8のバイト列をそのまま読む", () => {
    expect(decodeCsvBytes(encodeUtf8("日付,合計（円）"))).toBe("日付,合計（円）");
  });

  it("UTF-8のBOMは中身に含めない", () => {
    const bom = [0xef, 0xbb, 0xbf];
    const body = Array.from(new Uint8Array(encodeUtf8("日付")));

    expect(decodeCsvBytes(toArrayBuffer([...bom, ...body]))).toBe("日付");
  });

  it("ASCIIだけの内容はどちらの符号化でも同じに読む", () => {
    expect(decodeCsvBytes(encodeUtf8("2026/07/31,100"))).toBe("2026/07/31,100");
  });

  /**
   * Shift_JISでもUTF-8でもないファイル(UTF-16など)は、置換文字混じりの文字列になる。
   * ここで例外にはしないが、その先のパースが必ず失敗して取込に進まないことを確かめる。
   * 文字化けしたまま静かに取り込まれるのが最悪の結果のため。
   */
  it("想定外の文字コードのファイルは、読めてもパースで弾かれる", () => {
    const utf16 = new Uint8Array(
      Array.from('"日付","合計（円）"\n"2026/07/31","100"').flatMap((character) => {
        const code = character.charCodeAt(0);
        return [code & 0xff, code >> 8];
      }),
    );

    const result = parseAssetBalanceCsv(decodeCsvBytes(utf16.buffer));

    expect(result).toMatchObject({ ok: false, reason: "missing-column" });
  });
});

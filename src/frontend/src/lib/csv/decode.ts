/**
 * CSVファイルのバイト列を文字列にする。
 *
 * マネーフォワードのエクスポートは**Shift_JIS(CP932)**で出力される。一方でユーザーが
 * 表計算ソフトで開いて保存し直すとUTF-8になることがあるため、どちらでも読めるようにする。
 */

/** UTF-8のBOM。付いていればUTF-8と判断してよい */
const UTF8_BOM = [0xef, 0xbb, 0xbf];

/**
 * Shift_JISとして解釈するときのラベル。
 * `windows-31j`(CP932)はShift_JISの上位互換で、マネーフォワードが出す ①・㈱ 等の
 * 機種依存文字も含む。`TextDecoder`は`shift_jis`もこのデコーダに解決する。
 */
const SHIFT_JIS_LABEL = "shift_jis";

const hasUtf8Bom = (bytes: Uint8Array): boolean =>
  bytes.length >= UTF8_BOM.length && UTF8_BOM.every((byte, index) => bytes[index] === byte);

/**
 * UTF-8として妥当かどうかを、実際に厳密モードでデコードして判定する。
 *
 * Shift_JISの2バイト文字はUTF-8のバイト列としてはほぼ不正になるため、この判定で両者を
 * 見分けられる。ASCIIだけのファイルはどちらで読んでも同じ結果になるので、どちらに転んでもよい。
 */
const decodeAsUtf8 = (bytes: Uint8Array): string | undefined => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
};

/**
 * CSVのバイト列をデコードする。BOMは呼び出し側に見せない。
 *
 * 判定できないバイトが混ざっていてもShift_JIS側は例外を投げず置換文字になる。
 * その場合は列名の照合か金額のパースで弾かれ、取込が中途半端に成立することはない。
 */
export const decodeCsvBytes = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);

  if (hasUtf8Bom(bytes)) {
    return new TextDecoder("utf-8").decode(bytes.subarray(UTF8_BOM.length));
  }

  return decodeAsUtf8(bytes) ?? new TextDecoder(SHIFT_JIS_LABEL).decode(bytes);
};

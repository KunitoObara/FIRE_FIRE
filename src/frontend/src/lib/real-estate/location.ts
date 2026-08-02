/**
 * 所在地の簡略表記。
 *
 * B5 不動産一覧画面の表示項目は「所在地(簡略)」であり、番地・部屋番号まで並べると
 * 物件名が読み取りにくくなる(docs/screen-requirements-real-estate.md B5)。登録された
 * 住所そのものはB6 不動産詳細画面で確認できるため、一覧では都道府県+市区町村までに切る。
 */

/**
 * 都道府県 + 市区町村(郡下の町村を含む)にあたる先頭部分。
 *
 * 末尾の否定先読みが「四日市市」対策。これが無いと最短一致が「四日市」で止まり、
 * 続く「市」が番地側に残ってしまう。
 */
const SHORT_LOCATION_PATTERN =
  /^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)(.+?[市区町村])(?![市区町村])/u;

/**
 * 住所を「東京都渋谷区」の形に切り詰める。
 *
 * 想定した形に当てはまらない住所(海外・都道府県から始まらない表記など)は、勝手に削って
 * 意味を変えないよう元の文字列をそのまま返す。
 */
export const toShortLocation = (location: string): string => {
  const trimmed = location.trim();
  const matched = SHORT_LOCATION_PATTERN.exec(trimmed);

  return matched === null ? trimmed : `${matched[1]}${matched[2]}`;
};

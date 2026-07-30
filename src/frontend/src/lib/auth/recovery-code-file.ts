import {
  RECOVERY_CODE_FILE_NAME_PREFIX,
  RECOVERY_CODE_FILE_NOTES,
  RECOVERY_CODE_FILE_TITLE,
  RECOVERY_CODE_URL_REVOKE_DELAY_MS,
} from "@/constants/auth";

/**
 * リカバリーコードのダウンロード(A3の「リカバリーコードをダウンロード」)。
 *
 * 平文のコードは発行直後の応答にしか存在しないため、画面を離れる前にユーザーが
 * 手元へ保存できる手段を用意する。サーバーへ送らずブラウザ内でファイルを組み立てる。
 */

/** ファイル名に入れる日付(`20260730`)。同じ日に再発行しても上書き確認で気付けるよう日付までにする */
const toFileNameDate = (issuedAt: Date): string =>
  [
    issuedAt.getFullYear(),
    String(issuedAt.getMonth() + 1).padStart(2, "0"),
    String(issuedAt.getDate()).padStart(2, "0"),
  ].join("");

/** ファイル内に残す発行日時(`2026-07-30 21:52`)。どの時点のコードかを後から判別するため */
const toIssuedAtLabel = (issuedAt: Date): string =>
  `${issuedAt.getFullYear()}-${String(issuedAt.getMonth() + 1).padStart(2, "0")}-${String(
    issuedAt.getDate(),
  ).padStart(2, "0")} ${String(issuedAt.getHours()).padStart(2, "0")}:${String(
    issuedAt.getMinutes(),
  ).padStart(2, "0")}`;

export const buildRecoveryCodesFileName = (issuedAt: Date): string =>
  `${RECOVERY_CODE_FILE_NAME_PREFIX}-${toFileNameDate(issuedAt)}.txt`;

/**
 * ダウンロードするテキストを組み立てる。
 *
 * コードだけでなく注意事項も入れる。ファイルは発行から時間が経ってから開かれるため、
 * 「1回しか使えない」「他人に見せない」といった前提を画面の説明に頼らず持たせる。
 */
export const buildRecoveryCodesFileContent = (codes: string[], issuedAt: Date): string =>
  [
    RECOVERY_CODE_FILE_TITLE,
    "",
    `発行日時: ${toIssuedAtLabel(issuedAt)}`,
    "",
    ...codes,
    "",
    ...RECOVERY_CODE_FILE_NOTES.map((note) => `- ${note}`),
    "",
  ].join("\n");

/**
 * リカバリーコードをテキストファイルとして保存する。
 *
 * `<a download>`を組み立ててクリックする以外に、ブラウザから保存操作を起こす方法が無い。
 * 生成したURLは使い終わったら解放する(解放しないとページを離れるまでBlobが残る)が、
 * クリックの直後に解放するとブラウザがダウンロードを始める前に無効化してしまい、
 * 保存に失敗することがあるため、少し待ってから解放する。
 * 平文のコードはこの表示でしか手に入らないので、取りこぼしは避ける。
 */
export const downloadRecoveryCodes = (codes: string[], issuedAt: Date): void => {
  const blob = new Blob([buildRecoveryCodesFileContent(codes, issuedAt)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = buildRecoveryCodesFileName(issuedAt);
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), RECOVERY_CODE_URL_REVOKE_DELAY_MS);
};

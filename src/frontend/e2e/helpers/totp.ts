import { generateSync } from "otplib";

/**
 * A3で登録したTOTPシークレットから、その場のワンタイムコードを生成する。
 *
 * `otplib`のTOTPは既定で30秒間隔・6桁(このアプリのTOTP設定と同じ、`TOTP_CODE_LENGTH`参照)。
 * 画面に表示されるシークレットキーはグルーピングのため半角スペースが入るので、生成前に
 * 取り除く(`formatTotpSecretKey`の逆)。ハイフンも合わせて取り除く — このアプリの表示形式には
 * 現れないが、シークレットキーを他所からハイフン区切りで貼り付けても壊れないようにするため。
 * どちらも含まないBase32文字列に対しては何もしない
 */
export const generateTotpCode = (secret: string): string =>
  generateSync({ secret: secret.replace(/[\s-]+/g, "") });

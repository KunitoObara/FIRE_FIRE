import { generateSync } from "otplib";

/**
 * A3で登録したTOTPシークレットから、その場のワンタイムコードを生成する。
 *
 * `otplib`のTOTPは既定で30秒間隔・6桁(このアプリのTOTP設定と同じ、`TOTP_CODE_LENGTH`参照)。
 * 画面に表示されるシークレットキーはグルーピングのため半角スペースが入るので、
 * 生成前に取り除く(`formatTotpSecretKey`の逆)。
 */
export const generateTotpCode = (secret: string): string =>
  generateSync({ secret: secret.replace(/\s+/g, "") });

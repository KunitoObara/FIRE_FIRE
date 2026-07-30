import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * 2FAリカバリーコードの生成・正規化・ハッシュ化(docs/auth-login-requirements.md 3.3)。
 *
 * Identity Platformにバックアップコードの機能が無いため自前で持つ。Firestoreへ保存するのは
 * ハッシュだけで、平文はA3/B10で発行した直後に一度だけ画面へ返す(以降どこからも復元できない)。
 *
 * このファイルはFirebaseに触らない純粋な処理だけを持ち、保存は`store.ts`、
 * 呼び出し口は`functions.ts`に分ける(ユニットテストをここに集約するため)。
 */

/**
 * 1回の発行で作るコードの本数。
 * HTMLモック(src/frontend/docs/html_mock/a3-mfa-setup.html)の2列×4行の表示に合わせる。
 */
export const RECOVERY_CODE_COUNT = 8;

/** 1コードあたりの文字数(区切りのハイフンを除く) */
const RECOVERY_CODE_LENGTH = 8;

/** 表示・ファイル出力時にハイフンで区切る文字数。書き写す際の読み違いを減らすため */
export const RECOVERY_CODE_GROUP_SIZE = 4;

/**
 * コードに使う文字。数字の`0`/`1`と紛れる`O`/`I`を除いた32文字。
 * 32文字×8桁で40ビット相当あり、後述のscryptハッシュと合わせれば総当たりは現実的でない。
 */
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * 入力時に読み替える文字。
 *
 * `1`はコードに現れず、字形が近いのは使用文字に含まれる`L`だけなので、書き写す際に
 * `L`を`1`と打ってしまった場合に限って一意に戻せる。
 *
 * `0`には対応する読み替え先が無い。字形が近い`O`も使用文字から外しているため、
 * `0`と打たれた時点でどの文字の写し間違いかを決められない。読み替えずに残し、
 * 形式の検査(`isRecoveryCodeFormat`)で弾く。
 */
const RECOVERY_CODE_INPUT_REPLACEMENTS: Record<string, string> = { "1": "L" };

/** scryptで導出する鍵の長さ(バイト)。コスト係数はNode既定値(N=16384, r=8, p=1)に任せる */
const SCRYPT_KEY_LENGTH = 32;

/** コードごとに作るソルトの長さ(バイト) */
const RECOVERY_CODE_SALT_BYTES = 16;

const scryptAsync = promisify(scrypt);

/** Firestoreに保存する1コードぶんのハッシュ(ソルトはコードごとに変える) */
export type RecoveryCodeHash = {
  salt: string;
  hash: string;
};

/**
 * リカバリーコードを1本作る。
 *
 * `Math.random`ではなく`randomInt`を使う。予測されると2FAの迂回に直結するため、
 * 暗号論的乱数から偏りなく1文字ずつ選ぶ(`randomInt`は範囲外を捨てて一様性を保つ)。
 */
const createRecoveryCode = (): string => {
  let code = "";
  for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
    code += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
  }
  return code;
};

/** `XXXXXXXX`を`XXXX-XXXX`の表示形に整える */
export const formatRecoveryCode = (code: string): string => {
  const groups: string[] = [];
  for (let index = 0; index < code.length; index += RECOVERY_CODE_GROUP_SIZE) {
    groups.push(code.slice(index, index + RECOVERY_CODE_GROUP_SIZE));
  }
  return groups.join("-");
};

/**
 * 発行するコード一式を作る。
 *
 * 同じコードが2本混ざると、1本使った時点でもう1本も使えなくなったように見えるため、
 * 重複は作り直して排除する(40ビットあるので実際に衝突することはほぼない)。
 */
export const createRecoveryCodes = (): string[] => {
  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) {
    codes.add(createRecoveryCode());
  }
  return [...codes].map(formatRecoveryCode);
};

/**
 * 入力されたコードを照合できる形に揃える。
 *
 * ハイフン・空白の有無や大文字小文字は問わない。ユーザーはA3で表示した`XXXX-XXXX`を
 * 書き写して持っており、貼り付け方や打ち方まで揃うとは期待できないため。
 */
export const normalizeRecoveryCode = (input: string): string =>
  [...input.toUpperCase()]
    .map((character) => RECOVERY_CODE_INPUT_REPLACEMENTS[character] ?? character)
    .join("")
    .replace(/[^0-9A-Z]/g, "");

/**
 * 正規化済みのコードが発行時の形式を満たすか。
 *
 * 形式から外れているものはハッシュ計算に進まず弾く。1回の照合で最大8本ぶんの
 * scryptを回すため、明らかな入力ミスに計算資源を使わないようにする。
 */
export const isRecoveryCodeFormat = (normalizedCode: string): boolean =>
  normalizedCode.length === RECOVERY_CODE_LENGTH &&
  [...normalizedCode].every((character) => RECOVERY_CODE_ALPHABET.includes(character));

/**
 * コードをハッシュ化する。
 *
 * SHA-256のような高速ハッシュではなくscryptを使う。コードは40ビットしかないため、
 * Firestoreの内容が漏れた場合に高速ハッシュだと総当たりで平文に戻され、
 * 2FAの解除に使われてしまう。
 */
export const createRecoveryCodeHash = async (code: string): Promise<RecoveryCodeHash> => {
  const salt = randomBytes(RECOVERY_CODE_SALT_BYTES).toString("hex");
  return { salt, hash: await deriveHash(normalizeRecoveryCode(code), salt) };
};

const deriveHash = async (normalizedCode: string, salt: string): Promise<string> => {
  const derived = await scryptAsync(normalizedCode, salt, SCRYPT_KEY_LENGTH);
  return (derived as Buffer).toString("hex");
};

/**
 * 正規化済みのコードが保存済みのハッシュと一致するか。
 *
 * 比較は`timingSafeEqual`で行う。ハッシュ同士の比較なので実害は考えにくいが、
 * 資格情報の照合で早期リターンする比較を書かない方針に揃える。
 */
export const matchesRecoveryCodeHash = async (
  normalizedCode: string,
  stored: RecoveryCodeHash,
): Promise<boolean> => {
  const candidate = Buffer.from(await deriveHash(normalizedCode, stored.salt), "hex");
  const expected = Buffer.from(stored.hash, "hex");

  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
};

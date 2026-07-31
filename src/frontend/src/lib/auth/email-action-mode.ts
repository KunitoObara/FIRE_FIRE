import { RESET_PASSWORD_PATH } from "@/constants/routes";

/**
 * メール内リンクの`mode`から、アクションURL(`/auth/action`)の振る舞いを決める。
 *
 * アクションURLはFirebaseプロジェクトに1つしか設定できず、パスワード再設定・
 * メールアドレス確認のどちらのリンクもここに届く(docs/ci-cd-setup.md 12章)。
 * 振り分けはこのPRの中核となる分岐のため、画面(Server Component)から切り離して
 * 単体で検証できるようにしている。
 *
 * `oobCode`が無い場合もそれぞれの画面へ渡す。リンクが壊れていること自体は
 * 各画面が「無効なリンク」として案内するため、ここでは分岐させない。
 */
export const resolveEmailActionTarget = (
  mode: string | null,
  oobCode: string | null,
): EmailActionTarget => {
  switch (mode) {
    case "resetPassword": {
      const query = oobCode === null ? "" : `?oobCode=${encodeURIComponent(oobCode)}`;
      return { kind: "reset-password", path: `${RESET_PASSWORD_PATH}${query}` };
    }
    case "verifyEmail":
      return { kind: "verify-email", oobCode };
    default:
      return { kind: "unsupported" };
  }
};

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import {
  LINK_ACCOUNT_PATH,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
  VERIFY_EMAIL_PATH,
} from "@/constants/routes";

const replace = vi.fn();
const signInWithGoogle = vi.fn<(rememberMe: boolean) => Promise<GoogleSignInResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/google-sign-in", () => ({
  signInWithGoogle: (rememberMe: boolean) => signInWithGoogle(rememberMe),
}));

const googleButton = (): HTMLElement => screen.getByRole("button", { name: "Googleで続ける" });

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    replace.mockReset();
    signInWithGoogle.mockReset();
    signInWithGoogle.mockResolvedValue({ ok: true, next: "mfa-setup" });
  });

  describe("遷移", () => {
    it.each([
      ["mfa-setup", MFA_SETUP_PATH],
      ["mfa-verify", MFA_VERIFY_PATH],
      ["link-account", LINK_ACCOUNT_PATH],
      ["email-unverified", VERIFY_EMAIL_PATH],
    ] as [GoogleSignInNextStep, string][])("%s のときは %s へ進む", async (next, path) => {
      signInWithGoogle.mockResolvedValue({ ok: true, next });
      const user = userEvent.setup();
      render(<GoogleSignInButton />);

      await user.click(googleButton());

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(path);
      });
    });
  });

  describe("「ログイン状態を保持する」の引き継ぎ", () => {
    it("渡された選択をそのまま使う", async () => {
      const user = userEvent.setup();
      render(<GoogleSignInButton rememberMe={false} />);

      await user.click(googleButton());

      expect(signInWithGoogle).toHaveBeenCalledWith(false);
    });

    // A1にはこの選択が無いため、A4の既定と揃える
    it("指定が無ければ保持する", async () => {
      const user = userEvent.setup();
      render(<GoogleSignInButton />);

      await user.click(googleButton());

      expect(signInWithGoogle).toHaveBeenCalledWith(true);
    });
  });

  describe("押下できない状態", () => {
    it("処理中は二重にポップアップを開かせない", async () => {
      signInWithGoogle.mockReturnValue(new Promise<GoogleSignInResult>(() => {}));
      const user = userEvent.setup();
      render(<GoogleSignInButton />);

      await user.click(googleButton());

      expect(screen.getByRole("button", { name: "Googleで認証中..." })).toBeDisabled();
    });

    // A1の規約未同意。ポップアップを開いてから断るより、開く前に分かる方が親切
    it("理由が渡されているときは無効化し、その理由を出す", async () => {
      const user = userEvent.setup();
      render(<GoogleSignInButton blockedReason="利用規約への同意が必要です" />);

      expect(googleButton()).toBeDisabled();
      expect(screen.getByText("利用規約への同意が必要です")).toBeInTheDocument();

      await user.click(googleButton());

      expect(signInWithGoogle).not.toHaveBeenCalled();
    });
  });

  describe("失敗", () => {
    // ユーザーが自分で閉じたのは取りやめであって失敗ではない
    it("ポップアップを閉じただけならエラーを出さず元の状態に戻す", async () => {
      signInWithGoogle.mockResolvedValue({ ok: false, reason: "popup-closed" });
      const user = userEvent.setup();
      render(<GoogleSignInButton />);

      await user.click(googleButton());

      expect(screen.getByRole("alert")).toBeEmptyDOMElement();
      expect(replace).not.toHaveBeenCalled();
      // もう一度試せる
      expect(googleButton()).toBeEnabled();
    });

    it("ポップアップがブロックされたときは許可を促す", async () => {
      signInWithGoogle.mockResolvedValue({ ok: false, reason: "popup-blocked" });
      const user = userEvent.setup();
      render(<GoogleSignInButton />);

      await user.click(googleButton());

      expect(screen.getByRole("alert")).toHaveTextContent(
        "ポップアップがブロックされました。ブラウザの設定でポップアップを許可してから再度お試しください。",
      );
      expect(replace).not.toHaveBeenCalled();
    });

    it("プロバイダ未設定を伝える", async () => {
      signInWithGoogle.mockResolvedValue({ ok: false, reason: "provider-disabled" });
      const user = userEvent.setup();
      render(<GoogleSignInButton />);

      await user.click(googleButton());

      expect(screen.getByRole("alert")).toHaveTextContent("Googleログインが有効になっていません。");
    });

    it("失敗のあとは再度押せる", async () => {
      signInWithGoogle.mockResolvedValue({ ok: false, reason: "network-error" });
      const user = userEvent.setup();
      render(<GoogleSignInButton />);

      await user.click(googleButton());

      expect(googleButton()).toBeEnabled();
    });
  });
});

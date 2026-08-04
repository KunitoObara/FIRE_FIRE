import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountLinkForm } from "@/components/auth/AccountLinkForm";
import {
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
  VERIFY_EMAIL_PATH,
} from "@/constants/routes";
import {
  clearPendingGoogleLink,
  getPendingGoogleLink,
  setPendingGoogleLink,
} from "@/lib/auth/pending-google-link";

import type { UserEvent } from "@testing-library/user-event";
import type { OAuthCredential } from "firebase/auth";

const replace = vi.fn();
const signInWithEmail =
  vi.fn<(email: string, password: string, rememberMe: boolean) => Promise<SignInResult>>();
const linkPendingGoogleAccount = vi.fn<() => Promise<void>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/sign-in", () => ({
  signInWithEmail: (email: string, password: string, rememberMe: boolean) =>
    signInWithEmail(email, password, rememberMe),
}));

vi.mock("@/lib/auth/google-sign-in", () => ({
  linkPendingGoogleAccount: () => linkPendingGoogleAccount(),
}));

// 画面は資格情報を連携関数へ渡すだけなので、テストでは替え玉で足りる
const credential = {} as OAuthCredential;

const PENDING_LINK: PendingGoogleLink = {
  credential,
  email: "taro.yamada@example.com",
  rememberMe: true,
};

const PASSWORD = "Passw0rd!";

const submitButton = (): HTMLElement => screen.getByRole("button", { name: "連携してログイン" });

/** パスワードを入力して「連携してログイン」を押すまで */
const submitPassword = async (user: UserEvent, password = PASSWORD): Promise<void> => {
  await user.type(screen.getByLabelText("パスワード"), password);
  await user.click(submitButton());
};

describe("AccountLinkForm", () => {
  beforeEach(() => {
    replace.mockReset();
    signInWithEmail.mockReset();
    // 既定は2FA登録済み(A5経由で連携する分岐)
    signInWithEmail.mockResolvedValue({ ok: true, next: "mfa-verify" });
    linkPendingGoogleAccount.mockReset();
    linkPendingGoogleAccount.mockResolvedValue(undefined);
    setPendingGoogleLink({ ...PENDING_LINK });
  });

  describe("表示項目", () => {
    it("Googleから取得したメールアドレスと案内文を表示する", async () => {
      render(<AccountLinkForm />);

      expect(
        screen.getByRole("heading", { level: 1, name: "アカウントを連携" }),
      ).toBeInTheDocument();
      expect(screen.getByText(PENDING_LINK.email)).toBeInTheDocument();
      // エラーではなく追加の手続きとして提示する
      expect(
        screen.getByText(/すでにパスワードでご登録済みです。パスワードを入力すると/),
      ).toBeInTheDocument();
    });

    it("パスワード入力欄と離脱の導線を出す", () => {
      render(<AccountLinkForm />);

      expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "パスワードをお忘れの方" })).toHaveAttribute(
        "href",
        FORGOT_PASSWORD_PATH,
      );
      expect(screen.getByRole("link", { name: "連携せずにログインへ戻る" })).toHaveAttribute(
        "href",
        LOGIN_PATH,
      );
    });
  });

  describe("パスワード検証", () => {
    it("Googleから取得したメールアドレスと引き継いだ選択で検証する", async () => {
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await submitPassword(user);

      expect(signInWithEmail).toHaveBeenCalledWith(PENDING_LINK.email, PASSWORD, true);
    });

    it("未入力では検証しない", async () => {
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await user.click(submitButton());

      expect(await screen.findByText("パスワードを入力してください")).toBeInTheDocument();
      expect(signInWithEmail).not.toHaveBeenCalled();
    });

    // A8に到達している時点でメールアドレスの登録は確定しているため、A4のような曖昧化はしない
    it("パスワードの誤りをそのまま伝え、入力をやり直せる", async () => {
      signInWithEmail.mockResolvedValue({ ok: false, reason: "invalid-credential" });
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await submitPassword(user);

      expect(await screen.findByText("パスワードが正しくありません。")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
      expect(submitButton()).toBeEnabled();
    });

    it("検証中は再送信できない", async () => {
      signInWithEmail.mockReturnValue(new Promise<SignInResult>(() => {}));
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await submitPassword(user);

      expect(screen.getByRole("button", { name: "連携中..." })).toBeDisabled();
    });
  });

  describe("連携の実行タイミング", () => {
    // パスワード検証だけではサインインが成立しないため、連携はA5の検証成功後に行う
    it("2FA登録済みなら連携せずA5へ進み、連携待ちを残す", async () => {
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await submitPassword(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(MFA_VERIFY_PATH);
      });
      expect(linkPendingGoogleAccount).not.toHaveBeenCalled();
      expect(getPendingGoogleLink()).not.toBeNull();
    });

    // この時点でサインインが成立しているため、その場で連携してからA3へ送る
    it("2FA未登録ならその場で連携してA3へ進む", async () => {
      signInWithEmail.mockResolvedValue({ ok: true, next: "mfa-setup" });
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await submitPassword(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(MFA_SETUP_PATH);
      });
      expect(linkPendingGoogleAccount).toHaveBeenCalled();
    });

    // A4と同じく「メール未確認」を「2FA未登録」より優先する
    it("メール未確認なら連携したうえでA2へ進む", async () => {
      signInWithEmail.mockResolvedValue({ ok: true, next: "email-unverified" });
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await submitPassword(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(VERIFY_EMAIL_PATH);
      });
      expect(linkPendingGoogleAccount).toHaveBeenCalled();
    });

    // 連携の成否はB1の通知フラグで伝わる。遷移してからでは通知が間に合わない
    it("連携を終えてから遷移する", async () => {
      signInWithEmail.mockResolvedValue({ ok: true, next: "mfa-setup" });
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await submitPassword(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalled();
      });
      expect(linkPendingGoogleAccount.mock.invocationCallOrder[0]).toBeLessThan(
        replace.mock.invocationCallOrder[0],
      );
    });
  });

  describe("連携せずにログインへ戻る", () => {
    it("連携待ちを捨てる", async () => {
      const user = userEvent.setup();
      render(<AccountLinkForm />);

      await user.click(screen.getByRole("link", { name: "連携せずにログインへ戻る" }));

      expect(getPendingGoogleLink()).toBeNull();
    });
  });

  describe("連携待ちが無いとき", () => {
    beforeEach(() => {
      clearPendingGoogleLink();
    });

    it("ログイン画面へ戻す", () => {
      render(<AccountLinkForm />);

      expect(replace).toHaveBeenCalledWith(LOGIN_PATH);
      // 失敗ではなく資格情報が無いだけなので、やり直しの手順だけを伝える
      expect(screen.getByRole("status")).toHaveTextContent(
        "Googleログインからやり直してください。ログイン画面に戻ります...",
      );
    });
  });
});

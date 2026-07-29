import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/LoginForm";

import type { UserEvent } from "@testing-library/user-event";

const replace = vi.fn();
const signInWithEmail =
  vi.fn<(email: string, password: string, rememberMe: boolean) => Promise<SignInResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/sign-in", () => ({
  signInWithEmail: (email: string, password: string, rememberMe: boolean) =>
    signInWithEmail(email, password, rememberMe),
}));

const PASSWORD = "Passw0rd!";

/** 有効な資格情報を入力する。差し替えたい項目だけ引数で上書きする */
const fillValidForm = async (
  user: UserEvent,
  overrides: { email?: string; password?: string } = {},
): Promise<void> => {
  await user.type(screen.getByLabelText("メールアドレス"), overrides.email ?? "user@example.com");
  await user.type(screen.getByLabelText("パスワード"), overrides.password ?? PASSWORD);
};

const submit = (user: UserEvent): Promise<void> =>
  user.click(screen.getByRole("button", { name: "ログイン" }));

describe("LoginForm", () => {
  beforeEach(() => {
    replace.mockReset();
    signInWithEmail.mockReset();
    signInWithEmail.mockResolvedValue({ ok: true, next: "mfa-verify" });
  });

  it("画面タイトルと各導線を表示する", () => {
    render(<LoginForm />);

    expect(screen.getByRole("heading", { level: 1, name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "パスワードをお忘れの方" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: "サインアップ" })).toHaveAttribute("href", "/signup");
  });

  it("パスワード欄は既定で入力値を隠し、トグルで平文表示できる", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "パスワードを表示" }));

    expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "text");
  });

  it("登録時と違いパスワードポリシーの充足一覧は表示しない", () => {
    render(<LoginForm />);

    expect(screen.queryByLabelText("パスワードの条件")).not.toBeInTheDocument();
  });

  describe("バリデーションエラー", () => {
    it("未入力のときはインラインエラーを表示し、ログインを試行しない", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await submit(user);

      expect(await screen.findByText("メールアドレスを入力してください")).toBeInTheDocument();
      expect(screen.getByText("パスワードを入力してください")).toBeInTheDocument();
      expect(signInWithEmail).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it("メール形式が不正なときはインラインエラーを表示し、ログインを試行しない", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillValidForm(user, { email: "user@example" });
      await submit(user);

      expect(await screen.findByText("メールアドレスの形式が正しくありません")).toBeInTheDocument();
      expect(signInWithEmail).not.toHaveBeenCalled();
    });

    it("パスワードポリシーを満たさない値でも送信する(照合はサーバー側に委ねる)", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillValidForm(user, { password: "short" });
      await submit(user);

      await waitFor(() => {
        expect(signInWithEmail).toHaveBeenCalledWith("user@example.com", "short", true);
      });
    });
  });

  describe("ログイン状態を保持する", () => {
    it("既定でチェック済みにする", () => {
      render(<LoginForm />);

      expect(screen.getByRole("checkbox", { name: "ログイン状態を保持する" })).toBeChecked();
    });

    it("チェックを外した場合は保持しない選択として送信する", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillValidForm(user);
      await user.click(screen.getByRole("checkbox", { name: "ログイン状態を保持する" }));
      await submit(user);

      await waitFor(() => {
        expect(signInWithEmail).toHaveBeenCalledWith("user@example.com", PASSWORD, false);
      });
    });
  });

  describe("一次認証の結果に応じた遷移", () => {
    it("2FA登録済みなら2FA検証画面へ進む", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/mfa-verify");
      });
    });

    it("メールアドレスが未確認ならメール確認待ち画面へ誘導する", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: true, next: "email-unverified" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/verify-email");
      });
    });

    it("2FAが未登録なら2FA登録画面へ誘導する", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: true, next: "mfa-setup" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/mfa-setup");
      });
    });
  });

  describe("ログイン失敗", () => {
    it("資格情報の誤りはどちらが誤りかを示さず、フォーム全体のエラーとして表示する", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: false, reason: "invalid-credential" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      expect(
        await screen.findByText("メールアドレスまたはパスワードが正しくありません。"),
      ).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("無効化されたアカウントも資格情報の誤りと同じ文言にし、アカウントの存在を伝えない", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: false, reason: "user-disabled" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      expect(
        await screen.findByText("メールアドレスまたはパスワードが正しくありません。"),
      ).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("接続不可のときはエミュレータ起動の確認を促す", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: false, reason: "network-error" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      expect(await screen.findByText(/firebase emulators:start/)).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("失敗後に再度送信できる", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: false, reason: "invalid-credential" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);
      await screen.findByText("メールアドレスまたはパスワードが正しくありません。");

      signInWithEmail.mockResolvedValue({ ok: true, next: "mfa-verify" });
      await submit(user);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/mfa-verify");
      });
    });
  });

  it("送信中はボタンを無効化して二重送信を防ぐ", async () => {
    const user = userEvent.setup();
    let resolveSignIn: (result: SignInResult) => void = () => {};
    signInWithEmail.mockReturnValue(
      new Promise<SignInResult>((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    render(<LoginForm />);

    await fillValidForm(user);
    await submit(user);

    const button = await screen.findByRole("button", { name: "ログイン中..." });
    expect(button).toBeDisabled();

    resolveSignIn({ ok: true, next: "mfa-verify" });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/mfa-verify");
    });
    expect(signInWithEmail).toHaveBeenCalledTimes(1);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

import type { UserEvent } from "@testing-library/user-event";

const requestPasswordReset = vi.fn<(email: string) => Promise<PasswordResetResult>>();

vi.mock("@/lib/auth/password-reset", () => ({
  requestPasswordReset: (email: string) => requestPasswordReset(email),
}));

const SENT_MESSAGE =
  "入力されたメールアドレス宛にパスワード再設定用のメールを送信しました。メールに記載のリンクから手続きを進めてください。";

const submit = (user: UserEvent): Promise<void> =>
  user.click(screen.getByRole("button", { name: "リセットメールを送信する" }));

/** 有効なメールアドレスを入力して送信する */
const sendFor = async (user: UserEvent, email = "user@example.com"): Promise<void> => {
  await user.type(screen.getByLabelText("メールアドレス"), email);
  await submit(user);
};

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
    requestPasswordReset.mockResolvedValue({ ok: true });
  });

  it("画面タイトルとログインへの導線を表示する", () => {
    render(<ForgotPasswordForm />);

    expect(
      screen.getByRole("heading", { level: 1, name: "パスワードをお忘れの方" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログインに戻る" })).toHaveAttribute("href", "/login");
  });

  describe("バリデーションエラー", () => {
    it("未入力のときはインラインエラーを表示し、送信しない", async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      await submit(user);

      expect(await screen.findByText("メールアドレスを入力してください")).toBeInTheDocument();
      expect(requestPasswordReset).not.toHaveBeenCalled();
    });

    it("メール形式が不正なときはインラインエラーを表示し、送信しない", async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      await sendFor(user, "user@example");

      expect(await screen.findByText("メールアドレスの形式が正しくありません")).toBeInTheDocument();
      expect(requestPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe("送信完了", () => {
    it("完了メッセージに切り替え、入力欄と送信ボタンを隠す", async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      await sendFor(user);

      expect(await screen.findByText(SENT_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByLabelText("メールアドレス")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "リセットメールを送信する" }),
      ).not.toBeInTheDocument();
      // 画面遷移はせず、ログインへの導線は残したままにする
      expect(screen.getByRole("link", { name: "ログインに戻る" })).toBeInTheDocument();
    });

    it("送信後も入力したメールアドレスを保持したまま入力欄に戻れる", async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      await sendFor(user);
      await screen.findByText(SENT_MESSAGE);

      await user.click(screen.getByRole("button", { name: "別のメールアドレスで送り直す" }));

      expect(screen.getByLabelText("メールアドレス")).toHaveValue("user@example.com");
      expect(screen.queryByText(SENT_MESSAGE)).not.toBeInTheDocument();
    });
  });

  describe("送信失敗", () => {
    it("接続不可のときはエミュレータ起動の確認を促し、完了メッセージは出さない", async () => {
      const user = userEvent.setup();
      requestPasswordReset.mockResolvedValue({ ok: false, reason: "network-error" });
      render(<ForgotPasswordForm />);

      await sendFor(user);

      expect(await screen.findByText(/firebase emulators:start/)).toBeInTheDocument();
      expect(screen.queryByText(SENT_MESSAGE)).not.toBeInTheDocument();
    });

    it("レート制限のときは待てば解消することを伝える", async () => {
      const user = userEvent.setup();
      requestPasswordReset.mockResolvedValue({ ok: false, reason: "too-many-requests" });
      render(<ForgotPasswordForm />);

      await sendFor(user);

      expect(
        await screen.findByText(
          "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
        ),
      ).toBeInTheDocument();
    });

    it("Firebaseの設定不足のときは設定手順を促す", async () => {
      const user = userEvent.setup();
      requestPasswordReset.mockResolvedValue({ ok: false, reason: "configuration-error" });
      render(<ForgotPasswordForm />);

      await sendFor(user);

      expect(await screen.findByText(/\.env\.local/)).toBeInTheDocument();
    });

    it("失敗後に再度送信できる", async () => {
      const user = userEvent.setup();
      requestPasswordReset.mockResolvedValue({ ok: false, reason: "unknown" });
      render(<ForgotPasswordForm />);

      await sendFor(user);
      await screen.findByText(
        "パスワード再設定用のメールを送信できませんでした。しばらく待ってから再度お試しください。",
      );

      requestPasswordReset.mockResolvedValue({ ok: true });
      await submit(user);

      expect(await screen.findByText(SENT_MESSAGE)).toBeInTheDocument();
    });
  });

  it("送信中はボタンを無効化して二重送信を防ぐ", async () => {
    const user = userEvent.setup();
    let resolveRequest: (result: PasswordResetResult) => void = () => {};
    requestPasswordReset.mockReturnValue(
      new Promise<PasswordResetResult>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<ForgotPasswordForm />);

    await sendFor(user);

    const button = await screen.findByRole("button", { name: "送信中..." });
    expect(button).toBeDisabled();

    resolveRequest({ ok: true });
    await waitFor(() => {
      expect(screen.getByText(SENT_MESSAGE)).toBeInTheDocument();
    });
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });
});

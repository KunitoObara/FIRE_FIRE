import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { PASSWORD_RESET_COMPLETE_REDIRECT_MS } from "@/constants/auth";
import { LOGIN_PATH } from "@/constants/routes";

import type { UserEvent } from "@testing-library/user-event";

const replace = vi.fn();
const verifyPasswordResetLink = vi.fn<(oobCode: string) => Promise<PasswordResetCodeResult>>();
const completePasswordReset =
  vi.fn<(oobCode: string, newPassword: string) => Promise<PasswordResetConfirmResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/password-reset", () => ({
  verifyPasswordResetLink: (oobCode: string) => verifyPasswordResetLink(oobCode),
  completePasswordReset: (oobCode: string, newPassword: string) =>
    completePasswordReset(oobCode, newPassword),
}));

const NEW_PASSWORD = "NewPassw0rd!";
const COMPLETED_MESSAGE = "パスワードを再設定しました。新しいパスワードでログインしてください。";

/** 偽装タイマー下では`findBy`が進まないため、マイクロタスクの消化で待つ */
const settle = (): Promise<void> => act(async () => {});

/** リンクの検証が終わり、入力欄が表示されるまで待つ */
const renderReady = async (): Promise<void> => {
  render(<ResetPasswordForm oobCode="oob-code" />);
  await screen.findByLabelText("新パスワード");
};

const submitWith = async (
  user: UserEvent,
  password = NEW_PASSWORD,
  confirmation = password,
): Promise<void> => {
  await user.type(screen.getByLabelText("新パスワード"), password);
  await user.type(screen.getByLabelText("新パスワード(確認用)"), confirmation);
  await user.click(screen.getByRole("button", { name: "パスワードを再設定する" }));
};

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    replace.mockReset();
    verifyPasswordResetLink.mockReset();
    verifyPasswordResetLink.mockResolvedValue({ ok: true, email: "user@example.com" });
    completePasswordReset.mockReset();
    completePasswordReset.mockResolvedValue({ ok: true });
  });

  describe("リンクの検証", () => {
    it("検証中は入力欄を出さない", () => {
      verifyPasswordResetLink.mockReturnValue(new Promise<PasswordResetCodeResult>(() => {}));
      render(<ResetPasswordForm oobCode="oob-code" />);

      expect(screen.getByText("リンクを確認しています...")).toBeInTheDocument();
      expect(screen.queryByLabelText("新パスワード")).not.toBeInTheDocument();
    });

    it("有効なリンクなら、変更対象のメールアドレスと入力欄を表示する", async () => {
      await renderReady();

      expect(
        screen.getByRole("heading", { level: 1, name: "新しいパスワードを設定" }),
      ).toBeInTheDocument();
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
      expect(verifyPasswordResetLink).toHaveBeenCalledWith("oob-code");
    });

    it("期限切れ・無効のときはA6への導線を出し、入力欄を出さない", async () => {
      verifyPasswordResetLink.mockResolvedValue({ ok: false, reason: "invalid-action-code" });
      render(<ResetPasswordForm oobCode="oob-code" />);

      expect(
        await screen.findByRole("heading", { level: 1, name: "リンクの有効期限が切れています" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "パスワードをお忘れの方へ戻る" })).toHaveAttribute(
        "href",
        "/forgot-password",
      );
      expect(screen.queryByLabelText("新パスワード")).not.toBeInTheDocument();
    });

    it("oobCodeが無いときは問い合わせずに無効として扱う", () => {
      render(<ResetPasswordForm oobCode={null} />);

      expect(
        screen.getByRole("heading", { level: 1, name: "リンクの有効期限が切れています" }),
      ).toBeInTheDocument();
      expect(verifyPasswordResetLink).not.toHaveBeenCalled();
    });

    it("接続不可のときはエミュレータ起動の確認を促し、やり直せるようにする", async () => {
      verifyPasswordResetLink.mockResolvedValue({ ok: false, reason: "network-error" });
      render(<ResetPasswordForm oobCode="oob-code" />);

      expect(await screen.findByText(/firebase emulators:start/)).toBeInTheDocument();
      // リンク自体はまだ有効な可能性があるため、同じリンクでの再試行を一次導線にする
      expect(screen.getByRole("button", { name: "再試行する" })).toBeInTheDocument();
      // 取り直したい場合のためにA6への導線も残す
      expect(
        screen.getByRole("link", { name: "パスワードをお忘れの方へ戻る" }),
      ).toBeInTheDocument();
    });

    it("「再試行する」で検証をやり直し、成功すれば入力欄を表示する", async () => {
      const user = userEvent.setup();
      verifyPasswordResetLink.mockResolvedValue({ ok: false, reason: "network-error" });
      render(<ResetPasswordForm oobCode="oob-code" />);

      const retryButton = await screen.findByRole("button", { name: "再試行する" });
      verifyPasswordResetLink.mockResolvedValue({ ok: true, email: "user@example.com" });

      await user.click(retryButton);

      expect(await screen.findByLabelText("新パスワード")).toBeInTheDocument();
      expect(verifyPasswordResetLink).toHaveBeenCalledTimes(2);
    });

    it("リンクが無効なときは再試行しても変わらないため、やり直しの導線を出さない", async () => {
      verifyPasswordResetLink.mockResolvedValue({ ok: false, reason: "invalid-action-code" });
      render(<ResetPasswordForm oobCode="oob-code" />);

      await screen.findByRole("link", { name: "パスワードをお忘れの方へ戻る" });
      expect(screen.queryByRole("button", { name: "再試行する" })).not.toBeInTheDocument();
    });
  });

  describe("バリデーションエラー", () => {
    it("未入力のときはインラインエラーを表示し、再設定しない", async () => {
      const user = userEvent.setup();
      await renderReady();

      await user.click(screen.getByRole("button", { name: "パスワードを再設定する" }));

      expect(await screen.findByText("パスワードを入力してください")).toBeInTheDocument();
      expect(completePasswordReset).not.toHaveBeenCalled();
    });

    it("ポリシーを満たさないときはインラインエラーを表示し、再設定しない", async () => {
      const user = userEvent.setup();
      await renderReady();

      // 数字だけを欠いたパスワード。違反した条件がそのままエラー文言になる
      await submitWith(user, "Password!");

      expect(await screen.findByText("数字を1文字以上含めてください")).toBeInTheDocument();
      expect(completePasswordReset).not.toHaveBeenCalled();
    });

    it("確認用が一致しないときはインラインエラーを表示し、再設定しない", async () => {
      const user = userEvent.setup();
      await renderReady();

      await submitWith(user, NEW_PASSWORD, "Different1!");

      expect(await screen.findByText("パスワードが一致しません")).toBeInTheDocument();
      expect(completePasswordReset).not.toHaveBeenCalled();
    });
  });

  describe("再設定の実行", () => {
    it("入力したパスワードでリンクのコードを使って確定する", async () => {
      const user = userEvent.setup();
      await renderReady();

      await submitWith(user);

      await waitFor(() => {
        expect(completePasswordReset).toHaveBeenCalledWith("oob-code", NEW_PASSWORD);
      });
    });

    it("サーバー側のポリシー違反はパスワード欄のエラーとして表示する", async () => {
      const user = userEvent.setup();
      completePasswordReset.mockResolvedValue({ ok: false, reason: "password-policy-violation" });
      await renderReady();

      await submitWith(user);

      expect(
        await screen.findByText("パスワードがパスワードポリシーを満たしていません"),
      ).toBeInTheDocument();
      // リンクは有効なままなので、入力し直せる
      expect(screen.getByLabelText("新パスワード")).toBeInTheDocument();
    });

    it("確定時にリンクが失効していたらA6への導線に切り替える", async () => {
      const user = userEvent.setup();
      completePasswordReset.mockResolvedValue({ ok: false, reason: "invalid-action-code" });
      await renderReady();

      await submitWith(user);

      expect(
        await screen.findByRole("link", { name: "パスワードをお忘れの方へ戻る" }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("新パスワード")).not.toBeInTheDocument();
    });

    it("レート制限のときはフォーム全体のエラーとして表示し、入力欄は残す", async () => {
      const user = userEvent.setup();
      completePasswordReset.mockResolvedValue({ ok: false, reason: "too-many-requests" });
      await renderReady();

      await submitWith(user);

      expect(
        await screen.findByText(
          "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("新パスワード")).toBeInTheDocument();
    });

    it("再設定中はボタンを無効化して二重送信を防ぐ", async () => {
      const user = userEvent.setup();
      let resolveConfirm: (result: PasswordResetConfirmResult) => void = () => {};
      completePasswordReset.mockReturnValue(
        new Promise<PasswordResetConfirmResult>((resolve) => {
          resolveConfirm = resolve;
        }),
      );
      await renderReady();

      await submitWith(user);

      const button = await screen.findByRole("button", { name: "再設定中..." });
      expect(button).toBeDisabled();

      resolveConfirm({ ok: true });
      await screen.findByText(COMPLETED_MESSAGE);
      expect(completePasswordReset).toHaveBeenCalledTimes(1);
    });
  });

  describe("再設定の完了", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("完了メッセージとログイン画面への導線を表示する", async () => {
      const user = userEvent.setup();
      await renderReady();

      await submitWith(user);

      expect(await screen.findByText(COMPLETED_MESSAGE)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "今すぐログイン画面へ" })).toHaveAttribute(
        "href",
        LOGIN_PATH,
      );
      expect(screen.queryByLabelText("新パスワード")).not.toBeInTheDocument();
    });

    it("完了メッセージを表示したあとA4へ遷移する", async () => {
      // 自動遷移までの待ち時間をテスト側で進めるため、この検証だけタイマーを偽装する。
      // `userEvent`は内部の待機が偽装タイマーと噛み合わないので`fireEvent`で操作する
      vi.useFakeTimers();
      render(<ResetPasswordForm oobCode="oob-code" />);
      await settle();

      fireEvent.change(screen.getByLabelText("新パスワード"), {
        target: { value: NEW_PASSWORD },
      });
      fireEvent.change(screen.getByLabelText("新パスワード(確認用)"), {
        target: { value: NEW_PASSWORD },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "パスワードを再設定する" }));
      });

      expect(screen.getByText(COMPLETED_MESSAGE)).toBeInTheDocument();
      // 完了直後は表示を残し、読み取れるだけの間を置いてから移す
      expect(replace).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PASSWORD_RESET_COMPLETE_REDIRECT_MS);
      });

      expect(replace).toHaveBeenCalledWith(LOGIN_PATH);
    });
  });
});

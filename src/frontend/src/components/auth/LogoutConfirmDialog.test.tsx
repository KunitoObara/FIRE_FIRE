import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

/**
 * `Omit`は判別可能なユニオン型に対して分配されず、variantごとの`pendingStep`が
 * 消えてしまうため、ここだけ分配させるヘルパーを挟む。
 */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

/**
 * `LogoutConfirmDialog`は`open`/`onOpenChange`で制御するコンポーネントのため、
 * 実際の開閉を確かめるにはテスト側でも状態を持って橋渡しする必要がある。
 */
const ControlledDialog = (
  props: DistributiveOmit<LogoutConfirmDialogProps, "open" | "onOpenChange"> & {
    initialOpen?: boolean;
  },
): React.JSX.Element => {
  const { initialOpen = true, ...rest } = props;
  const [open, setOpen] = useState(initialOpen);

  return <LogoutConfirmDialog {...rest} open={open} onOpenChange={setOpen} />;
};

describe("LogoutConfirmDialog", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  describe("見出し・ボタン(呼び出し元によらず共通)", () => {
    it("見出しと2つのボタンを表示する", () => {
      const onConfirm = vi.fn<() => Promise<SignOutResult>>();
      render(<ControlledDialog variant="header" onConfirm={onConfirm} />);

      expect(screen.getByRole("heading", { name: "ログアウトしますか?" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "ログアウトする" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
    });
  });

  describe("注記の出し分け", () => {
    it("共通ヘッダーからは確認コードが必要になる旨を出す", () => {
      const onConfirm = vi.fn<() => Promise<SignOutResult>>();
      render(<ControlledDialog variant="header" onConfirm={onConfirm} />);

      expect(
        screen.getByText(
          "次回のログインでは、パスワードに加えて認証アプリの確認コードの入力が必要です。",
        ),
      ).toBeInTheDocument();
    });

    it("A2からはメールアドレス確認が未完了である旨を出し、確認コードには触れない", () => {
      const onConfirm = vi.fn<() => Promise<SignOutResult>>();
      render(
        <ControlledDialog
          variant="auth-flow"
          pendingStep="email-unverified"
          onConfirm={onConfirm}
        />,
      );

      expect(
        screen.getByText(
          "ログアウトし、ログイン画面へ移動します。メールアドレスの確認はまだ完了していません。",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/確認コード/)).not.toBeInTheDocument();
    });

    it("A3からは2FA登録が未完了である旨を出し、確認コードには触れない", () => {
      const onConfirm = vi.fn<() => Promise<SignOutResult>>();
      render(
        <ControlledDialog variant="auth-flow" pendingStep="mfa-required" onConfirm={onConfirm} />,
      );

      expect(
        screen.getByText(
          "ログアウトし、ログイン画面へ移動します。2段階認証の登録はまだ完了していません。",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/確認コード/)).not.toBeInTheDocument();
    });
  });

  describe("キャンセル", () => {
    it("ログアウトを実行せず、ダイアログを閉じる", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn<() => Promise<SignOutResult>>();
      render(<ControlledDialog variant="header" onConfirm={onConfirm} />);

      await user.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "ログアウトしますか?" }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("「ログアウトする」", () => {
    it("成功したら実行し、A4へ履歴を置き換えて遷移する", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn<() => Promise<SignOutResult>>().mockResolvedValue({ ok: true });
      render(<ControlledDialog variant="header" onConfirm={onConfirm} />);

      await user.click(screen.getByRole("button", { name: "ログアウトする" }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/login");
      });
    });

    it("失敗したらダイアログを閉じずにエラーを表示する", async () => {
      const user = userEvent.setup();
      const onConfirm = vi
        .fn<() => Promise<SignOutResult>>()
        .mockResolvedValue({ ok: false, reason: "network-error" });
      render(<ControlledDialog variant="header" onConfirm={onConfirm} />);

      await user.click(screen.getByRole("button", { name: "ログアウトする" }));

      expect(await screen.findByText(/ネットワーク接続を確認してください/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "ログアウトしますか?" })).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("失敗後に再試行できる", async () => {
      const user = userEvent.setup();
      const onConfirm = vi
        .fn<() => Promise<SignOutResult>>()
        .mockResolvedValueOnce({ ok: false, reason: "unknown" })
        .mockResolvedValueOnce({ ok: true });
      render(<ControlledDialog variant="header" onConfirm={onConfirm} />);

      await user.click(screen.getByRole("button", { name: "ログアウトする" }));
      await screen.findByText("ログアウトできませんでした。しばらく待ってから再度お試しください。");

      await user.click(screen.getByRole("button", { name: "ログアウトする" }));

      expect(onConfirm).toHaveBeenCalledTimes(2);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/login");
      });
    });

    it("送信中はボタンを無効化して二重送信を防ぐ", async () => {
      const user = userEvent.setup();
      let resolveConfirm: ((result: SignOutResult) => void) | undefined;
      const onConfirm = vi.fn<() => Promise<SignOutResult>>().mockReturnValue(
        new Promise<SignOutResult>((resolve) => {
          resolveConfirm = resolve;
        }),
      );
      render(<ControlledDialog variant="header" onConfirm={onConfirm} />);

      await user.click(screen.getByRole("button", { name: "ログアウトする" }));

      const button = await screen.findByRole("button", { name: "ログアウト中..." });
      expect(button).toBeDisabled();
      expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();

      resolveConfirm?.({ ok: true });
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/login");
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});

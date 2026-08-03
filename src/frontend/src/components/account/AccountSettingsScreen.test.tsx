import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSettingsScreen } from "@/components/account/AccountSettingsScreen";

import type { RenderResult } from "@testing-library/react";

const currentUser = vi.fn<() => { email: string | null } | null>();
const hasEnrolledTotp = vi.fn<() => boolean>();
const requestPasswordReset = vi.fn();
const fetchRecoveryCodeStatus = vi.fn();
const issueRecoveryCodes = vi.fn();
const resetMfaEnrollment = vi.fn();
const downloadRecoveryCodes = vi.fn();
const replace = vi.fn();

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseAuth: () => ({ currentUser: currentUser() }),
}));

vi.mock("@/lib/auth/mfa-enrollment", () => ({
  hasEnrolledTotp: () => hasEnrolledTotp(),
}));

vi.mock("@/lib/auth/password-reset", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
}));

vi.mock("@/lib/auth/mfa-recovery", () => ({
  fetchRecoveryCodeStatus: () => fetchRecoveryCodeStatus(),
  issueRecoveryCodes: (...args: unknown[]) => issueRecoveryCodes(...args),
}));

vi.mock("@/lib/auth/mfa-reset", () => ({
  resetMfaEnrollment: (...args: unknown[]) => resetMfaEnrollment(...args),
}));

vi.mock("@/lib/auth/recovery-code-file", () => ({
  downloadRecoveryCodes: (...args: unknown[]) => downloadRecoveryCodes(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const CODES = ["7F2K-9QRT", "M3XZ-2LDS"];

const renderScreen = (): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AccountSettingsScreen />
    </QueryClientProvider>,
  );

/** ダイアログを開いてパスワードを入れ、確認ボタンを押すまで */
const confirmWithPassword = async (
  user: ReturnType<typeof userEvent.setup>,
  openLabel: string,
  confirmLabel: string,
  password = "Passw0rd!",
): Promise<void> => {
  await user.click(await screen.findByRole("button", { name: openLabel }));
  await user.type(await screen.findByLabelText("パスワード"), password);
  await user.click(screen.getByRole("button", { name: confirmLabel }));
};

describe("AccountSettingsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockReturnValue({ email: "taro.yamada@example.com" });
    hasEnrolledTotp.mockReturnValue(true);
    requestPasswordReset.mockResolvedValue({ ok: true });
    fetchRecoveryCodeStatus.mockResolvedValue({
      ok: true,
      status: {
        generatedAt: new Date(2026, 6, 30, 21, 52).getTime(),
        remainingCodes: 6,
        totalCodes: 8,
      },
    });
    issueRecoveryCodes.mockResolvedValue({ ok: true, codes: CODES });
    resetMfaEnrollment.mockResolvedValue({ ok: true });
  });

  describe("アカウント情報", () => {
    it("登録メールアドレスと2FA設定状況を表示する", async () => {
      renderScreen();

      expect(await screen.findByText("taro.yamada@example.com")).toBeInTheDocument();
      expect(screen.getByText("有効")).toBeInTheDocument();
    });

    it("2FAが未登録なら未設定として表示する", async () => {
      hasEnrolledTotp.mockReturnValue(false);
      renderScreen();

      expect(await screen.findByText("未設定")).toBeInTheDocument();
    });
  });

  describe("パスワード変更メール", () => {
    /** 要件の遷移条件「A6〜A7と同じリセットメールフロー。現在のパスワード入力は不要」 */
    it("登録メールアドレス宛に送信し、送信済みを画面に出す", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(
        await screen.findByRole("button", { name: "パスワード変更メールを送信する" }),
      );

      await waitFor(() => {
        expect(requestPasswordReset).toHaveBeenCalledWith("taro.yamada@example.com");
      });
      expect(
        await screen.findByText(
          /taro.yamada@example.com 宛にパスワード変更用のメールを送信しました/,
        ),
      ).toBeInTheDocument();
    });

    it("送信に失敗したら理由を表示する", async () => {
      const user = userEvent.setup();
      requestPasswordReset.mockResolvedValue({ ok: false, reason: "too-many-requests" });
      renderScreen();

      await user.click(
        await screen.findByRole("button", { name: "パスワード変更メールを送信する" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(/試行回数が多いため/);
    });
  });

  describe("リカバリーコード", () => {
    it("残り本数と発行日時を表示する", async () => {
      renderScreen();

      expect(await screen.findByText("残り 6 / 8 本")).toBeInTheDocument();
      expect(screen.getByText("発行日時: 2026/07/30 21:52")).toBeInTheDocument();
    });

    it("発行状況を取得できなければ理由を表示する", async () => {
      fetchRecoveryCodeStatus.mockResolvedValue({ ok: false, reason: "unavailable" });
      renderScreen();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /サーバー側の処理に接続できませんでした/,
      );
    });

    /** 再発行は以前のコードを無効にするため、本人確認を経てから実行する */
    it("パスワードを確認したうえで再発行し、新しいコードをその場に表示する", async () => {
      const user = userEvent.setup();
      renderScreen();

      await confirmWithPassword(user, "リカバリーコードを再発行する", "確認して再発行する");

      await waitFor(() => {
        expect(issueRecoveryCodes).toHaveBeenCalledWith("Passw0rd!");
      });
      expect(await screen.findByText("7F2K-9QRT")).toBeInTheDocument();
      expect(screen.getByText("M3XZ-2LDS")).toBeInTheDocument();
    });

    it("表示したコードをダウンロードできる", async () => {
      const user = userEvent.setup();
      renderScreen();

      await confirmWithPassword(user, "リカバリーコードを再発行する", "確認して再発行する");
      await user.click(
        await screen.findByRole("button", { name: "リカバリーコードをダウンロード" }),
      );

      expect(downloadRecoveryCodes).toHaveBeenCalledWith(CODES, expect.any(Date));
    });

    it("パスワードが誤っていればダイアログを閉じずにエラーを出し、コードを表示しない", async () => {
      const user = userEvent.setup();
      issueRecoveryCodes.mockResolvedValue({ ok: false, reason: "invalid-credential" });
      renderScreen();

      await confirmWithPassword(
        user,
        "リカバリーコードを再発行する",
        "確認して再発行する",
        "wrong",
      );

      expect(await screen.findByText("パスワードが正しくありません。")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "リカバリーコードを再発行しますか?" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("7F2K-9QRT")).not.toBeInTheDocument();
    });

    it("パスワード未入力では実行しない", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole("button", { name: "リカバリーコードを再発行する" }));
      await user.click(screen.getByRole("button", { name: "確認して再発行する" }));

      expect(await screen.findByText("パスワードを入力してください")).toBeInTheDocument();
      expect(issueRecoveryCodes).not.toHaveBeenCalled();
    });

    /** A3で発行に失敗したままB10へ来た場合。無効になるコードが無いので「発行」として案内する */
    it("未発行なら発行として案内する", async () => {
      fetchRecoveryCodeStatus.mockResolvedValue({
        ok: true,
        status: { generatedAt: null, remainingCodes: 0, totalCodes: 0 },
      });
      renderScreen();

      expect(await screen.findByText("未発行")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "リカバリーコードを発行する" }),
      ).toBeInTheDocument();
    });
  });

  describe("2FA再設定", () => {
    /** 要件の遷移条件「本人確認を経て現2FAを無効化し、A3の登録フローを再実行」 */
    it("パスワードを確認したうえで解除し、A3へ履歴を置き換えて遷移する", async () => {
      const user = userEvent.setup();
      renderScreen();

      await confirmWithPassword(user, "2FAを再設定する", "確認して再設定する");

      await waitFor(() => {
        expect(resetMfaEnrollment).toHaveBeenCalledWith("Passw0rd!");
      });
      expect(replace).toHaveBeenCalledWith("/mfa-setup");
    });

    it("パスワードが誤っていれば解除せずエラーを出す", async () => {
      const user = userEvent.setup();
      resetMfaEnrollment.mockResolvedValue({ ok: false, reason: "invalid-credential" });
      renderScreen();

      await confirmWithPassword(user, "2FAを再設定する", "確認して再設定する", "wrong");

      expect(await screen.findByText("パスワードが正しくありません。")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  /** 連携アカウントの管理はTrelloカード [A8-2] のスコープ */
  it("ログイン方法(Google連携)のセクションは出さない", async () => {
    renderScreen();

    await screen.findByText("taro.yamada@example.com");
    expect(screen.queryByText("ログイン方法")).not.toBeInTheDocument();
  });
});

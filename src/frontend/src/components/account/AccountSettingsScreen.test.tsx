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
const getLinkedProviders = vi.fn<() => LinkedProviderStatus[]>();
const linkGoogleAccount = vi.fn();
const unlinkProvider = vi.fn();
const unlinkPasswordProvider = vi.fn();
const hasPasswordProvider = vi.fn<(...args: unknown[]) => boolean>();
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

vi.mock("@/lib/auth/linked-providers", () => ({
  getLinkedProviders: () => getLinkedProviders(),
  linkGoogleAccount: () => linkGoogleAccount(),
  unlinkProvider: (...args: unknown[]) => unlinkProvider(...args),
  unlinkPasswordProvider: (...args: unknown[]) => unlinkPasswordProvider(...args),
  // アカウント削除カードの可否判定に使う(docs/auth-login-requirements.md 3.11)
  hasPasswordProvider: (...args: unknown[]) => hasPasswordProvider(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const CODES = ["7F2K-9QRT", "M3XZ-2LDS"];

/** 連携状況。パスワードとGoogleの両方が連携済みの状態を既定にする */
const linkedProviders = (google: boolean, password = true): LinkedProviderStatus[] => [
  { id: "password", isLinked: password, email: password ? "taro.yamada@example.com" : null },
  // 登録メールアドレスとは別の文字列にしておく。同じにするとGoogle行に出ている
  // ことを画面上の他の箇所と区別して確認できない
  { id: "google.com", isLinked: google, email: google ? "taro.google@example.com" : null },
];

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
    hasPasswordProvider.mockReturnValue(true);
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
    getLinkedProviders.mockReturnValue(linkedProviders(true));
    linkGoogleAccount.mockResolvedValue({ ok: true });
    unlinkProvider.mockResolvedValue({ ok: true });
    unlinkPasswordProvider.mockResolvedValue({ ok: true });
  });

  describe("アカウント情報", () => {
    it("登録メールアドレスと2FA設定状況を表示する", async () => {
      renderScreen();

      // 「ログイン方法」のパスワード行にも同じアドレスが出るため、ここでは件数を問わない
      expect(await screen.findAllByText("taro.yamada@example.com")).not.toHaveLength(0);
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

  describe("アカウントの削除", () => {
    /**
     * 設定を見に来ただけの人の目に最初に入る場所ではない
     * (docs/screen-requirements-account.md「アカウントの削除」)。
     */
    it("削除カードを画面の最後に置く", () => {
      const { container } = renderScreen();

      // `CardTitle`は見出し要素ではなく`data-slot`付きのdivとして描画される
      const titles = [...container.querySelectorAll('[data-slot="card-title"]')].map(
        (title) => title.textContent,
      );

      expect(titles.at(-1)).toBe("アカウントの削除");
    });

    /**
     * 配線を間違えると、本人確認を通せないGoogle専用アカウントでもボタンを押せてしまう。
     * 型はどちらもbooleanで拾えないため、ここで固定する。
     */
    it("パスワードでのログインが無ければ削除ボタンを無効化する", () => {
      hasPasswordProvider.mockReturnValue(false);

      renderScreen();

      expect(screen.getByRole("button", { name: "アカウントを削除する" })).toBeDisabled();
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

  describe("ログイン方法", () => {
    it("連携状況とGoogleアカウントのメールアドレスを表示する", async () => {
      renderScreen();

      expect(await screen.findByText("ログイン方法")).toBeInTheDocument();
      expect(screen.getByText("メールアドレス / パスワード")).toBeInTheDocument();
      expect(screen.getByText("Google")).toBeInTheDocument();
      expect(screen.getByText("taro.google@example.com")).toBeInTheDocument();
      expect(screen.getAllByText("連携済み")).toHaveLength(2);
    });

    /** 通知メールの宛先は連携したGoogleアカウントではなく登録メールアドレスのまま(要件の制約) */
    it("ログイン通知メールの宛先が変わらない旨を注記する", async () => {
      renderScreen();

      expect(
        await screen.findByText(/ログイン通知メールの宛先は、連携したGoogleアカウント/),
      ).toBeInTheDocument();
    });

    it("未連携なら連携ボタンを出し、成功したら画面内にメッセージを出す", async () => {
      const user = userEvent.setup();
      getLinkedProviders.mockReturnValue(linkedProviders(false));
      renderScreen();

      expect(await screen.findByText("未連携")).toBeInTheDocument();

      getLinkedProviders.mockReturnValue(linkedProviders(true));
      await user.click(screen.getByRole("button", { name: "Googleと連携する" }));

      expect(await screen.findByText(/Googleアカウントを連携しました/)).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    /** 別のFIRE-FIREアカウントで使用済みのGoogleアカウントは連携できない(要件の制約) */
    it("連携先が別アカウントで使用済みならエラーを画面内に出す", async () => {
      const user = userEvent.setup();
      getLinkedProviders.mockReturnValue(linkedProviders(false));
      linkGoogleAccount.mockResolvedValue({ ok: false, reason: "credential-already-in-use" });
      renderScreen();

      await user.click(await screen.findByRole("button", { name: "Googleと連携する" }));

      expect(
        await screen.findByText(/このGoogleアカウントは別のアカウントで既に使用されています/),
      ).toBeInTheDocument();
    });

    /** ポップアップを自分で閉じたのは取りやめであって失敗ではない */
    it("ポップアップを閉じただけならエラーを出さない", async () => {
      const user = userEvent.setup();
      getLinkedProviders.mockReturnValue(linkedProviders(false));
      linkGoogleAccount.mockResolvedValue({ ok: false, reason: "popup-closed" });
      renderScreen();

      await user.click(await screen.findByRole("button", { name: "Googleと連携する" }));

      await waitFor(() => {
        expect(linkGoogleAccount).toHaveBeenCalled();
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("確認ダイアログを経て解除し、画面内にメッセージを出す", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole("button", { name: "Googleの連携を解除" }));
      expect(
        screen.getByRole("heading", { name: "Googleとの連携を解除しますか?" }),
      ).toBeInTheDocument();

      getLinkedProviders.mockReturnValue(linkedProviders(false));
      await user.click(screen.getByRole("button", { name: "解除する" }));

      await waitFor(() => {
        expect(unlinkProvider).toHaveBeenCalledWith("google.com");
      });
      expect(await screen.findByText(/Googleでの連携を解除しました/)).toBeInTheDocument();
    });

    /** パスワードの解除は戻せないため、失うものを伝えたうえで本人確認まで求める */
    it("パスワードの解除では復旧手段を失う旨と本人確認をダイアログに出す", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(
        await screen.findByRole("button", { name: "メールアドレス / パスワードの連携を解除" }),
      );

      expect(
        screen.getByRole("heading", {
          name: "メールアドレス / パスワードでのログインを解除しますか?",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/2FAの再設定・リカバリーコードの発行・リカバリーコードでの復旧も使えなく/),
      ).toBeInTheDocument();
      expect(await screen.findByLabelText("パスワード")).toBeInTheDocument();
    });

    it("パスワードを確認したうえで解除し、画面内にメッセージを出す", async () => {
      const user = userEvent.setup();
      renderScreen();

      getLinkedProviders.mockReturnValue(linkedProviders(true, false));
      await confirmWithPassword(
        user,
        "メールアドレス / パスワードの連携を解除",
        "確認して解除する",
      );

      await waitFor(() => {
        expect(unlinkPasswordProvider).toHaveBeenCalledWith("Passw0rd!");
      });
      expect(
        await screen.findByText(/メールアドレス \/ パスワードでの連携を解除しました/),
      ).toBeInTheDocument();
    });

    /** 本人確認が通らないうちは解除しない。ダイアログを閉じず入力し直せるようにする */
    it("パスワードが誤っていれば解除せずエラーを出す", async () => {
      const user = userEvent.setup();
      unlinkPasswordProvider.mockResolvedValue({ ok: false, reason: "invalid-credential" });
      renderScreen();

      await confirmWithPassword(
        user,
        "メールアドレス / パスワードの連携を解除",
        "確認して解除する",
      );

      expect(await screen.findByText("パスワードが正しくありません。")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "メールアドレス / パスワードでのログインを解除しますか?",
        }),
      ).toBeInTheDocument();
    });

    /** Googleの解除は連携し直せるため、本人確認は挟まない(要件どおり確認だけ) */
    it("Googleの解除ではパスワードを求めない", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole("button", { name: "Googleの連携を解除" }));

      expect(screen.queryByLabelText("パスワード")).not.toBeInTheDocument();
    });

    it("解除に失敗したらダイアログを閉じずにエラーを出す", async () => {
      const user = userEvent.setup();
      unlinkProvider.mockResolvedValue({ ok: false, reason: "requires-recent-login" });
      renderScreen();

      await user.click(await screen.findByRole("button", { name: "Googleの連携を解除" }));
      await user.click(screen.getByRole("button", { name: "解除する" }));

      expect(await screen.findByText(/ログインし直してから解除してください/)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Googleとの連携を解除しますか?" }),
      ).toBeInTheDocument();
    });

    /** 要件の制約「最後に残った1つのログイン方法は解除できない」 */
    it("ログイン方法が1つだけなら解除ボタンを無効化し、理由を併記する", async () => {
      getLinkedProviders.mockReturnValue(linkedProviders(false));
      renderScreen();

      expect(
        await screen.findByRole("button", { name: "メールアドレス / パスワードの連携を解除" }),
      ).toBeDisabled();
      expect(screen.getByText("唯一のログイン方法のため解除できません")).toBeInTheDocument();
    });
  });
});

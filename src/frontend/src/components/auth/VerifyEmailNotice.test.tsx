import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerifyEmailNotice } from "@/components/auth/VerifyEmailNotice";
import {
  EMAIL_VERIFICATION_POLL_INTERVAL_MS,
  RESEND_VERIFICATION_EMAIL_COOLDOWN_SECONDS,
  RESEND_VERIFICATION_EMAIL_COUNTDOWN_TICK_MS,
} from "@/constants/auth";

const replace = vi.fn();
const reloadEmailVerificationState = vi.fn<() => Promise<EmailVerificationState>>();
const resendVerificationEmail = vi.fn<() => Promise<ResendVerificationEmailResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/email-verification", () => ({
  reloadEmailVerificationState: () => reloadEmailVerificationState(),
  resendVerificationEmail: () => resendVerificationEmail(),
}));

const UNVERIFIED: EmailVerificationState = { status: "unverified", email: "user@example.com" };

/**
 * ポーリングとクールダウンをテスト側で進めるため、タイマーは常に偽装する。
 * 偽装タイマー下では`findBy`/`waitFor`が進まないため、待機はすべて
 * `settle`(マイクロタスクの消化)と`advance`(時間の前進)で行う。
 */
const settle = (): Promise<void> => act(async () => {});

const advance = (ms: number): Promise<void> =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/**
 * クールダウンの残り秒数を1秒ずつ進める。
 * 次の1秒のタイマーは再レンダー後に登録されるため、まとめて時間を進めると連鎖が途切れる。
 */
const advanceSeconds = async (seconds: number): Promise<void> => {
  for (let i = 0; i < seconds; i += 1) {
    await advance(RESEND_VERIFICATION_EMAIL_COUNTDOWN_TICK_MS);
  }
};

/** マウントし、初回の確認状況チェックが反映されるまで進める */
const renderAndSettle = async (): Promise<void> => {
  render(<VerifyEmailNotice />);
  await settle();
};

const resendButton = (): HTMLElement =>
  screen.getByRole("button", { name: /確認メールを再送する/ });

/**
 * 「確認メールを再送する」を押し、結果が反映されるまで進める。
 * `userEvent`は内部の待機が偽装タイマーと噛み合わないため、`fireEvent`を使う。
 */
const clickResend = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(resendButton());
  });
};

/** タブが表示状態に戻ったことを通知する */
const returnToTab = async (): Promise<void> => {
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

describe("VerifyEmailNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockReset();
    resendVerificationEmail.mockReset();
    resendVerificationEmail.mockResolvedValue({ ok: true });
    reloadEmailVerificationState.mockReset();
    reloadEmailVerificationState.mockResolvedValue(UNVERIFIED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("表示項目", () => {
    it("送信先メールアドレスと確認手順の案内文を表示する", async () => {
      await renderAndSettle();

      expect(
        screen.getByRole("heading", { level: 1, name: "メールアドレスの確認をお願いします" }),
      ).toBeInTheDocument();
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
      expect(
        screen.getByText(/メール本文内のリンクをクリックすると確認が完了し/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "サインアップからやり直してください" }),
      ).toHaveAttribute("href", "/signup");
    });

    it("入力項目は持たない", async () => {
      await renderAndSettle();

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("メールアドレスが取得できない場合も画面自体は表示する", async () => {
      reloadEmailVerificationState.mockResolvedValue({ status: "unverified", email: null });
      await renderAndSettle();

      expect(
        screen.getByRole("heading", { level: 1, name: "メールアドレスの確認をお願いします" }),
      ).toBeInTheDocument();
      expect(resendButton()).toBeEnabled();
    });
  });

  describe("確認完了の検知", () => {
    it("未確認のままなら遷移しない", async () => {
      await renderAndSettle();
      await advance(EMAIL_VERIFICATION_POLL_INTERVAL_MS * 3);

      expect(replace).not.toHaveBeenCalled();
    });

    it("ポーリングで確認完了を検知したらA3へ遷移する", async () => {
      await renderAndSettle();
      expect(replace).not.toHaveBeenCalled();

      reloadEmailVerificationState.mockResolvedValue({ status: "verified" });
      await advance(EMAIL_VERIFICATION_POLL_INTERVAL_MS);

      expect(replace).toHaveBeenCalledWith("/mfa-setup");
    });

    it("確認完了後はポーリングを止める", async () => {
      await renderAndSettle();

      reloadEmailVerificationState.mockResolvedValue({ status: "verified" });
      await advance(EMAIL_VERIFICATION_POLL_INTERVAL_MS);

      const callsWhenVerified = reloadEmailVerificationState.mock.calls.length;
      await advance(EMAIL_VERIFICATION_POLL_INTERVAL_MS * 3);

      expect(reloadEmailVerificationState).toHaveBeenCalledTimes(callsWhenVerified);
    });

    it("タブに戻ってきた時点で、次のポーリングを待たずに確認する", async () => {
      await renderAndSettle();
      const callsAfterMount = reloadEmailVerificationState.mock.calls.length;

      reloadEmailVerificationState.mockResolvedValue({ status: "verified" });
      await returnToTab();

      expect(reloadEmailVerificationState.mock.calls.length).toBeGreaterThan(callsAfterMount);
      expect(replace).toHaveBeenCalledWith("/mfa-setup");
    });

    it("確認状況の取得に失敗しても画面は保ち、エラーを表示したまま確認を続ける", async () => {
      reloadEmailVerificationState.mockResolvedValueOnce(UNVERIFIED);
      await renderAndSettle();

      reloadEmailVerificationState.mockResolvedValue({ status: "unknown-error" });
      await advance(EMAIL_VERIFICATION_POLL_INTERVAL_MS);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "確認状況を取得できませんでした。通信状況をご確認ください。",
      );
      // 送信先は判明済みの値を保ち続ける
      expect(screen.getByText("user@example.com")).toBeInTheDocument();

      reloadEmailVerificationState.mockResolvedValue({ status: "verified" });
      await advance(EMAIL_VERIFICATION_POLL_INTERVAL_MS);

      expect(replace).toHaveBeenCalledWith("/mfa-setup");
    });

    it("Firebase未設定のときは対処法を表示し、確認を繰り返さない", async () => {
      reloadEmailVerificationState.mockResolvedValue({ status: "configuration-error" });
      await renderAndSettle();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Firebaseの設定が完了していません。.env.example をコピーして .env.local を作成し、設定値を記入してください。",
      );

      const callsAfterMount = reloadEmailVerificationState.mock.calls.length;
      await advance(EMAIL_VERIFICATION_POLL_INTERVAL_MS * 3);

      expect(reloadEmailVerificationState).toHaveBeenCalledTimes(callsAfterMount);
    });
  });

  describe("セッションが無い場合", () => {
    it("A1へ遷移する", async () => {
      reloadEmailVerificationState.mockResolvedValue({ status: "signed-out" });
      await renderAndSettle();

      expect(replace).toHaveBeenCalledWith("/signup");
      expect(
        screen.queryByRole("button", { name: /確認メールを再送する/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("確認メールの再送", () => {
    it("押下で再送し、成功メッセージを表示して画面に留まる", async () => {
      await renderAndSettle();

      await clickResend();

      expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(screen.getByText("確認メールを再送しました。")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("再送後はクールダウン中の残り秒数を出してボタンを無効化し、経過後に再び押せる", async () => {
      await renderAndSettle();

      await clickResend();

      expect(
        screen.getByRole("button", {
          name: `確認メールを再送する(あと${RESEND_VERIFICATION_EMAIL_COOLDOWN_SECONDS}秒)`,
        }),
      ).toBeDisabled();

      await advance(RESEND_VERIFICATION_EMAIL_COUNTDOWN_TICK_MS);
      expect(
        screen.getByRole("button", {
          name: `確認メールを再送する(あと${RESEND_VERIFICATION_EMAIL_COOLDOWN_SECONDS - 1}秒)`,
        }),
      ).toBeDisabled();

      await advanceSeconds(RESEND_VERIFICATION_EMAIL_COOLDOWN_SECONDS - 1);

      const button = screen.getByRole("button", { name: "確認メールを再送する" });
      expect(button).toBeEnabled();

      await clickResend();
      expect(resendVerificationEmail).toHaveBeenCalledTimes(2);
    });

    it("送信中はボタンを無効化し、二重送信を防ぐ", async () => {
      // 送信中の状態を観測できるよう、テスト側で解決タイミングを制御する
      let resolveResend: ((result: ResendVerificationEmailResult) => void) | undefined;
      resendVerificationEmail.mockReturnValue(
        new Promise<ResendVerificationEmailResult>((resolve) => {
          resolveResend = resolve;
        }),
      );
      await renderAndSettle();

      await clickResend();

      const sendingButton = screen.getByRole("button", { name: "送信中..." });
      expect(sendingButton).toBeDisabled();

      await act(async () => {
        fireEvent.click(sendingButton);
      });
      expect(resendVerificationEmail).toHaveBeenCalledTimes(1);

      resolveResend?.({ ok: true });
      await settle();

      expect(screen.getByText("確認メールを再送しました。")).toBeInTheDocument();
    });

    it("レート制限のときはエラーメッセージを表示する", async () => {
      resendVerificationEmail.mockResolvedValue({ ok: false, reason: "too-many-requests" });
      await renderAndSettle();

      await clickResend();

      expect(
        screen.getByText(
          "再送の回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
        ),
      ).toBeInTheDocument();
    });

    it("原因不明の失敗時もエラーメッセージを表示し、画面に留まる", async () => {
      resendVerificationEmail.mockResolvedValue({ ok: false, reason: "unknown" });
      await renderAndSettle();

      await clickResend();

      expect(
        screen.getByText(
          "確認メールを再送できませんでした。しばらく待ってから再度お試しください。",
        ),
      ).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("失敗したときはクールダウンを開始せず、すぐに再試行できる", async () => {
      resendVerificationEmail.mockResolvedValue({ ok: false, reason: "unknown" });
      await renderAndSettle();

      await clickResend();

      expect(screen.getByRole("button", { name: "確認メールを再送する" })).toBeEnabled();
    });

    it("再送時にセッションが失われていたらA1へ遷移する", async () => {
      resendVerificationEmail.mockResolvedValue({ ok: false, reason: "no-session" });
      await renderAndSettle();

      await clickResend();

      expect(replace).toHaveBeenCalledWith("/signup");
    });
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MfaSetupForm } from "@/components/auth/MfaSetupForm";
import { TOTP_CODE_LENGTH } from "@/constants/auth";

import type { TotpSecret } from "firebase/auth";

import type * as MfaEnrollmentModule from "@/lib/auth/mfa-enrollment";

const replace = vi.fn();
const startTotpEnrollment = vi.fn<() => Promise<TotpEnrollmentStartResult>>();
const completeTotpEnrollment =
  vi.fn<(secret: TotpSecret, code: string) => Promise<TotpEnrollmentResult>>();
const issueRecoveryCodes = vi.fn<() => Promise<MfaRecoveryIssueResult>>();
const downloadRecoveryCodes = vi.fn<(codes: string[], issuedAt: Date) => void>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/mfa-recovery", () => ({
  issueRecoveryCodes: () => issueRecoveryCodes(),
}));

// ダウンロードはブラウザのAPIに依るため、ここでは呼び出しだけを確認する
// (組み立てるファイルの内容は`src/lib/auth/recovery-code-file.test.ts`で検証する)
vi.mock("@/lib/auth/recovery-code-file", () => ({
  downloadRecoveryCodes: (codes: string[], issuedAt: Date) =>
    downloadRecoveryCodes(codes, issuedAt),
}));

vi.mock("@/lib/auth/mfa-enrollment", async () => {
  // 表示用の整形は実装をそのまま使い、Firebaseに触れる2つだけを差し替える
  const actual = await vi.importActual<typeof MfaEnrollmentModule>("@/lib/auth/mfa-enrollment");

  return {
    formatTotpSecretKey: actual.formatTotpSecretKey,
    startTotpEnrollment: () => startTotpEnrollment(),
    completeTotpEnrollment: (secret: TotpSecret, code: string) =>
      completeTotpEnrollment(secret, code),
  };
});

// QRコードはブラウザ専用ライブラリを`next/dynamic`で読み込むため、jsdomでは値だけを検証する
vi.mock("@/components/auth/TotpQrCode", () => ({
  TotpQrCode: ({ url }: TotpQrCodeProps) => <div data-testid="totp-qr-code">{url}</div>,
}));

const QR_CODE_URL = "otpauth://totp/FIRE-FIRE:user@example.com?secret=JBSWY3DPEHPK3PXP";

/** 画面はシークレットを保持して返すだけなので、テストでは必要な値のみ持つ替え玉で足りる */
const SECRET = { secretKey: "JBSWY3DPEHPK3PXP" } as TotpSecret;

const READY: TotpEnrollmentStartResult = { ok: true, secret: SECRET, qrCodeUrl: QR_CODE_URL };

const RECOVERY_CODES = [
  "7F2K-9QRT",
  "M3XZ-2LDS",
  "P8VC-4WYN",
  "K6HJ-3BGE",
  "T2UA-5NFM",
  "D9RS-2CXQ",
  "L4YB-8ZPK",
  "N7QW-6VHT",
];

const settle = (): Promise<void> => act(async () => {});

/** マウントし、QRコードの生成が反映されるまで進める */
const renderAndSettle = async (): Promise<void> => {
  render(<MfaSetupForm />);
  await settle();
};

const codeInput = (): HTMLElement =>
  screen.getByLabelText(`認証アプリの確認コード(${TOTP_CODE_LENGTH}桁)`);

const submitButton = (): HTMLElement => screen.getByRole("button", { name: "確認する" });

/** 確認コードを入力する。input-otpは1つのinputに全桁をまとめて持つ */
const enterCode = async (value: string): Promise<void> => {
  await act(async () => {
    fireEvent.change(codeInput(), { target: { value } });
  });
};

const clickSubmit = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(submitButton());
  });
};

describe("MfaSetupForm", () => {
  beforeEach(() => {
    replace.mockReset();
    startTotpEnrollment.mockReset();
    startTotpEnrollment.mockResolvedValue(READY);
    completeTotpEnrollment.mockReset();
    completeTotpEnrollment.mockResolvedValue({ ok: true });
    issueRecoveryCodes.mockReset();
    issueRecoveryCodes.mockResolvedValue({ ok: true, codes: RECOVERY_CODES });
    downloadRecoveryCodes.mockReset();
  });

  describe("表示項目", () => {
    it("QRコードと手動入力用シークレットキー、確認コード入力欄を表示する", async () => {
      await renderAndSettle();

      expect(
        screen.getByRole("heading", { level: 1, name: "2段階認証(2FA)を設定" }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("totp-qr-code")).toHaveTextContent(QR_CODE_URL);
      // 書き写しやすいよう4文字ごとに区切って表示する
      expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
      expect(codeInput()).toBeInTheDocument();
    });

    it("生成中は読み込み中の表示にする", async () => {
      startTotpEnrollment.mockReturnValue(new Promise<TotpEnrollmentStartResult>(() => {}));
      render(<MfaSetupForm />);
      await settle();

      expect(screen.getByRole("status")).toHaveTextContent("2段階認証の設定を準備しています...");
    });
  });

  describe("確認コードの検証", () => {
    it("6桁揃うまで「確認する」を押せない", async () => {
      await renderAndSettle();

      expect(submitButton()).toBeDisabled();

      await enterCode("12345");
      expect(submitButton()).toBeDisabled();

      await enterCode("123456");
      expect(submitButton()).toBeEnabled();
    });

    it("数字以外は入力できない", async () => {
      await renderAndSettle();

      await enterCode("abc123");

      expect(submitButton()).toBeDisabled();
    });

    it("検証成功で完了表示に切り替わり、B1への導線を出す", async () => {
      await renderAndSettle();

      await enterCode("123456");
      await clickSubmit();

      expect(completeTotpEnrollment).toHaveBeenCalledWith(SECRET, "123456");
      expect(
        screen.getByRole("heading", { level: 1, name: "2段階認証の設定が完了しました" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "保存しました。開始する" })).toHaveAttribute(
        "href",
        "/dashboard",
      );
      // 「開始する」を押すまでこの画面に留まる
      expect(replace).not.toHaveBeenCalled();
    });

    it("確認コードが誤りならエラーを出し、入力をやり直せる", async () => {
      completeTotpEnrollment.mockResolvedValue({
        ok: false,
        reason: "invalid-verification-code",
      });
      await renderAndSettle();

      await enterCode("123456");
      await clickSubmit();

      expect(screen.getByRole("alert")).toHaveTextContent("確認コードが正しくありません。");
      // 古いコードを押し直さないよう入力は消し、画面はそのまま残す
      expect(submitButton()).toBeDisabled();
      expect(screen.getByTestId("totp-qr-code")).toBeInTheDocument();
      // QRコードは有効なままなので、取り直す導線は出さない
      expect(
        screen.queryByRole("button", { name: "QRコードを再取得する" }),
      ).not.toBeInTheDocument();

      completeTotpEnrollment.mockResolvedValue({ ok: true });
      await enterCode("654321");
      await clickSubmit();

      expect(
        screen.getByRole("heading", { level: 1, name: "2段階認証の設定が完了しました" }),
      ).toBeInTheDocument();
    });

    it("検証中はボタンを無効化し、二重送信を防ぐ", async () => {
      let resolveEnrollment: ((result: TotpEnrollmentResult) => void) | undefined;
      completeTotpEnrollment.mockReturnValue(
        new Promise<TotpEnrollmentResult>((resolve) => {
          resolveEnrollment = resolve;
        }),
      );
      await renderAndSettle();

      await enterCode("123456");
      await clickSubmit();

      const submittingButton = screen.getByRole("button", { name: "確認中..." });
      expect(submittingButton).toBeDisabled();

      await act(async () => {
        fireEvent.click(submittingButton);
      });
      expect(completeTotpEnrollment).toHaveBeenCalledTimes(1);

      resolveEnrollment?.({ ok: true });
      await settle();

      expect(
        screen.getByRole("heading", { level: 1, name: "2段階認証の設定が完了しました" }),
      ).toBeInTheDocument();
    });

    it("確認コード誤り以外の失敗ではQRコードの再取得を促す", async () => {
      completeTotpEnrollment.mockResolvedValue({ ok: false, reason: "unknown" });
      await renderAndSettle();

      await enterCode("123456");
      await clickSubmit();

      expect(screen.getByRole("alert")).toHaveTextContent("設定の有効期限が切れている可能性がある");

      const retryButton = screen.getByRole("button", { name: "QRコードを再取得する" });
      await act(async () => {
        fireEvent.click(retryButton);
      });

      expect(startTotpEnrollment).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByRole("button", { name: "QRコードを再取得する" }),
      ).not.toBeInTheDocument();
    });

    it("再認証が必要なときはログイン画面へ誘導し、QRコードの再取得は勧めない", async () => {
      completeTotpEnrollment.mockResolvedValue({ ok: false, reason: "requires-recent-login" });
      await renderAndSettle();

      await enterCode("123456");
      await clickSubmit();

      expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute(
        "href",
        "/login",
      );
      // QRコードを取り直しても同じ結果になるため、この導線は出さない
      expect(
        screen.queryByRole("button", { name: "QRコードを再取得する" }),
      ).not.toBeInTheDocument();
    });

    it("検証時にセッションが失われていたらA1へ遷移する", async () => {
      completeTotpEnrollment.mockResolvedValue({ ok: false, reason: "signed-out" });
      await renderAndSettle();

      await enterCode("123456");
      await clickSubmit();

      expect(replace).toHaveBeenCalledWith("/signup");
    });

    it("既に登録済みだった場合も完了として扱う", async () => {
      completeTotpEnrollment.mockResolvedValue({ ok: false, reason: "already-enrolled" });
      await renderAndSettle();

      await enterCode("123456");
      await clickSubmit();

      expect(
        screen.getByRole("heading", { level: 1, name: "2段階認証の設定が完了しました" }),
      ).toBeInTheDocument();
    });
  });

  describe("リカバリーコードの発行", () => {
    /** 確認コードを検証して完了表示まで進める */
    const enrollAndSettle = async (): Promise<void> => {
      await renderAndSettle();
      await enterCode("123456");
      await clickSubmit();
    };

    it("検証成功後に発行したコード一覧を表示する", async () => {
      await enrollAndSettle();

      expect(issueRecoveryCodes).toHaveBeenCalledTimes(1);
      for (const code of RECOVERY_CODES) {
        expect(screen.getByText(code)).toBeInTheDocument();
      }
      // 平文が手に入るのはこの表示だけなので、その旨を伝える
      expect(screen.getByText(/この画面を離れると再表示できません/)).toBeInTheDocument();
    });

    it("発行中は読み込み中の表示にする", async () => {
      issueRecoveryCodes.mockReturnValue(new Promise<MfaRecoveryIssueResult>(() => {}));
      await enrollAndSettle();

      expect(screen.getByRole("status")).toHaveTextContent("リカバリーコードを発行しています...");
    });

    it("ダウンロードできる", async () => {
      await enrollAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "リカバリーコードをダウンロード" }));
      });

      expect(downloadRecoveryCodes).toHaveBeenCalledWith(RECOVERY_CODES, expect.any(Date));
    });

    // 2FA自体は有効になっているため、B1への導線は残したまま再発行を促す
    it("発行に失敗しても2FAは有効なことを伝え、再発行とB1への導線を出す", async () => {
      issueRecoveryCodes.mockResolvedValue({ ok: false, reason: "unavailable" });
      await enrollAndSettle();

      expect(
        screen.getByRole("heading", { level: 1, name: "2段階認証の設定が完了しました" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("ネットワーク接続を確認してください");
      expect(screen.getByText(/2段階認証の設定自体は完了しています/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "開始する" })).toHaveAttribute("href", "/dashboard");

      issueRecoveryCodes.mockResolvedValue({ ok: true, codes: RECOVERY_CODES });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "リカバリーコードを再発行する" }));
      });

      expect(issueRecoveryCodes).toHaveBeenCalledTimes(2);
      expect(screen.getByText(RECOVERY_CODES[0])).toBeInTheDocument();
    });

    it("発行時にセッションが失われていたらログイン画面へ遷移する", async () => {
      issueRecoveryCodes.mockResolvedValue({ ok: false, reason: "signed-out" });
      await enrollAndSettle();

      expect(replace).toHaveBeenCalledWith("/login");
    });
  });

  describe("前提を満たさない場合の遷移", () => {
    it("セッションが無ければA1へ遷移する", async () => {
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "signed-out" });
      await renderAndSettle();

      expect(replace).toHaveBeenCalledWith("/signup");
      expect(screen.queryByTestId("totp-qr-code")).not.toBeInTheDocument();
    });

    it("メールアドレスが未確認ならA2へ遷移する", async () => {
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "email-unverified" });
      await renderAndSettle();

      expect(replace).toHaveBeenCalledWith("/verify-email");
    });

    it("既に2FA登録済みならB1へ遷移する", async () => {
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "already-enrolled" });
      await renderAndSettle();

      expect(replace).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("QRコードを生成できない場合", () => {
    it("Firebaseに接続できないときはネットワーク接続の確認を促し、再取得できる", async () => {
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "network-error" });
      await renderAndSettle();

      expect(screen.getByRole("alert")).toHaveTextContent("ネットワーク接続を確認してください");

      startTotpEnrollment.mockResolvedValue(READY);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "QRコードを再取得する" }));
      });

      expect(screen.getByTestId("totp-qr-code")).toBeInTheDocument();
    });

    it("TOTPが有効化されていないときは有効化手順を表示する", async () => {
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "totp-not-enabled" });
      await renderAndSettle();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "2段階認証(TOTP)がプロジェクトで有効になっていません。",
      );
    });

    it("再認証が必要なときはログイン画面へ誘導する", async () => {
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "requires-recent-login" });
      await renderAndSettle();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "セキュリティのため、ログインし直してから2段階認証を設定してください。",
      );
      expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute(
        "href",
        "/login",
      );
      expect(
        screen.queryByRole("button", { name: "QRコードを再取得する" }),
      ).not.toBeInTheDocument();
    });

    it("先に開始した生成の遅い応答で、後から得た結果を巻き戻さない", async () => {
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "unknown" });
      await renderAndSettle();

      // 再取得を連打すると生成が2つ並行する。先に始めた方を保留させ、後の結果が先に確定させる
      let resolveEarlierRetry: ((result: TotpEnrollmentStartResult) => void) | undefined;
      startTotpEnrollment.mockReturnValueOnce(
        new Promise<TotpEnrollmentStartResult>((resolve) => {
          resolveEarlierRetry = resolve;
        }),
      );
      startTotpEnrollment.mockResolvedValue({ ok: false, reason: "network-error" });

      await act(async () => {
        const retryButton = screen.getByRole("button", { name: "QRコードを再取得する" });
        fireEvent.click(retryButton);
        fireEvent.click(retryButton);
      });

      expect(startTotpEnrollment).toHaveBeenCalledTimes(3);
      expect(screen.getByRole("alert")).toHaveTextContent("ネットワーク接続を確認してください");

      // 遅れて解決した古い応答は捨てる(新しく判明したエラー表示を消さない)
      resolveEarlierRetry?.(READY);
      await settle();

      expect(screen.getByRole("alert")).toHaveTextContent("ネットワーク接続を確認してください");
      expect(screen.queryByTestId("totp-qr-code")).not.toBeInTheDocument();
    });
  });
});

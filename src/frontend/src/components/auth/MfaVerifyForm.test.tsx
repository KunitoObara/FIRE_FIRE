import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MfaVerifyForm } from "@/components/auth/MfaVerifyForm";
import { TOTP_CODE_LENGTH } from "@/constants/auth";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/constants/routes";
import { clearPendingLogin, getPendingLogin, setPendingLogin } from "@/lib/auth/pending-login";

import type { MultiFactorResolver } from "firebase/auth";

const replace = vi.fn();
const verifyTotpForSignIn =
  vi.fn<(login: PendingLogin, code: string) => Promise<MfaVerificationResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/mfa-verification", () => ({
  verifyTotpForSignIn: (login: PendingLogin, code: string) => verifyTotpForSignIn(login, code),
}));

// 画面はresolverを検証関数へ渡すだけなので、テストでは替え玉で足りる
const resolver = {} as MultiFactorResolver;

const PENDING_LOGIN: PendingLogin = {
  resolver,
  email: "taro.yamada@example.com",
  rememberMe: true,
};

const settle = (): Promise<void> => act(async () => {});

const renderAndSettle = async (): Promise<void> => {
  render(<MfaVerifyForm />);
  await settle();
};

const codeInput = (): HTMLElement =>
  screen.getByLabelText(`認証アプリの確認コード(${TOTP_CODE_LENGTH}桁)`);

const submitButton = (): HTMLElement => screen.getByRole("button", { name: "検証する" });

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

/** 6桁を入力して「検証する」を押すまで */
const submitCode = async (code = "123456"): Promise<void> => {
  await enterCode(code);
  await clickSubmit();
};

describe("MfaVerifyForm", () => {
  beforeEach(() => {
    replace.mockReset();
    verifyTotpForSignIn.mockReset();
    verifyTotpForSignIn.mockResolvedValue({ ok: true });
    setPendingLogin({ ...PENDING_LOGIN });
  });

  describe("表示項目", () => {
    it("一次認証済みのメールアドレスと確認コード入力欄を表示する", async () => {
      await renderAndSettle();

      expect(screen.getByRole("heading", { level: 1, name: "2段階認証" })).toBeInTheDocument();
      expect(screen.getByText(`${PENDING_LOGIN.email} として一次認証済みです`)).toBeInTheDocument();
      expect(codeInput()).toBeInTheDocument();
    });

    // リカバリーコードはTrelloカード [A3-2] で扱うため、この画面には導線を置かない
    it("リカバリーコードへの切り替えは出さない", async () => {
      await renderAndSettle();

      expect(screen.queryByText(/リカバリーコード/)).not.toBeInTheDocument();
    });
  });

  describe("確認コードの検証", () => {
    it("6桁揃うまで「検証する」を押せない", async () => {
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

    it("検証待ちのログインと入力値を渡して検証する", async () => {
      await renderAndSettle();

      await submitCode();

      expect(verifyTotpForSignIn).toHaveBeenCalledWith(PENDING_LOGIN, "123456");
    });

    it("検証成功でダッシュボードへ進み、検証待ちを残さない", async () => {
      await renderAndSettle();

      await submitCode();

      expect(replace).toHaveBeenCalledWith(DASHBOARD_PATH);
      expect(getPendingLogin()).toBeNull();
    });

    it("検証中は再送信できない", async () => {
      verifyTotpForSignIn.mockReturnValue(new Promise<MfaVerificationResult>(() => {}));
      await renderAndSettle();

      await submitCode();

      expect(screen.getByRole("button", { name: "検証中..." })).toBeDisabled();
    });
  });

  describe("検証の失敗", () => {
    it("確認コードの誤りを伝え、入力をやり直せる", async () => {
      verifyTotpForSignIn.mockResolvedValue({
        ok: false,
        reason: "invalid-verification-code",
      });
      await renderAndSettle();

      await submitCode();

      expect(screen.getByRole("alert")).toHaveTextContent("確認コードが正しくありません。");
      expect(replace).not.toHaveBeenCalled();
      // 古いコードを送り直さないよう入力欄は空に戻す
      expect(codeInput()).toHaveValue("");
    });

    it("検証セッションが切れたときはログイン画面への導線を出す", async () => {
      verifyTotpForSignIn.mockResolvedValue({ ok: false, reason: "session-expired" });
      await renderAndSettle();

      await submitCode();

      expect(screen.getByRole("alert")).toHaveTextContent("検証の有効期限が切れました。");
      expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute(
        "href",
        LOGIN_PATH,
      );
    });

    it("入力し直しで解消しうる失敗ではログイン画面への導線を出さない", async () => {
      verifyTotpForSignIn.mockResolvedValue({ ok: false, reason: "unknown" });
      await renderAndSettle();

      await submitCode();

      expect(screen.queryByRole("link", { name: "ログイン画面へ" })).not.toBeInTheDocument();
    });
  });

  describe("検証待ちのログインが無いとき", () => {
    beforeEach(() => {
      clearPendingLogin();
    });

    it("ログイン画面へ戻す", async () => {
      await renderAndSettle();

      expect(replace).toHaveBeenCalledWith(LOGIN_PATH);
      expect(screen.getByRole("status")).toHaveTextContent("ログイン画面に戻ります...");
    });
  });
});

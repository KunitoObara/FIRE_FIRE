import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MfaVerifyForm } from "@/components/auth/MfaVerifyForm";
import { TOTP_CODE_LENGTH } from "@/constants/auth";
import { DASHBOARD_PATH, LOGIN_PATH, MFA_SETUP_PATH } from "@/constants/routes";
import { clearPendingLogin, getPendingLogin, setPendingLogin } from "@/lib/auth/pending-login";

import type { MultiFactorResolver } from "firebase/auth";

const replace = vi.fn();
const verifyTotpForSignIn =
  vi.fn<(login: PendingLogin, code: string) => Promise<MfaVerificationResult>>();
const redeemRecoveryCode =
  vi.fn<(email: string, password: string, code: string) => Promise<MfaRecoveryUseResult>>();
const signInWithEmail =
  vi.fn<(email: string, password: string, rememberMe: boolean) => Promise<SignInResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/mfa-verification", () => ({
  verifyTotpForSignIn: (login: PendingLogin, code: string) => verifyTotpForSignIn(login, code),
}));

vi.mock("@/lib/auth/mfa-recovery", () => ({
  redeemRecoveryCode: (email: string, password: string, code: string) =>
    redeemRecoveryCode(email, password, code),
}));

vi.mock("@/lib/auth/sign-in", () => ({
  signInWithEmail: (email: string, password: string, rememberMe: boolean) =>
    signInWithEmail(email, password, rememberMe),
}));

// 画面はresolverを検証関数へ渡すだけなので、テストでは替え玉で足りる
const resolver = {} as MultiFactorResolver;

const PENDING_LOGIN: PendingLogin = {
  resolver,
  email: "taro.yamada@example.com",
  password: "Passw0rd!",
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

const recoveryCodeInput = (): HTMLElement => screen.getByLabelText("リカバリーコード");

/** リカバリーコード入力へ切り替えてコードを入力し、「検証する」を押すまで */
const submitRecoveryCode = async (code = "7F2K-9QRT"): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "リカバリーコードを使う" }));
  });
  await act(async () => {
    fireEvent.change(recoveryCodeInput(), { target: { value: code } });
  });
  await clickSubmit();
};

describe("MfaVerifyForm", () => {
  beforeEach(() => {
    replace.mockReset();
    verifyTotpForSignIn.mockReset();
    verifyTotpForSignIn.mockResolvedValue({ ok: true });
    redeemRecoveryCode.mockReset();
    redeemRecoveryCode.mockResolvedValue({ ok: true, remainingCodes: 7 });
    signInWithEmail.mockReset();
    // 2FA解除後のログインは、2FA未登録として扱われA3へ進む
    signInWithEmail.mockResolvedValue({ ok: true, next: "mfa-setup" });
    setPendingLogin({ ...PENDING_LOGIN });
  });

  describe("表示項目", () => {
    it("一次認証済みのメールアドレスと確認コード入力欄を表示する", async () => {
      await renderAndSettle();

      expect(screen.getByRole("heading", { level: 1, name: "2段階認証" })).toBeInTheDocument();
      expect(screen.getByText(`${PENDING_LOGIN.email} として一次認証済みです`)).toBeInTheDocument();
      expect(codeInput()).toBeInTheDocument();
    });

    it("リカバリーコードへの切り替え導線を出す", async () => {
      await renderAndSettle();

      expect(screen.getByRole("button", { name: "リカバリーコードを使う" })).toBeInTheDocument();
    });

    // 検証はサーバー側でパスワードによる一次認証の再確認を伴うため、
    // パスワードを持たないログイン(Googleログイン経由)では成立しない
    it("パスワードを引き継いでいないログインでは切り替え導線を出さない", async () => {
      setPendingLogin({ ...PENDING_LOGIN, password: undefined });

      await renderAndSettle();

      expect(
        screen.queryByRole("button", { name: "リカバリーコードを使う" }),
      ).not.toBeInTheDocument();
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

    // 同じresolverでは何度送り直してもsession-expiredになるため、再試行させない
    it("検証セッションが切れたときは確認コードの入力と「検証する」を無効化する", async () => {
      verifyTotpForSignIn.mockResolvedValue({ ok: false, reason: "session-expired" });
      await renderAndSettle();

      await submitCode();

      expect(codeInput()).toBeDisabled();
      expect(submitButton()).toBeDisabled();

      // 無効化されていても送信経路が残っていないことまで確かめる
      await enterCode("123456");
      await clickSubmit();

      expect(verifyTotpForSignIn).toHaveBeenCalledTimes(1);
    });

    // リカバリーコードの検証はresolverを使わずメール・パスワードで解除するため、期限切れでも成立する
    it("検証セッションが切れてもリカバリーコードへの切り替えは残す", async () => {
      verifyTotpForSignIn.mockResolvedValue({ ok: false, reason: "session-expired" });
      await renderAndSettle();

      await submitCode();

      const switchButton = screen.getByRole("button", { name: "リカバリーコードを使う" });
      expect(switchButton).toBeEnabled();

      await act(async () => {
        fireEvent.click(switchButton);
      });

      expect(recoveryCodeInput()).toBeEnabled();
    });

    // 切り替えでは検証セッションは戻らない。無効化が解けると無駄な再試行に戻ってしまう
    it("リカバリーコードから戻っても期限切れの無効化を解かない", async () => {
      verifyTotpForSignIn.mockResolvedValue({ ok: false, reason: "session-expired" });
      await renderAndSettle();

      await submitCode();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "リカバリーコードを使う" }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "認証アプリのコードに戻る" }));
      });

      expect(codeInput()).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent("検証の有効期限が切れました。");
      expect(screen.getByRole("link", { name: "ログイン画面へ" })).toBeInTheDocument();
    });

    // 入力し直しで解消しうる失敗まで止めると、その場でのやり直しができなくなる
    it("期限切れ以外の失敗では入力を無効化しない", async () => {
      verifyTotpForSignIn.mockResolvedValue({
        ok: false,
        reason: "invalid-verification-code",
      });
      await renderAndSettle();

      await submitCode();

      expect(codeInput()).toBeEnabled();

      await enterCode("123456");
      expect(submitButton()).toBeEnabled();
    });

    it("入力し直しで解消しうる失敗ではログイン画面への導線を出さない", async () => {
      verifyTotpForSignIn.mockResolvedValue({ ok: false, reason: "unknown" });
      await renderAndSettle();

      await submitCode();

      expect(screen.queryByRole("link", { name: "ログイン画面へ" })).not.toBeInTheDocument();
    });
  });

  describe("リカバリーコードでの検証", () => {
    it("切り替えるとリカバリーコードの入力欄と注意書きを出す", async () => {
      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "リカバリーコードを使う" }));
      });

      expect(recoveryCodeInput()).toBeInTheDocument();
      expect(
        screen.getByText(/各リカバリーコードは一度使用すると無効になります/),
      ).toBeInTheDocument();
      // 確認コードの入力へ戻れる
      expect(screen.getByRole("button", { name: "認証アプリのコードに戻る" })).toBeInTheDocument();
    });

    it("未入力では「検証する」を押せない", async () => {
      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "リカバリーコードを使う" }));
      });

      expect(submitButton()).toBeDisabled();
    });

    it("A4から引き継いだメールアドレスとパスワードを添えて検証する", async () => {
      await renderAndSettle();

      await submitRecoveryCode();

      expect(redeemRecoveryCode).toHaveBeenCalledWith(
        PENDING_LOGIN.email,
        PENDING_LOGIN.password,
        "7F2K-9QRT",
      );
    });

    // 2FAは解除されるため、そのままB1へは進めず認証アプリの再登録(A3)へ送る
    it("検証成功後はログインをやり直してA3へ進む", async () => {
      await renderAndSettle();

      await submitRecoveryCode();

      expect(signInWithEmail).toHaveBeenCalledWith(
        PENDING_LOGIN.email,
        PENDING_LOGIN.password,
        PENDING_LOGIN.rememberMe,
      );
      expect(replace).toHaveBeenCalledWith(MFA_SETUP_PATH);
    });

    it("コードの誤りを伝え、入力をやり直せる", async () => {
      redeemRecoveryCode.mockResolvedValue({ ok: false, reason: "invalid-recovery-code" });
      await renderAndSettle();

      await submitRecoveryCode();

      expect(screen.getByRole("alert")).toHaveTextContent("リカバリーコードが正しくありません。");
      expect(signInWithEmail).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(recoveryCodeInput()).toHaveValue("");
    });

    // 入力したコードは消費済みで戻らないため、同じコードでの再試行を促さない
    it("解除に失敗したときはコードが使用済みになったことを伝え、別のコードを促す", async () => {
      redeemRecoveryCode.mockResolvedValue({ ok: false, reason: "unenroll-failed" });
      await renderAndSettle();

      await submitRecoveryCode();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "入力したリカバリーコードは使用済みになりましたが、2段階認証を解除できませんでした。",
      );
      expect(screen.getByRole("alert")).toHaveTextContent("別のリカバリーコードで");
      // 入力欄はA5に残り、別のコードで試し直せる
      expect(recoveryCodeInput()).toHaveValue("");
      expect(signInWithEmail).not.toHaveBeenCalled();
    });

    it("使えるコードが無いことを伝える", async () => {
      redeemRecoveryCode.mockResolvedValue({ ok: false, reason: "no-recovery-codes" });
      await renderAndSettle();

      await submitRecoveryCode();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "利用できるリカバリーコードがありません。",
      );
    });

    // 解除は済んでいるため、ログイン画面からやり直せばA3の再登録へ進める
    it("解除後のログインに失敗したときはログイン画面へ案内する", async () => {
      signInWithEmail.mockResolvedValue({ ok: false, reason: "network-error" });
      await renderAndSettle();

      await submitRecoveryCode();

      expect(screen.getByRole("alert")).toHaveTextContent("2段階認証を解除しました。");
      expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute(
        "href",
        LOGIN_PATH,
      );
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe("検証待ちのログインが無いとき", () => {
    beforeEach(() => {
      clearPendingLogin();
    });

    it("ログイン画面へ戻す", async () => {
      await renderAndSettle();

      expect(replace).toHaveBeenCalledWith(LOGIN_PATH);
      // 失敗ではなく検証セッションが無いだけなので、やり直しの手順だけを伝える
      expect(screen.getByRole("status")).toHaveTextContent(
        "ログインからやり直してください。ログイン画面に戻ります...",
      );
    });
  });
});

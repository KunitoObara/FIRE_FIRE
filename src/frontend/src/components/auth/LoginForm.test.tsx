import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/LoginForm";

import type { UserEvent } from "@testing-library/user-event";

import type * as LogoutNoticeModule from "@/lib/auth/logout-notice";

const replace = vi.fn();
const signInWithEmail =
  vi.fn<(email: string, password: string, rememberMe: boolean) => Promise<SignInResult>>();
const signInWithGoogle = vi.fn<(rememberMe: boolean) => Promise<GoogleSignInResult>>();
const wasLoggedOut = vi.fn<() => boolean>();
const clearLoggedOutNotice = vi.fn<() => void>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/sign-in", () => ({
  signInWithEmail: (email: string, password: string, rememberMe: boolean) =>
    signInWithEmail(email, password, rememberMe),
}));

vi.mock("@/lib/auth/google-sign-in", () => ({
  signInWithGoogle: (rememberMe: boolean) => signInWithGoogle(rememberMe),
}));

// `markLoggedOut`は実物のまま残す。Strict Modeの回帰テストは実物の`markLoggedOut`で
// フラグを立て、`wasLoggedOut`/`clearLoggedOutNotice`もその場だけ実物に差し替えて使う
vi.mock("@/lib/auth/logout-notice", async (importOriginal) => ({
  ...(await importOriginal<typeof LogoutNoticeModule>()),
  wasLoggedOut: () => wasLoggedOut(),
  clearLoggedOutNotice: () => clearLoggedOutNotice(),
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
    signInWithGoogle.mockReset();
    signInWithGoogle.mockResolvedValue({ ok: true, next: "mfa-setup" });
    wasLoggedOut.mockReset();
    wasLoggedOut.mockReturnValue(false);
    clearLoggedOutNotice.mockReset();
  });

  describe("「ログアウトしました」の表示(docs/screen-requirements-auth.md A4)", () => {
    it("ログアウト直後は表示する", () => {
      wasLoggedOut.mockReturnValue(true);
      render(<LoginForm />);

      expect(screen.getByRole("status")).toHaveTextContent("ログアウトしました。");
    });

    it("表示後は消費して、以降の再訪問では出さない", () => {
      wasLoggedOut.mockReturnValue(true);
      render(<LoginForm />);

      expect(clearLoggedOutNotice).toHaveBeenCalledTimes(1);
    });

    it("ガードによる差し戻しやセッション期限切れ等の通常表示では出さない", () => {
      render(<LoginForm />);

      expect(screen.queryByText("ログアウトしました。")).not.toBeInTheDocument();
      expect(clearLoggedOutNotice).not.toHaveBeenCalled();
    });

    /**
     * `wasLoggedOut`(読み出し)と`clearLoggedOutNotice`(消費)を分けている理由そのものの回帰確認。
     *
     * 両者を1つの自己消費する関数にまとめて`useState`のレイジー初期化子に渡すと、
     * React Strict Modeは初期化関数を2回呼ぶため(1回目の結果は破棄され、2回目の戻り値が
     * コミットされる仕様)、1回目の呼び出しでフラグが消費され、2回目は必ずfalseを返してしまう
     * (`src/lib/auth/logout-notice.ts`)。実物のモジュールを使い、Strict Modeで再現して
     * 防げていることを確かめる。
     */
    it("Strict Modeでレイジー初期化子が2回呼ばれても表示する(回帰確認)", async () => {
      const actual = await vi.importActual<typeof LogoutNoticeModule>("@/lib/auth/logout-notice");
      wasLoggedOut.mockImplementation(actual.wasLoggedOut);
      clearLoggedOutNotice.mockImplementation(actual.clearLoggedOutNotice);
      actual.markLoggedOut();

      render(
        <StrictMode>
          <LoginForm />
        </StrictMode>,
      );

      expect(screen.getByRole("status")).toHaveTextContent("ログアウトしました。");
    });
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

  describe("Googleで続ける(docs/screen-requirements-auth.md 2章)", () => {
    it("メール/パスワードのフォームとは別に導線を出す", () => {
      render(<LoginForm />);

      expect(screen.getByRole("button", { name: "Googleで続ける" })).toBeEnabled();
    });

    // 2FAありのログインでセッションが作られるのはA5だが、選択自体はこの画面で引き継ぐ
    it("「ログイン状態を保持する」の選択を引き継ぐ", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.click(screen.getByRole("checkbox", { name: "ログイン状態を保持する" }));
      await user.click(screen.getByRole("button", { name: "Googleで続ける" }));

      await waitFor(() => {
        expect(signInWithGoogle).toHaveBeenCalledWith(false);
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

    it("接続不可のときはネットワーク接続の確認を促す", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: false, reason: "network-error" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      expect(await screen.findByText(/ネットワーク接続を確認してください/)).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("レート制限のときは待てば解消することを伝える", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: false, reason: "too-many-requests" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      expect(
        await screen.findByText(
          "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
        ),
      ).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("Firebaseの設定不足のときは設定手順を促す", async () => {
      const user = userEvent.setup();
      signInWithEmail.mockResolvedValue({ ok: false, reason: "configuration-error" });
      render(<LoginForm />);

      await fillValidForm(user);
      await submit(user);

      expect(await screen.findByText(/\.env\.local/)).toBeInTheDocument();
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

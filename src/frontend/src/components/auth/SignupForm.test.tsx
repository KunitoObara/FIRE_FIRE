import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignupForm } from "@/components/auth/SignupForm";

import type { UserEvent } from "@testing-library/user-event";

const push = vi.fn();
const signUpWithEmail = vi.fn<(email: string, password: string) => Promise<SignUpResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth/sign-up", () => ({
  signUpWithEmail: (email: string, password: string) => signUpWithEmail(email, password),
}));

const VALID_PASSWORD = "Passw0rd!";

/** 全項目に有効な値を入力する。差し替えたい項目だけ引数で上書きする */
const fillValidForm = async (
  user: UserEvent,
  overrides: { email?: string; password?: string; passwordConfirmation?: string } = {},
): Promise<void> => {
  await user.type(screen.getByLabelText("メールアドレス"), overrides.email ?? "user@example.com");
  await user.type(screen.getByLabelText("パスワード"), overrides.password ?? VALID_PASSWORD);
  await user.type(
    screen.getByLabelText("パスワード(確認用)"),
    overrides.passwordConfirmation ?? VALID_PASSWORD,
  );
  await user.click(screen.getByRole("checkbox"));
};

const submit = (user: UserEvent): Promise<void> =>
  user.click(screen.getByRole("button", { name: "アカウント作成" }));

/** 「アカウント作成」を押して確認モーダルが開くまで待つ */
const submitAndAwaitConfirmation = async (user: UserEvent): Promise<void> => {
  await submit(user);
  await screen.findByRole("alertdialog");
};

/** パスワード欄・確認用欄の表示トグル(この順) */
const passwordToggles = (): HTMLElement[] =>
  screen.getAllByRole("button", { name: "パスワードを表示" });

/** パスワード条件リストのうち、充足済みとして表示されている条件名 */
const satisfiedRuleLabels = (): string[] =>
  screen
    .getAllByRole("listitem")
    .filter((item) => item.dataset.satisfied === "true")
    .map((item) => item.textContent?.replace("条件を満たしています", "") ?? "");

describe("SignupForm", () => {
  beforeEach(() => {
    push.mockReset();
    signUpWithEmail.mockReset();
    signUpWithEmail.mockResolvedValue({ ok: true });
  });

  it("画面タイトルとログイン画面への導線を表示する", () => {
    render(<SignupForm />);

    expect(screen.getByRole("heading", { level: 1, name: "アカウントを作成" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログインはこちら" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "利用規約" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toBeInTheDocument();
  });

  describe("パスワードの表示/非表示トグル", () => {
    it("初期状態では入力値を隠す", () => {
      render(<SignupForm />);

      expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "password");
      expect(screen.getByLabelText("パスワード(確認用)")).toHaveAttribute("type", "password");
      // 状態は aria-pressed のみで伝え、ラベルは切り替えない
      expect(passwordToggles()[0]).toHaveAttribute("aria-pressed", "false");
    });

    it("トグル押下でパスワード欄を平文表示し、再押下で戻す", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const [toggle] = passwordToggles();
      await user.click(toggle);

      expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "text");
      expect(passwordToggles()[0]).toHaveAttribute("aria-pressed", "true");

      await user.click(passwordToggles()[0]);

      expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "password");
      expect(passwordToggles()[0]).toHaveAttribute("aria-pressed", "false");
    });

    it("パスワード欄と確認用欄のトグルは互いに独立している", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const [, confirmationToggle] = passwordToggles();
      await user.click(confirmationToggle);

      expect(screen.getByLabelText("パスワード(確認用)")).toHaveAttribute("type", "text");
      expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "password");
    });
  });

  describe("パスワードポリシーのリアルタイム表示", () => {
    it("入力前はどの条件も未充足として表示する", () => {
      render(<SignupForm />);

      expect(satisfiedRuleLabels()).toEqual([]);
    });

    it("入力に応じて充足した条件だけを充足済みにする", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await user.type(screen.getByLabelText("パスワード"), "passw0rd");

      expect(satisfiedRuleLabels()).toEqual(["8文字以上", "数字を含む"]);

      await user.type(screen.getByLabelText("パスワード"), "A!");

      expect(satisfiedRuleLabels()).toEqual([
        "8文字以上",
        "大文字・小文字を含む",
        "数字を含む",
        "記号を含む",
      ]);
    });
  });

  describe("バリデーションエラー", () => {
    it("メール形式が不正なときはインラインエラーを表示し、モーダルを開かない", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user, { email: "user@example" });
      await submit(user);

      expect(await screen.findByText("メールアドレスの形式が正しくありません")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(signUpWithEmail).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("パスワードポリシー違反のときはインラインエラーを表示し、モーダルを開かない", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user, { password: "passw0rd", passwordConfirmation: "passw0rd" });
      await submit(user);

      expect(
        await screen.findByText("大文字と小文字をそれぞれ1文字以上含めてください"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(signUpWithEmail).not.toHaveBeenCalled();
    });

    it("パスワードが一致しないときはインラインエラーを表示し、モーダルを開かない", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user, { passwordConfirmation: `${VALID_PASSWORD}x` });
      await submit(user);

      expect(await screen.findByText("パスワードが一致しません")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(signUpWithEmail).not.toHaveBeenCalled();
    });

    it("規約に同意していないときはインラインエラーを表示し、モーダルを開かない", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user);
      // 同意チェックを外して未同意状態に戻す
      await user.click(screen.getByRole("checkbox"));
      await submit(user);

      expect(
        await screen.findByText("利用規約とプライバシーポリシーに同意してください"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(signUpWithEmail).not.toHaveBeenCalled();
    });
  });

  describe("確認モーダル", () => {
    it("バリデーション通過時に入力内容を確認するモーダルを開き、まだ作成しない", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);

      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toHaveTextContent("user@example.com");
      expect(dialog).toHaveTextContent("以上の内容でアカウント作成します");
      expect(signUpWithEmail).not.toHaveBeenCalled();
    });

    it("パスワードは平文ではなくマスクして表示する", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);

      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toHaveTextContent("********");
      expect(dialog).not.toHaveTextContent(VALID_PASSWORD);
    });

    it("「もどる」でモーダルを閉じ、アカウントを作成しない", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "もどる" }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(signUpWithEmail).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("「もどる」で閉じた後、再度送信すればモーダルを開き直せる", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "もどる" }));
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });

      await submitAndAwaitConfirmation(user);

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });

  describe("アカウント作成", () => {
    it("「はい」でサインアップを実行し、A2へ遷移する", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      await waitFor(() => {
        expect(signUpWithEmail).toHaveBeenCalledWith("user@example.com", VALID_PASSWORD);
      });
      expect(push).toHaveBeenCalledWith("/verify-email");
    });

    it("メールアドレスが重複しているときはメール欄にエラーを表示し、遷移しない", async () => {
      const user = userEvent.setup();
      signUpWithEmail.mockResolvedValue({ ok: false, reason: "email-already-in-use" });
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      expect(
        await screen.findByText("このメールアドレスは既に登録されています"),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("サーバー側のパスワードポリシー違反はパスワード欄にエラーを表示する", async () => {
      const user = userEvent.setup();
      signUpWithEmail.mockResolvedValue({ ok: false, reason: "password-policy-violation" });
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      expect(
        await screen.findByText("パスワードがパスワードポリシーを満たしていません"),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("原因不明の失敗はフォーム全体のエラーとして表示する", async () => {
      const user = userEvent.setup();
      signUpWithEmail.mockResolvedValue({ ok: false, reason: "unknown" });
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      expect(
        await screen.findByText(
          "アカウントを作成できませんでした。しばらく待ってから再度お試しください。",
        ),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("レート制限はフォーム全体のエラーとして表示する", async () => {
      const user = userEvent.setup();
      signUpWithEmail.mockResolvedValue({ ok: false, reason: "too-many-requests" });
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      expect(
        await screen.findByText(
          "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
        ),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("Firebaseに接続できないときはネットワーク接続の確認を促すエラーを表示する", async () => {
      const user = userEvent.setup();
      signUpWithEmail.mockResolvedValue({ ok: false, reason: "network-error" });
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      expect(await screen.findByText(/ネットワーク接続を確認してください/)).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("Firebase未設定はフォーム全体のエラーとして対処法を表示する", async () => {
      const user = userEvent.setup();
      signUpWithEmail.mockResolvedValue({ ok: false, reason: "configuration-error" });
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      expect(
        await screen.findByText(
          "Firebaseの設定が完了していません。.env.example をコピーして .env.local を作成し、設定値を記入してください。",
        ),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("作成中は送信ボタンを無効化し、二重送信を防ぐ", async () => {
      const user = userEvent.setup();
      // 作成中の状態を観測できるよう、テスト側で解決タイミングを制御する
      let resolveSignUp: ((result: SignUpResult) => void) | undefined;
      signUpWithEmail.mockReturnValue(
        new Promise<SignUpResult>((resolve) => {
          resolveSignUp = resolve;
        }),
      );
      render(<SignupForm />);

      await fillValidForm(user);
      await submitAndAwaitConfirmation(user);
      await user.click(screen.getByRole("button", { name: "はい" }));

      const submitButton = await screen.findByRole("button", { name: "作成中..." });
      expect(submitButton).toBeDisabled();

      await user.click(submitButton);
      expect(signUpWithEmail).toHaveBeenCalledTimes(1);

      resolveSignUp?.({ ok: true });
      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/verify-email");
      });
    });

    it("メールアドレスの前後の空白を除いて送信する", async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await fillValidForm(user, { email: "  user@example.com  " });
      await submitAndAwaitConfirmation(user);

      // 確認モーダルにも空白を除いた値を表示する
      expect(screen.getByRole("alertdialog")).toHaveTextContent("user@example.com");

      await user.click(screen.getByRole("button", { name: "はい" }));

      await waitFor(() => {
        expect(signUpWithEmail).toHaveBeenCalledWith("user@example.com", VALID_PASSWORD);
      });
    });
  });
});

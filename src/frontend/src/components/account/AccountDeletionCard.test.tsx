import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionCard } from "@/components/account/AccountDeletionCard";
import { markLoggedOut, wasLoggedOut } from "@/lib/auth/logout-notice";

const replace = vi.fn();
const deleteAccount = vi.fn<(password: string, confirmEmail: string) => Promise<unknown>>();
const performSignOut = vi.fn<(clearQueryCache?: () => void) => Promise<unknown>>();
const refreshPasswordProviderState = vi.fn<() => Promise<boolean>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/account-deletion", () => ({
  deleteAccount: (password: string, confirmEmail: string) => deleteAccount(password, confirmEmail),
}));

vi.mock("@/lib/auth/sign-out", () => ({
  performSignOut: (clearQueryCache?: () => void) => performSignOut(clearQueryCache),
}));

vi.mock("@/lib/auth/linked-providers", () => ({
  refreshPasswordProviderState: () => refreshPasswordProviderState(),
}));

/** このカードは(dashboard)シェルの内側にあり、`QueryClientProvider`配下で動く */
const renderCard = (props: AccountDeletionCardProps): ReturnType<typeof render> =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AccountDeletionCard {...props} />
    </QueryClientProvider>,
  );

const openDialog = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole("button", { name: "アカウントを削除する" }));
};

const fillAndSubmit = async (
  user: ReturnType<typeof userEvent.setup>,
  { email, password }: { email: string; password: string },
): Promise<void> => {
  await user.type(screen.getByLabelText("登録メールアドレス"), email);
  await user.type(screen.getByLabelText("パスワード"), password);
  await user.click(screen.getByRole("button", { name: "完全に削除する" }));
};

describe("AccountDeletionCard(docs/auth-login-requirements.md 3.11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteAccount.mockResolvedValue({ ok: true });
    performSignOut.mockResolvedValue({ ok: true });
    refreshPasswordProviderState.mockResolvedValue(true);
  });

  it("登録メールアドレスとパスワードを渡して削除する", async () => {
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await fillAndSubmit(user, { email: "user@example.com", password: "correct" });

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledWith("correct", "user@example.com");
    });
  });

  /** 削除するとセッションが無効になるため、戻ってもガードがログイン画面へ送るだけになる */
  it("成功したらA0へ履歴を置き換えて遷移する", async () => {
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await fillAndSubmit(user, { email: "user@example.com", password: "correct" });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  /**
   * 削除が済んでもクライアントSDKはユーザーを保持したままで、IDトークンの更新が失敗すると
   * ガードがA4へ送る。行き先をA0に定めるため、遷移の前にサインアウトする。
   */
  it("遷移の前にサインアウトし、取得キャッシュも捨てる", async () => {
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await fillAndSubmit(user, { email: "user@example.com", password: "correct" });

    await waitFor(() => {
      expect(performSignOut).toHaveBeenCalledOnce();
    });
    expect(performSignOut.mock.calls[0]?.[0]).toBeTypeOf("function");
  });

  /** 削除はログアウトではない。A4で「ログアウトしました」を出す筋合いが無い */
  it("ログアウトの通知フラグは残さない", async () => {
    markLoggedOut();
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await fillAndSubmit(user, { email: "user@example.com", password: "correct" });

    await waitFor(() => {
      expect(wasLoggedOut()).toBe(false);
    });
  });

  /** アカウントは既に消えている。サインアウトに失敗しても遷移だけは行う */
  it("サインアウトに失敗してもA0へ遷移する", async () => {
    performSignOut.mockResolvedValue({ ok: false, reason: "network-error" });
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await fillAndSubmit(user, { email: "user@example.com", password: "correct" });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  /** 失敗はダイアログを閉じずにその場で出す。入力し直せるようにするため */
  it("失敗したら理由に応じたメッセージを出し、遷移しない", async () => {
    deleteAccount.mockResolvedValue({ ok: false, reason: "email-mismatch" });
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await fillAndSubmit(user, { email: "other@example.com", password: "correct" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "登録メールアドレスと一致しません。",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  /**
   * データだけ消えた状態は、やり直しが要ることを伝えないと「消えたのか残ったのか分からない」
   * (docs/auth-login-requirements.md 3.11)。
   */
  it("データだけ消えた場合はやり直しが要ることを伝える", async () => {
    deleteAccount.mockResolvedValue({ ok: false, reason: "account-deletion-failed" });
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await fillAndSubmit(user, { email: "user@example.com", password: "correct" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "データは削除しましたが、アカウントを削除できませんでした。",
    );
  });

  /**
   * 渡された`canDelete`は画面を描いた時点の値でしかない。同じ画面の「ログイン方法」から
   * パスワード連携を解除しても再描画されないため、開く直前に取り直す。
   */
  it("開く直前にパスワード連携の有無を取り直す", async () => {
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);

    expect(refreshPasswordProviderState).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("登録メールアドレス")).toBeInTheDocument();
  });

  /** 入力させてから断らない。開かずに理由だけを出す */
  it("開く時点でパスワード連携が消えていればダイアログを開かない", async () => {
    refreshPasswordProviderState.mockResolvedValue(false);
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);

    expect(screen.queryByLabelText("登録メールアドレス")).not.toBeInTheDocument();
    expect(
      screen.getByText(/パスワードでのログインを設定していないアカウントは/),
    ).toBeInTheDocument();
  });

  it("未入力のまま実行しようとすると削除しない", async () => {
    const user = userEvent.setup();
    renderCard({ email: "user@example.com", canDelete: true });

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "完全に削除する" }));

    expect(await screen.findByText("登録メールアドレスを入力してください")).toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  /**
   * 本人確認をパスワードで行う以上この画面からは削除できない(3.3の他の操作と同じ制約)。
   * 押せてしまうと、入力しきってから断られることになる。
   */
  it("パスワードでのログインが無ければボタンを無効化し、理由と代わりの手段を出す", () => {
    renderCard({ email: "user@example.com", canDelete: false });

    expect(screen.getByRole("button", { name: "アカウントを削除する" })).toBeDisabled();
    expect(
      screen.getByText(/パスワードでのログインを設定していないアカウントは/),
    ).toBeInTheDocument();
  });

  it("削除できる場合は理由の注記を出さない", () => {
    renderCard({ email: "user@example.com", canDelete: true });

    expect(
      screen.queryByText(/パスワードでのログインを設定していないアカウントは/),
    ).not.toBeInTheDocument();
  });
});

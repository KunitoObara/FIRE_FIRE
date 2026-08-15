import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "@/components/public/ContactForm";
import { CONTACT_FAILURE_MESSAGES, CONTACT_SENT_MESSAGE } from "@/constants/public";

const sendContactMessage = vi.fn<(values: ContactFormValues) => Promise<ContactResult>>();

vi.mock("@/lib/contact/send-contact-message", () => ({
  sendContactMessage: (values: ContactFormValues) => sendContactMessage(values),
}));

const fillAndSubmit = async (
  user: ReturnType<typeof userEvent.setup>,
  body = "資産推移グラフの表示について質問があります。",
): Promise<void> => {
  await user.type(screen.getByLabelText("メールアドレス"), "taro.yamada@example.com");
  await user.type(screen.getByLabelText("お問い合わせ内容"), body);
  await user.click(screen.getByRole("button", { name: "送信する" }));
};

describe("ContactForm(docs/screen-requirements-public.md A11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendContactMessage.mockResolvedValue({ ok: true });
  });

  it("入力した内容を送信する", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(sendContactMessage).toHaveBeenCalledWith({
        email: "taro.yamada@example.com",
        body: "資産推移グラフの表示について質問があります。",
        website: "",
      });
    });
  });

  /** 未ログインの利用者に次の行き先が無いため、遷移せずこの場で結果を出す */
  it("送信できたら完了メッセージを出し、入力欄を空に戻す", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillAndSubmit(user);

    expect(await screen.findByText(CONTACT_SENT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText("メールアドレス")).toHaveValue("");
    expect(screen.getByLabelText("お問い合わせ内容")).toHaveValue("");
  });

  /** 送れなかった内容を消すと、書き直しを強いることになる */
  it("送信できなかったら理由を出し、入力内容を残す", async () => {
    sendContactMessage.mockResolvedValue({ ok: false, reason: "throttled" });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillAndSubmit(user);

    expect(await screen.findByText(CONTACT_FAILURE_MESSAGES.throttled)).toBeInTheDocument();
    expect(screen.getByLabelText("お問い合わせ内容")).toHaveValue(
      "資産推移グラフの表示について質問があります。",
    );
    expect(screen.queryByText(CONTACT_SENT_MESSAGE)).not.toBeInTheDocument();
  });

  /**
   * 送信中の無効化を外すとこのテストは落ちる(切り分け済み)。**Enterによる暗黙の送信も
   * 同時に塞いでいる** — 既定のsubmitボタンが無効な間は暗黙の送信が起こらない(HTML標準)。
   * 2通届くと、2通目はサーバー側の送信間隔制限で`throttled`になり、1通目は送れているのに
   * 失敗したように見える。
   */
  it("送信中にもう一度送信しても2通目を送らない", async () => {
    let resolveSend: (result: ContactResult) => void = () => {};
    sendContactMessage.mockReturnValue(
      new Promise<ContactResult>((resolve) => {
        resolveSend = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillAndSubmit(user);
    await user.type(screen.getByLabelText("メールアドレス"), "{Enter}");

    expect(sendContactMessage).toHaveBeenCalledTimes(1);

    resolveSend({ ok: true });
    expect(await screen.findByText(CONTACT_SENT_MESSAGE)).toBeInTheDocument();
  });

  it("未入力のまま送信しようとしたら送らずに知らせる", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeInTheDocument();
    expect(screen.getByText("お問い合わせ内容を入力してください")).toBeInTheDocument();
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  /**
   * ハニーポットは正規の利用者には見えず、支援技術からも読まれない。読み上げられると
   * 善意で埋められ、そのまま弾かれてしまう。
   */
  it("ハニーポットは支援技術から辿れない", () => {
    render(<ContactForm />);

    // `aria-hidden`が効いていればロールを持たない。DOMには在るので存在確認では検出できない
    expect(screen.queryByRole("textbox", { name: "website" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });
});

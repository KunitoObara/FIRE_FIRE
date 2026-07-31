import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VerifyEmailActionNotice } from "@/components/auth/VerifyEmailActionNotice";
import { LOGIN_PATH } from "@/constants/routes";

const applyEmailVerification = vi.fn<(oobCode: string) => Promise<EmailVerificationApplyResult>>();

vi.mock("@/lib/auth/email-action", () => ({
  applyEmailVerification: (oobCode: string) => applyEmailVerification(oobCode),
}));

describe("VerifyEmailActionNotice", () => {
  beforeEach(() => {
    applyEmailVerification.mockReset();
    applyEmailVerification.mockResolvedValue({ ok: true });
  });

  it("適用中は結果を出さない", () => {
    applyEmailVerification.mockReturnValue(new Promise<EmailVerificationApplyResult>(() => {}));
    render(<VerifyEmailActionNotice oobCode="oob-code" />);

    expect(screen.getByText("メールアドレスを確認しています...")).toBeInTheDocument();
  });

  it("確認できたらA2側のタブが先へ進むことを伝える", async () => {
    render(<VerifyEmailActionNotice oobCode="oob-code" />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "メールアドレスを確認しました" }),
    ).toBeInTheDocument();
    expect(applyEmailVerification).toHaveBeenCalledWith("oob-code");
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute(
      "href",
      LOGIN_PATH,
    );
  });

  it("リンクが無効なときは確認メールの再送を促す", async () => {
    applyEmailVerification.mockResolvedValue({ ok: false, reason: "invalid-action-code" });
    render(<VerifyEmailActionNotice oobCode="oob-code" />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "確認を完了できませんでした" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/確認メールを再送してください/)).toBeInTheDocument();
  });

  it("oobCodeが無いときは問い合わせずに無効として扱う", () => {
    render(<VerifyEmailActionNotice oobCode={null} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "確認を完了できませんでした" }),
    ).toBeInTheDocument();
    expect(applyEmailVerification).not.toHaveBeenCalled();
  });
});

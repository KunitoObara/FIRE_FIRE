import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleLinkFailureNotice } from "@/components/dashboard/GoogleLinkFailureNotice";
import { GOOGLE_LINK_FAILURE_MESSAGE } from "@/constants/auth";
import { clearGoogleLinkFailureNotice, markGoogleLinkFailed } from "@/lib/auth/google-link-notice";

const error = vi.fn<(message: string) => void>();

vi.mock("sonner", () => ({
  toast: { error: (message: string) => error(message) },
}));

describe("GoogleLinkFailureNotice", () => {
  beforeEach(() => {
    error.mockReset();
    clearGoogleLinkFailureNotice();
  });

  it("連携に失敗していたらログインは成功した旨とあわせて通知する", () => {
    markGoogleLinkFailed();

    render(<GoogleLinkFailureNotice />);

    expect(error).toHaveBeenCalledWith(GOOGLE_LINK_FAILURE_MESSAGE);
  });

  // 連携していない状態自体はエラーではないため、通常のログインでは何も出さない
  it("連携失敗が無ければ何も通知しない", () => {
    render(<GoogleLinkFailureNotice />);

    expect(error).not.toHaveBeenCalled();
  });

  // 「そのログインフローの中で1回」。Strict Modeのeffect二重実行でも増えない
  it("通知は1回だけ出す", () => {
    markGoogleLinkFailed();

    render(
      <StrictMode>
        <GoogleLinkFailureNotice />
      </StrictMode>,
    );

    expect(error).toHaveBeenCalledTimes(1);
  });

  it("一度通知したら次の描画では出さない", () => {
    markGoogleLinkFailed();

    const { unmount } = render(<GoogleLinkFailureNotice />);
    unmount();
    error.mockReset();
    render(<GoogleLinkFailureNotice />);

    expect(error).not.toHaveBeenCalled();
  });
});

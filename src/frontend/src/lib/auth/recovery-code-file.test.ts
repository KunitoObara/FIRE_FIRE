import { afterEach, describe, expect, it, vi } from "vitest";

import { RECOVERY_CODE_URL_REVOKE_DELAY_MS } from "@/constants/auth";
import {
  buildRecoveryCodesFileContent,
  buildRecoveryCodesFileName,
  downloadRecoveryCodes,
} from "@/lib/auth/recovery-code-file";

const CODES = ["7F2K-9QRT", "M3XZ-2LDS"];
const ISSUED_AT = new Date(2026, 6, 30, 9, 5);

describe("buildRecoveryCodesFileName", () => {
  it("発行日を含む拡張子付きのファイル名にする", () => {
    expect(buildRecoveryCodesFileName(ISSUED_AT)).toBe("fire-fire-recovery-codes-20260730.txt");
  });
});

describe("buildRecoveryCodesFileContent", () => {
  it("見出し・発行日時・コード・注意事項を含める", () => {
    const content = buildRecoveryCodesFileContent(CODES, ISSUED_AT);

    expect(content).toContain("FIRE-FIRE 2段階認証 リカバリーコード");
    expect(content).toContain("発行日時: 2026-07-30 09:05");
    for (const code of CODES) {
      expect(content).toContain(code);
    }
    // ファイルは時間が経ってから開かれるため、前提を画面の説明に頼らず持たせる
    expect(content).toContain("各コードは一度だけ使用できます。");
    expect(content).toContain("2段階認証の登録が解除される");
  });
});

describe("downloadRecoveryCodes", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("コードを収めたテキストファイルの保存を促し、生成したURLを解放する", async () => {
    vi.useFakeTimers();
    // jsdomはObject URLを実装していないため、呼び出しを捕まえられるよう差し替える
    const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:recovery-codes");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

    // 実装が組み立てる`<a download>`を受け取って中身を確かめる。
    // クリックはjsdomではファイル保存にならないため、呼ばれるだけで良い
    const link = document.createElement("a");
    vi.spyOn(link, "click").mockImplementation(() => undefined);
    vi.spyOn(document, "createElement").mockReturnValue(link);

    downloadRecoveryCodes(CODES, ISSUED_AT);

    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.download).toBe("fire-fire-recovery-codes-20260730.txt");
    expect(link.getAttribute("href")).toBe("blob:recovery-codes");

    const [blob] = createObjectURL.mock.calls[0];
    await expect(blob.text()).resolves.toBe(buildRecoveryCodesFileContent(CODES, ISSUED_AT));

    // クリックの直後に解放すると、ダウンロードが始まる前に無効化されることがある
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(RECOVERY_CODE_URL_REVOKE_DELAY_MS);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:recovery-codes");
  });
});

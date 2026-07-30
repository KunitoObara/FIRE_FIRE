import { describe, expect, it } from "vitest";

import {
  RECOVERY_CODE_COUNT,
  createRecoveryCodeHash,
  createRecoveryCodes,
  formatRecoveryCode,
  isRecoveryCodeFormat,
  matchesRecoveryCodeHash,
  normalizeRecoveryCode,
} from "./recovery-code";

describe("createRecoveryCodes", () => {
  it(`${RECOVERY_CODE_COUNT}本の重複しないコードを返す`, () => {
    const codes = createRecoveryCodes();

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("XXXX-XXXX形式で、紛れやすい0/1/O/Iを含まない", () => {
    for (const code of createRecoveryCodes()) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code).not.toMatch(/[OI]/);
    }
  });

  it("呼び出しごとに異なるコードを作る", () => {
    expect(createRecoveryCodes()).not.toEqual(createRecoveryCodes());
  });
});

describe("normalizeRecoveryCode", () => {
  it("小文字・ハイフン・空白の違いを吸収する", () => {
    expect(normalizeRecoveryCode(" 7f2k-9qrt ")).toBe("7F2K9QRT");
    expect(normalizeRecoveryCode("7F2K 9QRT")).toBe("7F2K9QRT");
  });

  it("コードに現れない0/1は、書き写しの誤りとしてO/Lに読み替える", () => {
    expect(normalizeRecoveryCode("0BGE-K6HJ")).toBe("OBGEK6HJ");
    expect(normalizeRecoveryCode("1DSM-3XZ4")).toBe("LDSM3XZ4");
  });
});

describe("isRecoveryCodeFormat", () => {
  it("8文字で使用文字が揃っていれば真", () => {
    expect(isRecoveryCodeFormat("7F2K9QRT")).toBe(true);
  });

  it("桁数違い・使用しない文字を含むものは偽", () => {
    expect(isRecoveryCodeFormat("7F2K9QR")).toBe(false);
    expect(isRecoveryCodeFormat("7F2K9QRTU")).toBe(false);
    // 正規化で読み替えたあとも残る0/1、および使用しないI
    expect(isRecoveryCodeFormat("7F2K9QR0")).toBe(false);
    expect(isRecoveryCodeFormat("7F2K9QRI")).toBe(false);
  });
});

describe("formatRecoveryCode", () => {
  it("4文字ごとにハイフンで区切る", () => {
    expect(formatRecoveryCode("7F2K9QRT")).toBe("7F2K-9QRT");
  });
});

describe("createRecoveryCodeHash / matchesRecoveryCodeHash", () => {
  it("同じコードなら一致し、平文はハッシュに含まれない", async () => {
    const stored = await createRecoveryCodeHash("7F2K-9QRT");

    expect(stored.hash).not.toContain("7F2K");
    await expect(matchesRecoveryCodeHash("7F2K9QRT", stored)).resolves.toBe(true);
  });

  it("表示形のハイフンや小文字で入力しても一致する", async () => {
    const stored = await createRecoveryCodeHash("7F2K-9QRT");

    await expect(matchesRecoveryCodeHash(normalizeRecoveryCode("7f2k-9qrt"), stored)).resolves.toBe(
      true,
    );
  });

  it("別のコードとは一致しない", async () => {
    const stored = await createRecoveryCodeHash("7F2K-9QRT");

    await expect(matchesRecoveryCodeHash("M3XZ1LDS", stored)).resolves.toBe(false);
  });

  it("同じコードでもソルトが異なるためハッシュは一致しない", async () => {
    const first = await createRecoveryCodeHash("7F2K-9QRT");
    const second = await createRecoveryCodeHash("7F2K-9QRT");

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});

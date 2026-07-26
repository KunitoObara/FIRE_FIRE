import { describe, expect, it } from "vitest";

import { signupSchema } from "@/schemas/signup";

/** 全条件を満たす入力値。各テストで一部だけ差し替えて使う */
const validValues = {
  email: "user@example.com",
  password: "Passw0rd!",
  passwordConfirmation: "Passw0rd!",
  agreedToTerms: true,
};

/** 指定パスに紐づくエラーメッセージを取り出す */
const messagesFor = (values: unknown, path: string): string[] => {
  const result = signupSchema.safeParse(values);
  if (result.success) {
    return [];
  }

  return result.error.issues
    .filter((issue) => issue.path.join(".") === path)
    .map((issue) => issue.message);
};

describe("signupSchema", () => {
  it("全条件を満たす入力を受け付ける", () => {
    expect(signupSchema.safeParse(validValues).success).toBe(true);
  });

  describe("メールアドレス", () => {
    it("未入力を弾く", () => {
      expect(messagesFor({ ...validValues, email: "" }, "email")).toEqual([
        "メールアドレスを入力してください",
      ]);
    });

    it("形式が不正な値を弾く", () => {
      expect(messagesFor({ ...validValues, email: "user@example" }, "email")).toEqual([
        "メールアドレスの形式が正しくありません",
      ]);
    });

    it("前後の空白を除いてから検証し、除いた値を返す", () => {
      const result = signupSchema.safeParse({ ...validValues, email: "  user@example.com  " });

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("user@example.com");
    });

    it("空白のみの入力は未入力として扱う", () => {
      expect(messagesFor({ ...validValues, email: "   " }, "email")).toEqual([
        "メールアドレスを入力してください",
      ]);
    });
  });

  describe("パスワードポリシー", () => {
    it("未入力のときはポリシー違反を重ねて表示しない", () => {
      expect(
        messagesFor({ ...validValues, password: "", passwordConfirmation: "" }, "password"),
      ).toEqual(["パスワードを入力してください"]);
    });

    it("8文字未満を弾く", () => {
      expect(
        messagesFor(
          { ...validValues, password: "Pw0rd!", passwordConfirmation: "Pw0rd!" },
          "password",
        ),
      ).toContain("パスワードは8文字以上で入力してください");
    });

    it("大文字が無い場合を弾く", () => {
      expect(
        messagesFor(
          { ...validValues, password: "passw0rd!", passwordConfirmation: "passw0rd!" },
          "password",
        ),
      ).toContain("大文字と小文字をそれぞれ1文字以上含めてください");
    });

    it("小文字が無い場合を弾く", () => {
      expect(
        messagesFor(
          { ...validValues, password: "PASSW0RD!", passwordConfirmation: "PASSW0RD!" },
          "password",
        ),
      ).toContain("大文字と小文字をそれぞれ1文字以上含めてください");
    });

    it("数字が無い場合を弾く", () => {
      expect(
        messagesFor(
          { ...validValues, password: "Password!", passwordConfirmation: "Password!" },
          "password",
        ),
      ).toContain("数字を1文字以上含めてください");
    });

    it("記号が無い場合を弾く", () => {
      expect(
        messagesFor(
          { ...validValues, password: "Passw0rdd", passwordConfirmation: "Passw0rdd" },
          "password",
        ),
      ).toContain("記号を1文字以上含めてください");
    });

    it("違反している条件をすべて報告する", () => {
      const messages = messagesFor(
        { ...validValues, password: "pass", passwordConfirmation: "pass" },
        "password",
      );

      expect(messages).toEqual([
        "パスワードは8文字以上で入力してください",
        "大文字と小文字をそれぞれ1文字以上含めてください",
        "数字を1文字以上含めてください",
        "記号を1文字以上含めてください",
      ]);
    });
  });

  describe("パスワード(確認用)", () => {
    it("未入力を弾く", () => {
      expect(
        messagesFor({ ...validValues, passwordConfirmation: "" }, "passwordConfirmation"),
      ).toEqual(["確認用パスワードを入力してください"]);
    });

    it("パスワードと一致しない場合を弾く", () => {
      expect(
        messagesFor({ ...validValues, passwordConfirmation: "Passw0rd!!" }, "passwordConfirmation"),
      ).toEqual(["パスワードが一致しません"]);
    });
  });

  describe("利用規約への同意", () => {
    it("未同意を弾く", () => {
      expect(messagesFor({ ...validValues, agreedToTerms: false }, "agreedToTerms")).toEqual([
        "利用規約とプライバシーポリシーに同意してください",
      ]);
    });
  });
});
